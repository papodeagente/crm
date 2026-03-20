#!/usr/bin/env node
/**
 * Tenant Blindagem (Shielding) Migration Script
 * 
 * This script applies tenant isolation fixes across all router files:
 * 1. Replaces `protectedProcedure` with `tenantProcedure` in tenant-scoped endpoints
 * 2. Replaces `input.tenantId` with `ctx.tenantId` (from middleware)
 * 3. Removes `tenantId: z.number().default(1)` from input schemas
 * 4. Removes `|| 1` and `|| 0` fallbacks
 * 5. Fixes `(ctx as any).saasUser?.tenantId || input.tenantId || 1` patterns
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = '/home/ubuntu/whatsapp-automation-app';

// ═══════════════════════════════════════════════════════════════
// ROUTERS.TS — Main router file (3578 lines)
// ═══════════════════════════════════════════════════════════════

function fixRoutersTs() {
  const filePath = path.join(PROJECT_ROOT, 'server/routers.ts');
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let changes = 0;

  // 1. Add tenantProcedure to imports
  content = content.replace(
    /import \{ publicProcedure, protectedProcedure, sessionProtectedProcedure, router \} from "\.\/\_core\/trpc";/,
    'import { publicProcedure, protectedProcedure, sessionProtectedProcedure, tenantProcedure, getTenantId, router } from "./_core/trpc";'
  );
  changes++;

  // 2. Fix WhatsApp connect: `ctx.saasUser?.tenantId || 0` → use tenantProcedure
  // These are in the whatsapp router section and need careful handling

  // 3. Fix the triple-fallback pattern: `(ctx as any).saasUser?.tenantId || input.tenantId || 1`
  // Replace with `getTenantId(ctx)`
  content = content.replace(
    /const tenantId = \(ctx as any\)\.saasUser\?\.tenantId \|\| input\.tenantId \|\| 1;/g,
    (match) => { changes++; return 'const tenantId = getTenantId(ctx);'; }
  );

  // 4. Fix `ctx.saasUser?.tenantId || 1` → `getTenantId(ctx)`
  content = content.replace(
    /const tenantId = ctx\.saasUser\?\.tenantId \|\| 1;/g,
    (match) => { changes++; return 'const tenantId = getTenantId(ctx);'; }
  );

  // 5. Fix `ctx.saasUser?.tenantId || 0` → `getTenantId(ctx)`
  content = content.replace(
    /const tenantId = ctx\.saasUser\?\.tenantId \|\| 0;/g,
    (match) => { changes++; return 'const tenantId = getTenantId(ctx);'; }
  );

  // 6. Fix inline usage: `(ctx as any).saasUser?.tenantId || input.tenantId || 1`
  content = content.replace(
    /\(ctx as any\)\.saasUser\?\.tenantId \|\| input\.tenantId \|\| 1/g,
    (match) => { changes++; return 'getTenantId(ctx)'; }
  );

  // 7. Remove `tenantId: z.number().default(1),` from input schemas
  // But keep tenantId in schemas where it's z.number() (without default) — those are passed from frontend
  content = content.replace(
    /tenantId: z\.number\(\)\.default\(1\),?\s*/g,
    (match) => { changes++; return ''; }
  );

  // 8. For procedures that use `input.tenantId` and have `protectedProcedure`:
  // We need to replace protectedProcedure with tenantProcedure for tenant-scoped endpoints
  // BUT NOT for auth.me, auth.logout, or other non-tenant endpoints
  
  // Strategy: Replace all `protectedProcedure` that are followed by `.input(z.object({ tenantId:` 
  // with `tenantProcedure`
  // This is tricky because the tenantId might be removed from input already.
  // Instead, we'll target specific sections.

  // For dashboard, preferences, search, notifications, dateCelebrations, contactProfile, customFields,
  // leadCapture, rdStation, fieldMappings, ai sections — these all use `input.tenantId`
  // Replace `protectedProcedure` with `tenantProcedure` in these sections
  // AND replace `input.tenantId` with `ctx.tenantId`

  // For procedures that already had tenantId removed from input, 
  // we need to add `ctx` to the destructuring and use `getTenantId(ctx)` or `ctx.tenantId`

  // Let's do a more targeted approach:
  // Replace `input.tenantId` with `getTenantId(ctx)` everywhere in the file
  // But we need to make sure `ctx` is available in the handler
  
  // First, for handlers that only destructure `{ input }`, add `ctx`:
  // Pattern: `.query(async ({ input }) =>` → `.query(async ({ input, ctx }) =>`
  // But only where input.tenantId is used
  
  // This is complex, let's do it line by line
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // If line uses input.tenantId, we need to replace it
    if (line.includes('input.tenantId')) {
      // Replace input.tenantId with getTenantId(ctx) 
      line = line.replace(/input\.tenantId/g, 'getTenantId(ctx)');
      changes++;
      
      // Check if the handler above doesn't have ctx in destructuring
      // Look backwards for the handler signature
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        if (newLines[j] && (newLines[j].includes('.query(async ({ input })') || newLines[j].includes('.mutation(async ({ input })'))) {
          newLines[j] = newLines[j].replace('{ input }', '{ input, ctx }');
          changes++;
          break;
        }
        if (newLines[j] && (newLines[j].includes('.query(async ({') || newLines[j].includes('.mutation(async ({'))) {
          break; // Already has ctx or different pattern
        }
      }
    }
    
    // For destructuring pattern `const { tenantId, ...rest } = input;` 
    // Replace with `const tenantId = getTenantId(ctx); const { ...rest } = input;`
    if (line.match(/const \{ tenantId,\s*(.+)\} = input;/)) {
      const rest = line.match(/const \{ tenantId,\s*(.+)\} = input;/);
      if (rest) {
        line = `const tenantId = getTenantId(ctx); const { ${rest[1]}} = input;`;
        changes++;
      }
    }
    
    newLines.push(line);
  }
  
  content = newLines.join('\n');

  // 9. Replace protectedProcedure with tenantProcedure for sections that access tenant data
  // We'll target specific router sections:
  
  // Dashboard section
  content = content.replace(
    /dashboard: router\(\{[\s\S]*?\}\),\n\n/,
    (match) => {
      changes++;
      return match.replace(/protectedProcedure/g, 'tenantProcedure');
    }
  );

  // Preferences section  
  content = content.replace(
    /preferences: router\(\{[\s\S]*?\}\),\n\n/,
    (match) => {
      changes++;
      return match.replace(/protectedProcedure/g, 'tenantProcedure');
    }
  );

  // Search section
  content = content.replace(
    /search: router\(\{[\s\S]*?\}\),\n\n/,
    (match) => {
      changes++;
      return match.replace(/protectedProcedure/g, 'tenantProcedure');
    }
  );

  // Notifications section
  content = content.replace(
    /notifications: router\(\{[\s\S]*?\}\),\n\n/,
    (match) => {
      changes++;
      return match.replace(/protectedProcedure/g, 'tenantProcedure');
    }
  );

  fs.writeFileSync(filePath, content);
  console.log(`[routers.ts] ${changes} changes applied`);
  return changes;
}

// Run
const totalChanges = fixRoutersTs();
console.log(`\nTotal changes: ${totalChanges}`);
