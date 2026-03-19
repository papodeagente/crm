#!/usr/bin/env python3
"""
Remove remaining tenantId: z.number() from inline input schemas in all router files.
Also fix duplicate imports.
"""

import re
import os
import glob

PROJECT_ROOT = '/home/ubuntu/whatsapp-automation-app'

def fix_file(filepath):
    with open(filepath) as f:
        content = f.read()
    original = content
    changes = 0
    
    # Fix duplicate imports: `tenantProcedure, tenantProcedure,`
    while 'tenantProcedure, tenantProcedure,' in content:
        content = content.replace('tenantProcedure, tenantProcedure,', 'tenantProcedure,')
        changes += 1
    
    # Remove `tenantId: z.number(), ` from inline input schemas
    # Pattern: `tenantId: z.number(), ` followed by another field
    old = content
    content = re.sub(r'tenantId:\s*z\.number\(\),\s*', '', content)
    if content != old:
        changes += old.count('tenantId: z.number(),')
    
    # Remove `tenantId: z.number()` when it's the only field or last field
    # Pattern: `, tenantId: z.number()` at end of object
    old = content
    content = re.sub(r',\s*tenantId:\s*z\.number\(\)', '', content)
    if content != old:
        changes += 1
    
    # Pattern: `{ tenantId: z.number() }` as the only field
    old = content
    content = re.sub(r'\{\s*tenantId:\s*z\.number\(\)\s*\}', '{}', content)
    if content != old:
        changes += 1
    
    # Clean up empty input schemas: `.input(z.object({}))`
    old = content
    content = re.sub(r'\s*\.input\(z\.object\(\{\s*\}\)\)', '', content)
    if content != old:
        changes += 1
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  [{os.path.basename(filepath)}] {changes} fixes")
    return changes

# Fix all router files
total = 0
for f in sorted(glob.glob(os.path.join(PROJECT_ROOT, 'server/routers/*.ts'))):
    if f.endswith('.test.ts'):
        continue
    total += fix_file(f)

# Also fix main routers.ts
total += fix_file(os.path.join(PROJECT_ROOT, 'server/routers.ts'))

print(f"\nTotal: {total} fixes")
