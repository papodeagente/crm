#!/usr/bin/env python3
"""
Fix frontend .useQuery() calls that were changed from .useQuery({tenantId}) to .useQuery()
but the backend procedure still has .input() with optional fields.

These need to be .useQuery({}) instead of .useQuery().

Also fix remaining tenantId references that were missed.
"""

import re
import os
import glob

# Known procedures that have .input() with all-optional fields
# We'll just convert all .useQuery() to .useQuery({}) and let TS figure it out
# Actually, the issue is that .useQuery() means "no input" but the procedure expects input (even if all optional)
# So .useQuery({}) is the correct call

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Fix .useQuery() → .useQuery({}) where the procedure expects input
    # But only for trpc calls, not for other hooks
    content = re.sub(
        r'(trpc\.\w+(?:\.\w+)*\.useQuery)\(\)',
        r'\1({})',
        content
    )
    
    # Fix .useQuery(undefined, → .useQuery({}, 
    content = re.sub(
        r'(trpc\.\w+(?:\.\w+)*\.useQuery)\(undefined,',
        r'\1({},',
        content
    )
    
    # Fix remaining 'Cannot find name tenantId' - these are in useEffect deps, 
    # component props, and conditional logic that still reference tenantId
    # Remove tenantId from useEffect dependency arrays
    content = re.sub(r',\s*tenantId(?=[\],])', '', content)
    content = re.sub(r'tenantId,\s*', '', content)
    
    # Fix remaining TENANT_ID references
    content = re.sub(r',\s*TENANT_ID(?=[\],])', '', content)
    content = re.sub(r'TENANT_ID,\s*', '', content)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Process all frontend files
frontend_files = (
    glob.glob('/home/ubuntu/whatsapp-automation-app/client/src/pages/*.tsx') +
    glob.glob('/home/ubuntu/whatsapp-automation-app/client/src/components/*.tsx')
)

changed = 0
for f in sorted(frontend_files):
    if fix_file(f):
        changed += 1
        print(f"FIXED: {os.path.basename(f)}")

print(f"\n✅ {changed} files modified")
