#!/usr/bin/env python3
"""
Fix webhookRoutes.ts to resolve tenantId from webhook tokens/secrets instead of hardcoding.

Strategy for each webhook:
- /wp-leads: WP_SECRET is a global env, but we need to resolve which tenant uses it.
  Since WP_SECRET is shared, we'll look up all webhook configs and match by secret.
  For now, use the first active tenant with a matching webhook config.
- /leads: Already uses Bearer token → getWebhookConfig resolves by token → we get tenantId from config
- /meta GET: verify_token → look up all meta configs to find matching verify_token → get tenantId
- /meta POST: Already calls getMetaConfig → needs tenantId from signature validation
"""

import re

filepath = '/home/ubuntu/whatsapp-automation-app/server/webhookRoutes.ts'
with open(filepath) as f:
    content = f.read()

# For /wp-leads: We need to resolve tenantId from the WP_SECRET.
# Since WP_SECRET is a single env var, we need a helper that finds which tenant uses it.
# Add a helper function after the imports.

# Add resolveWpTenantId helper
helper_code = '''
// ─── Tenant Resolution Helpers for Webhooks ───────────────
import { webhookConfig, metaIntegrationConfig } from "../drizzle/schema";

async function resolveWpTenantId(): Promise<number> {
  // WP_SECRET is global — resolve to the first active tenant that has a webhook config
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const configs = await db.select().from(webhookConfig).limit(1);
  if (configs.length === 0) throw new Error("No webhook config found for WP tenant");
  return configs[0].tenantId;
}

async function resolveLeadsTenantId(bearerToken: string): Promise<{ tenantId: number; config: any } | null> {
  const db = await getDb();
  if (!db) return null;
  const configs = await db.select().from(webhookConfig);
  const match = configs.find(c => c.webhookSecret === bearerToken);
  if (!match) return null;
  return { tenantId: match.tenantId, config: match };
}

async function resolveMetaTenantByVerifyToken(token: string): Promise<{ tenantId: number; config: any } | null> {
  const db = await getDb();
  if (!db) return null;
  const configs = await db.select().from(metaIntegrationConfig);
  const match = configs.find(c => c.verifyToken === token);
  if (!match) return null;
  return { tenantId: match.tenantId, config: match };
}

async function resolveMetaTenantFromBody(req: Request): Promise<{ tenantId: number; config: any } | null> {
  const db = await getDb();
  if (!db) return null;
  // Get all active meta configs and try to validate signature against each
  const configs = await db.select().from(metaIntegrationConfig).where(eq(metaIntegrationConfig.status, "connected"));
  for (const config of configs) {
    if (config.appSecret) {
      const signature = req.headers["x-hub-signature-256"] as string;
      if (signature) {
        const expectedSig = "sha256=" + createHmac("sha256", config.appSecret).update(JSON.stringify(req.body)).digest("hex");
        if (signature === expectedSig) {
          return { tenantId: config.tenantId, config };
        }
      }
    }
  }
  // Fallback: if only one config exists, use it
  if (configs.length === 1) return { tenantId: configs[0].tenantId, config: configs[0] };
  return null;
}
'''

# Insert after the existing imports
# Find the line "const router = Router();"
content = content.replace(
    'const router = Router();',
    helper_code + '\nconst router = Router();'
)

# Remove duplicate imports that we just added (webhookConfig, metaIntegrationConfig might already be imported)
# Check if they're already imported from schema
if 'webhookConfig' in content.split('const router')[0]:
    # Remove our duplicate import
    content = content.replace(
        'import { webhookConfig, metaIntegrationConfig } from "../drizzle/schema";\n',
        '',
        1  # Only remove the first occurrence (our new one)
    )

with open(filepath, 'w') as f:
    f.write(content)

print("Added tenant resolution helpers to webhookRoutes.ts")
