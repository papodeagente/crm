#!/usr/bin/env python3
"""
Fix broken handler patterns in routers.ts where the migration script
incorrectly created duplicate .query/.mutation handlers inside existing handlers.

The pattern looks like:
    .query(async ({ input }) => {
        const db = await getDb();
        ...
        .from(someTable)
      .query(async ({ input, ctx }) => {     <-- BROKEN: this is inside the previous handler
          .where(eq(someTable.tenantId, getTenantId(ctx)))

Should be:
    .query(async ({ input, ctx }) => {
        const db = await getDb();
        ...
        .from(someTable)
          .where(eq(someTable.tenantId, getTenantId(ctx)))
"""

import re

filepath = '/home/ubuntu/whatsapp-automation-app/server/routers.ts'
with open(filepath) as f:
    content = f.read()

changes = 0

# Pattern: find .query/.mutation that appears inside another handler body
# These are identified by being preceded by a line that's part of a drizzle query chain
# (.from, .select, .insert, .update, .delete, etc.)

# Strategy: Remove the duplicate .query/.mutation line and merge the ctx into the first one
lines = content.split('\n')
new_lines = []
skip_next = False
i = 0

while i < len(lines):
    line = lines[i]
    stripped = line.strip()
    
    # Check if this line is a broken duplicate handler
    if (stripped.startswith('.query(async') or stripped.startswith('.mutation(async')) and i > 0:
        # Look backwards to see if we're inside another handler
        inside_handler = False
        handler_start_idx = None
        
        for j in range(i - 1, max(0, i - 5), -1):
            prev = lines[j].strip()
            if prev:
                # If the previous non-empty line is a drizzle chain method, we're inside a handler
                if any(prev.startswith(p) or prev.endswith(p) for p in [
                    '.from(', '.select(', '.insert(', '.update(', '.delete(',
                    '.values({', '.set(', '.orderBy(', '.groupBy(',
                ]):
                    inside_handler = True
                    break
                # If it ends with a drizzle table reference
                if re.search(r'\.(from|select|insert|update|delete)\([^)]*\)$', prev):
                    inside_handler = True
                    break
                break
        
        if inside_handler:
            # This is a broken duplicate - skip this line
            # But first, check if the first handler needs ctx added
            # Find the original handler start
            for j in range(len(new_lines) - 1, max(0, len(new_lines) - 30), -1):
                prev_stripped = new_lines[j].strip()
                if prev_stripped.startswith('.query(async') or prev_stripped.startswith('.mutation(async'):
                    # Add ctx to the original handler if not present
                    if '{ input }' in new_lines[j] and 'ctx' not in new_lines[j]:
                        new_lines[j] = new_lines[j].replace('{ input }', '{ input, ctx }')
                    elif '({ })' in new_lines[j] or '({})' in new_lines[j]:
                        new_lines[j] = new_lines[j].replace('({ })', '({ ctx })').replace('({})', '({ ctx })')
                    break
            
            changes += 1
            print(f"  Removed broken handler at line {i+1}: {stripped[:60]}")
            i += 1
            continue
    
    new_lines.append(line)
    i += 1

content = '\n'.join(new_lines)

# Also fix patterns where the original handler was .mutation(async ({ input }) => {
# and getTenantId(ctx) is used inside but ctx is not in the signature
lines = content.split('\n')
for i, line in enumerate(lines):
    stripped = line.strip()
    if 'getTenantId(ctx)' in stripped:
        # Look backwards for the handler signature
        for j in range(i - 1, max(0, i - 15), -1):
            prev = lines[j].strip()
            if prev.startswith('.query(async') or prev.startswith('.mutation(async'):
                if '{ input }' in lines[j] and 'ctx' not in lines[j]:
                    lines[j] = lines[j].replace('{ input }', '{ input, ctx }')
                    changes += 1
                    print(f"  Added ctx to handler at line {j+1}")
                elif '() =>' in lines[j] and 'ctx' not in lines[j]:
                    lines[j] = lines[j].replace('() =>', '({ ctx }) =>')
                    changes += 1
                    print(f"  Added ctx to handler at line {j+1}")
                break

content = '\n'.join(lines)

with open(filepath, 'w') as f:
    f.write(content)

print(f"\nTotal: {changes} fixes applied")
