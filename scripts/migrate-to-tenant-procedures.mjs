/**
 * Migration Script: Replace protectedProcedure → tenantProcedure
 * and sessionProtectedProcedure → sessionTenantProcedure
 * 
 * Strategy:
 * 1. ALL `protectedProcedure` that use `getTenantId(ctx)` → `tenantProcedure`
 * 2. ALL `sessionProtectedProcedure` that use `getTenantId(ctx)` → `sessionTenantProcedure`
 * 3. `sessionProtectedProcedure` WITHOUT getTenantId → `sessionTenantProcedure` (add tenant isolation)
 * 4. `protectedProcedure` WITHOUT getTenantId that access tenant data → `tenantProcedure`
 * 
 * Exceptions (keep as protectedProcedure):
 * - None — all CRM endpoints need tenant context
 * 
 * Exceptions (keep as publicProcedure):
 * - auth.me, auth.logout
 */
import { readFileSync, writeFileSync } from 'fs';

const FILE = 'server/routers.ts';
let content = readFileSync(FILE, 'utf-8');
const originalContent = content;

// Step 1: Update import to include sessionTenantProcedure
content = content.replace(
  /import \{ publicProcedure, protectedProcedure, sessionProtectedProcedure, tenantProcedure, getTenantId, router \} from "\.\/\_core\/trpc"/,
  'import { publicProcedure, protectedProcedure, sessionProtectedProcedure, tenantProcedure, sessionTenantProcedure, getTenantId, router } from "./_core/trpc"'
);

// Step 2: Replace ALL sessionProtectedProcedure → sessionTenantProcedure
// This ensures all WhatsApp session endpoints have tenant isolation
const sessionReplacements = content.split('sessionProtectedProcedure').length - 1;
content = content.replace(/sessionProtectedProcedure/g, 'sessionTenantProcedure');
console.log(`Replaced ${sessionReplacements} sessionProtectedProcedure → sessionTenantProcedure`);

// Step 3: Replace ALL remaining protectedProcedure → tenantProcedure
// We need to be careful NOT to replace the import line
// First, count occurrences (excluding import)
const lines = content.split('\n');
let protectedCount = 0;
const newLines = lines.map((line, i) => {
  // Skip the import line
  if (line.includes('from "./_core/trpc"')) return line;
  // Skip any line that's a comment about protectedProcedure
  if (line.trim().startsWith('//') || line.trim().startsWith('*')) return line;
  
  if (line.includes('protectedProcedure')) {
    protectedCount++;
    return line.replace(/protectedProcedure/g, 'tenantProcedure');
  }
  return line;
});
content = newLines.join('\n');
console.log(`Replaced ${protectedCount} protectedProcedure → tenantProcedure`);

// Step 4: Remove protectedProcedure from import since it's no longer used in this file
// Actually, keep it in case some edge cases need it
// But update import to also not import sessionProtectedProcedure since we replaced all
content = content.replace(
  'import { publicProcedure, protectedProcedure, sessionProtectedProcedure, tenantProcedure, sessionTenantProcedure, getTenantId, router } from "./_core/trpc"',
  'import { publicProcedure, tenantProcedure, sessionTenantProcedure, getTenantId, router } from "./_core/trpc"'
);

writeFileSync(FILE, content);

// Summary
const totalChanges = sessionReplacements + protectedCount;
console.log(`\n=== Migration Summary ===`);
console.log(`File: ${FILE}`);
console.log(`sessionProtectedProcedure → sessionTenantProcedure: ${sessionReplacements}`);
console.log(`protectedProcedure → tenantProcedure: ${protectedCount}`);
console.log(`Total replacements: ${totalChanges}`);
console.log(`Import updated to: publicProcedure, tenantProcedure, sessionTenantProcedure, getTenantId, router`);
