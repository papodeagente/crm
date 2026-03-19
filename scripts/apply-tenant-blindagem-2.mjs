#!/usr/bin/env node
/**
 * Tenant Blindagem Phase 2 — Remove remaining tenantId from input schemas
 * and replace with getTenantId(ctx) from middleware
 */

import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = '/home/ubuntu/whatsapp-automation-app';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  let changes = 0;

  // Remove `tenantId: z.number(),` from input schemas (with optional trailing space/newline)
  // But NOT from non-input contexts (like schema definitions)
  const lines = content.split('\n');
  const newLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Remove standalone `tenantId: z.number(),` or `tenantId: z.number()` from .input() schemas
    // Check if we're inside an .input(z.object({ ... })) context
    if (line.match(/^\s*tenantId: z\.number\(\),?\s*$/) && !line.includes('default')) {
      // Check context: look backwards for .input(z.object
      let inInputSchema = false;
      for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
        if (lines[j].includes('.input(z.object(')) {
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

    // Remove `tenantId: z.number(), ` when it's part of a single-line .input(z.object({ tenantId: z.number(), ... }))
    if (line.includes('.input(z.object({') && line.includes('tenantId: z.number()')) {
      const before = line;
      // Remove tenantId: z.number(), from the object
      line = line.replace(/tenantId: z\.number\(\),?\s*/g, '');
      // If the object is now empty like .input(z.object({ })), handle it
      line = line.replace(/\.input\(z\.object\(\{\s*\}\)\)/, '.input(z.object({}))');
      if (line !== before) changes++;
    }

    // Replace `getTenantId(ctx)` references that were already applied — these are correct
    // But we need to handle cases where ctx might not be in the handler signature
    
    // If this line has getTenantId(ctx) but the handler doesn't have ctx
    if (line.includes('getTenantId(ctx)')) {
      // Look backwards for handler signature
      let hasCtx = false;
      for (let j = i - 1; j >= Math.max(0, i - 8); j--) {
        const prevLine = newLines[j] || lines[j];
        if (prevLine.includes('{ ctx') || prevLine.includes('{ctx') || prevLine.includes(', ctx')) {
          hasCtx = true;
          break;
        }
        if (prevLine.includes('.query(async') || prevLine.includes('.mutation(async')) {
          // Found handler but no ctx
          if (prevLine.includes('{ input }')) {
            newLines[j] = prevLine.replace('{ input }', '{ input, ctx }');
            hasCtx = true;
            changes++;
          } else if (prevLine.includes('({ })') || prevLine.includes('({})')) {
            newLines[j] = prevLine.replace(/\(\{\s*\}\)/, '({ ctx })');
            hasCtx = true;
            changes++;
          }
          break;
        }
      }
    }

    newLines.push(line);
  }

  content = newLines.join('\n');
  
  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`[${path.basename(filePath)}] ${changes} changes applied`);
  } else {
    console.log(`[${path.basename(filePath)}] No changes needed`);
  }
  return changes;
}

const total = fixFile(path.join(PROJECT_ROOT, 'server/routers.ts'));
console.log(`\nTotal: ${total} changes`);
