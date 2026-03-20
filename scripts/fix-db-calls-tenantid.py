#!/usr/bin/env python3
"""
Fix server router calls to db functions that need tenantId.

The blindagem removed tenantId from tRPC input schemas, but the db helper
functions (in crmDb.ts, db.ts, etc.) still expect tenantId as part of their
parameter object.

This script finds patterns like:
  crm.createContact({ ...input, createdBy: ctx.user.id })
  crm.createPipeline(input)
  
And adds tenantId: getTenantId(ctx) to the call:
  crm.createContact({ ...input, tenantId: getTenantId(ctx), createdBy: ctx.user.id })
  crm.createPipeline({ ...input, tenantId: getTenantId(ctx) })

Also handles patterns like:
  crm.someFunction({ ...input })  →  crm.someFunction({ ...input, tenantId: getTenantId(ctx) })
  db.someFunction(input)  →  db.someFunction({ ...input, tenantId: getTenantId(ctx) })
"""

import re
import os
import glob

# Functions known to need tenantId (from the TS errors)
# We'll be more aggressive and add tenantId to any crm.create/update/delete call
# that passes input without tenantId

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: func({ ...input, key: val }) → func({ ...input, tenantId: getTenantId(ctx), key: val })
    # Only if tenantId is not already present
    def add_tenant_to_spread(match):
        full = match.group(0)
        if 'tenantId' in full:
            return full  # Already has tenantId
        func_name = match.group(1)
        rest = match.group(2)
        return f'{func_name}({{ ...input, tenantId: getTenantId(ctx), {rest}'
    
    content = re.sub(
        r'((?:crm|db|admin)\.\w+)\(\{\s*\.\.\.input,\s*((?!tenantId))',
        add_tenant_to_spread,
        content
    )
    
    # Pattern 2: func(input) where input is the tRPC input → func({ ...input, tenantId: getTenantId(ctx) })
    # This is trickier - only do it for known function calls that appear in errors
    # Match: crm.functionName(input) or crm.functionName({ key: val })
    # But NOT: crm.functionName(getTenantId(ctx), ...) which is already correct
    
    # For simple (input) calls - convert to spread with tenantId
    content = re.sub(
        r'((?:crm|admin)\.\w+)\(input\)',
        r'\1({ ...input, tenantId: getTenantId(ctx) })',
        content
    )
    
    # Pattern 3: Handle input.tenantId references that were left in handlers
    # e.g., input.tenantId → getTenantId(ctx) 
    content = re.sub(r'input\.tenantId', 'getTenantId(ctx)', content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Process all backend router files
backend_files = [
    '/home/ubuntu/whatsapp-automation-app/server/routers.ts',
] + glob.glob('/home/ubuntu/whatsapp-automation-app/server/routers/*.ts')

changed = 0
for f in sorted(backend_files):
    if f.endswith('.test.ts'):
        continue
    if fix_file(f):
        changed += 1
        print(f"FIXED: {os.path.basename(f)}")

print(f"\n✅ {changed} files modified")
