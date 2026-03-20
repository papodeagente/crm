#!/usr/bin/env python3
"""
Fix handlers that use getTenantId(ctx) but don't have ctx in their destructuring.

Patterns to fix:
1. .query(async ({ input }) => ...getTenantId(ctx)...)
   → .query(async ({ input, ctx }) => ...getTenantId(ctx)...)

2. .query(async () => ...getTenantId(ctx)...)
   → .query(async ({ ctx }) => ...getTenantId(ctx)...)

3. .mutation(async ({ input }) => ...getTenantId(ctx)...)
   → .mutation(async ({ input, ctx }) => ...getTenantId(ctx)...)

Also fixes:
- Handlers that reference ctx.saasUser but don't have ctx
- Handlers that reference ctx.user but don't have ctx
"""

import re
import os
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: .query(async ({ input }) => ...ctx...) → add ctx
    # Match handlers that have { input } but use ctx somewhere in the handler body
    content = re.sub(
        r'\.(query|mutation)\(\s*async\s*\(\s*\{\s*input\s*\}\s*\)\s*=>\s*',
        lambda m: f'.{m.group(1)}(async ({{ input, ctx }}) => ',
        content
    )
    
    # Now we need to remove duplicate ctx - if handler already had ctx, we'd get { input, ctx, ctx }
    content = re.sub(r'\{\s*input,\s*ctx,\s*ctx\s*\}', '{ input, ctx }', content)
    content = re.sub(r'\{\s*ctx,\s*ctx\s*\}', '{ ctx }', content)
    
    # Pattern 2: .query(async () => ...ctx...) → add { ctx }
    # Only if the handler body actually uses ctx
    lines = content.split('\n')
    new_lines = []
    for i, line in enumerate(lines):
        # Check if this line has async () => and uses getTenantId(ctx) or ctx. somewhere after
        if re.search(r'\.(query|mutation)\(\s*async\s*\(\s*\)\s*=>', line):
            # Check if ctx is used in this line or nearby lines
            context_window = '\n'.join(lines[i:min(i+5, len(lines))])
            if 'ctx' in context_window:
                line = re.sub(
                    r'\.(query|mutation)\(\s*async\s*\(\s*\)\s*=>',
                    lambda m: f'.{m.group(1)}(async ({{ ctx }}) =>',
                    line
                )
        new_lines.append(line)
    content = '\n'.join(new_lines)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Process all backend router files
backend_files = (
    glob.glob('/home/ubuntu/whatsapp-automation-app/server/routers.ts') +
    glob.glob('/home/ubuntu/whatsapp-automation-app/server/routers/*.ts')
)

changed = 0
for f in sorted(backend_files):
    if f.endswith('.test.ts'):
        continue
    if fix_file(f):
        changed += 1
        print(f"FIXED: {os.path.basename(f)}")

print(f"\n✅ {changed} files modified")
