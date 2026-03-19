#!/usr/bin/env node
/**
 * Tenant Blindagem — Fix all router files in server/routers/
 * 
 * Strategy:
 * 1. Replace `protectedProcedure` import with `tenantProcedure, getTenantId`
 * 2. Replace `protectedProcedure` usage with `tenantProcedure`
 * 3. Remove `tenantId: z.number()` and `tenantId: z.number().default(1)` from input schemas
 * 4. Replace `input.tenantId` with `getTenantId(ctx)`
 * 5. Fix handler signatures to include `ctx` where needed
 * 6. Fix destructuring patterns `const { tenantId, ...rest } = input`
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = '/home/ubuntu/whatsapp-automation-app';

// Files that should NOT be modified (they don't deal with tenant data)
const SKIP_FILES = ['profileRouter.ts'];

// Files where protectedProcedure should be replaced with tenantProcedure
const TENANT_ROUTER_FILES = [
  'adminRouter.ts',
  'aiAnalysisRouter.ts', 
  'crmRouter.ts',
  'featureRouters.ts',
  'inboxRouter.ts',
  'productCatalogRouter.ts',
  'rdCrmImportRouter.ts',
  'rfvRouter.ts',
  'utmAnalyticsRouter.ts',
];

// saasAuthRouter.ts needs special handling — it creates tenants, so some procedures are public

function fixRouterFile(filePath) {
  const fileName = path.basename(filePath);
  if (SKIP_FILES.includes(fileName)) {
    console.log(`[${fileName}] SKIPPED (not tenant-scoped)`);
    return 0;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let changes = 0;

  // 1. Fix imports: add tenantProcedure and getTenantId
  if (content.includes('protectedProcedure') && !content.includes('tenantProcedure')) {
    content = content.replace(
      /import \{([^}]*?)protectedProcedure([^}]*?)\} from ["']\.\.\/\_core\/trpc["'];/,
      (match, before, after) => {
        changes++;
        // Add tenantProcedure and getTenantId to the import
        let imports = `${before}protectedProcedure, tenantProcedure, getTenantId${after}`;
        return `import {${imports}} from "../_core/trpc";`;
      }
    );
  }

  // For saasAuthRouter, keep protectedProcedure for some endpoints but add tenantProcedure
  if (fileName === 'saasAuthRouter.ts') {
    // Just add the import, don't replace protectedProcedure globally
    if (!content.includes('tenantProcedure')) {
      content = content.replace(
        /import \{([^}]*?)\} from ["']\.\.\/\_core\/trpc["'];/,
        (match, imports) => {
          changes++;
          return `import {${imports}, tenantProcedure, getTenantId} from "../_core/trpc";`;
        }
      );
    }
  }

  // 2. Replace protectedProcedure with tenantProcedure (for tenant-scoped files)
  if (TENANT_ROUTER_FILES.includes(fileName)) {
    const count = (content.match(/protectedProcedure/g) || []).length;
    content = content.replace(/protectedProcedure/g, 'tenantProcedure');
    changes += count;
  }

  // 3. Process line by line for input schema and handler fixes
  const lines = content.split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Remove standalone `tenantId: z.number(),` or `tenantId: z.number().default(1),`
    if (line.match(/^\s*tenantId:\s*z\.number\(\)(\.default\(\d+\))?,?\s*$/)) {
      let inInputSchema = false;
      for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
        if (lines[j].includes('.input(z.object(') || lines[j].includes('.input(')) {
          inInputSchema = true;
          break;
        }
        if (lines[j].includes('.query(') || lines[j].includes('.mutation(')) break;
      }
      if (inInputSchema) {
        changes++;
        continue; // Skip this line
      }
    }

    // Remove tenantId from single-line input schemas
    if (line.includes('tenantId: z.number()') && line.includes('.input(')) {
      const before = line;
      line = line.replace(/tenantId:\s*z\.number\(\)(\.default\(\d+\))?,?\s*/g, '');
      if (line !== before) changes++;
    }

    // Replace input.tenantId with getTenantId(ctx)
    if (line.includes('input.tenantId')) {
      line = line.replace(/input\.tenantId/g, 'getTenantId(ctx)');
      changes++;

      // Ensure ctx is in handler signature
      for (let j = newLines.length - 1; j >= Math.max(0, newLines.length - 10); j--) {
        const prevLine = newLines[j];
        if (prevLine && (prevLine.includes('.query(async') || prevLine.includes('.mutation(async'))) {
          if (prevLine.includes('{ input }') && !prevLine.includes('ctx')) {
            newLines[j] = prevLine.replace('{ input }', '{ input, ctx }');
            changes++;
          } else if ((prevLine.includes('({ })') || prevLine.includes('({})')) && !prevLine.includes('ctx')) {
            newLines[j] = prevLine.replace(/\(\{\s*\}\)/, '({ ctx })');
            changes++;
          }
          break;
        }
        // If we find a line with ctx already, stop looking
        if (prevLine && prevLine.includes('ctx')) break;
      }
    }

    // Fix destructuring: `const { tenantId, ...rest } = input;`
    const destructMatch = line.match(/const \{\s*tenantId,\s*(.+)\}\s*=\s*input;/);
    if (destructMatch) {
      line = `const tenantId = getTenantId(ctx); const { ${destructMatch[1]}} = input;`;
      changes++;
    }

    // Fix: `const { tenantId } = input;` (only tenantId)
    if (line.match(/const \{\s*tenantId\s*\}\s*=\s*input;/)) {
      line = line.replace(/const \{\s*tenantId\s*\}\s*=\s*input;/, 'const tenantId = getTenantId(ctx);');
      changes++;
    }

    // Fix fallback patterns: `ctx.saasUser?.tenantId || 1` or `?? 1`
    if (line.match(/ctx\.saasUser\?\.tenantId\s*\|\|\s*1/) || line.match(/ctx\.saasUser\?\.tenantId\s*\?\?\s*1/)) {
      line = line.replace(/ctx\.saasUser\?\.tenantId\s*(\|\||(\?\?))\s*1/g, 'getTenantId(ctx)');
      changes++;
    }

    // Fix: `(ctx.user as any).tenantId ?? 1`
    if (line.includes('(ctx.user as any).tenantId')) {
      line = line.replace(/\(ctx\.user as any\)\.tenantId\s*(\?\?|\|\|)\s*\d+/g, 'getTenantId(ctx)');
      changes++;
    }

    // Fix: `(ctx as any).saasUser?.tenantId || input.tenantId || 1`
    if (line.includes('(ctx as any).saasUser?.tenantId')) {
      line = line.replace(/\(ctx as any\)\.saasUser\?\.tenantId\s*\|\|\s*(input\.tenantId\s*\|\|\s*)?\d+/g, 'getTenantId(ctx)');
      changes++;
    }

    newLines.push(line);
  }

  content = newLines.join('\n');

  // Clean up empty input schemas: `.input(z.object({ }))` or `.input(z.object({}))`
  content = content.replace(/\.input\(z\.object\(\{\s*\}\)\)\s*\n/g, '\n');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`[${fileName}] ${changes} changes applied`);
  } else {
    console.log(`[${fileName}] No changes needed`);
  }
  return changes;
}

// Process all router files
const routersDir = path.join(PROJECT_ROOT, 'server/routers');
const files = fs.readdirSync(routersDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
let totalChanges = 0;

for (const file of files) {
  totalChanges += fixRouterFile(path.join(routersDir, file));
}

console.log(`\nTotal: ${totalChanges} changes across ${files.length} files`);
