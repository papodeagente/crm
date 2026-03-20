#!/usr/bin/env python3
"""
Remove tenantId from all frontend tRPC query/mutation inputs.

Patterns to handle:
1. { tenantId, key: "value" }  →  { key: "value" }
2. { tenantId }  →  (empty — becomes void call)
3. { tenantId, ...rest }  →  { ...rest }
4. { key: val, tenantId, other: val }  →  { key: val, other: val }
5. { tenantId: someVar, key: val }  →  { key: val }
6. tenantId,\n  (multiline)  →  remove line
7. { tenantId: TENANT_ID, ... }  →  remove tenantId prop

Also removes:
- useTenantId import lines
- const tenantId = useTenantId(); declarations
- const TENANT_ID = useTenantId(); declarations
- enabled: !!tenantId conditions (replace with enabled: true or remove)
"""

import re
import os
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Step 1: Remove import of useTenantId
    # Pattern: import { useTenantId } from "@/hooks/useTenantId";
    # Also handles: import { useTenantId } from "../hooks/useTenantId";
    content = re.sub(
        r'import\s*\{\s*useTenantId\s*\}\s*from\s*["\']@/hooks/useTenantId["\'];\s*\n',
        '',
        content
    )
    content = re.sub(
        r'import\s*\{\s*useTenantId\s*\}\s*from\s*["\'][^"\']*useTenantId["\'];\s*\n',
        '',
        content
    )
    
    # Step 2: Remove const tenantId = useTenantId(); and const TENANT_ID = useTenantId();
    content = re.sub(
        r'\s*const\s+(?:tenantId|TENANT_ID)\s*=\s*useTenantId\(\);\s*\n',
        '\n',
        content
    )
    
    # Step 3: Handle { tenantId } as sole argument (becomes void/no-arg)
    # Pattern: .useQuery({ tenantId }) or .useQuery({ tenantId },
    # Replace with .useQuery( or .useQuery(undefined,
    content = re.sub(
        r'\.useQuery\(\s*\{\s*tenantId\s*\}\s*\)',
        '.useQuery()',
        content
    )
    content = re.sub(
        r'\.useQuery\(\s*\{\s*tenantId\s*\}\s*,',
        '.useQuery(undefined,',
        content
    )
    content = re.sub(
        r'\.useQuery\(\s*\{\s*TENANT_ID\s*\}\s*\)',
        '.useQuery()',
        content
    )
    content = re.sub(
        r'\.useQuery\(\s*\{\s*TENANT_ID\s*\}\s*,',
        '.useQuery(undefined,',
        content
    )
    
    # Step 4: Handle { tenantId: number } as sole argument in mutateAsync/mutate
    content = re.sub(
        r'\.mutateAsync\(\s*\{\s*tenantId(?::\s*\w+)?\s*\}\s*\)',
        '.mutateAsync()',
        content
    )
    content = re.sub(
        r'\.mutate\(\s*\{\s*tenantId(?::\s*\w+)?\s*\}\s*\)',
        '.mutate()',
        content
    )
    
    # Step 5: Remove tenantId from object literals (inline, single line)
    # Pattern: { tenantId, key: val } → { key: val }
    # Pattern: { tenantId: TENANT_ID, key: val } → { key: val }
    # Pattern: { key: val, tenantId } → { key: val }
    # Pattern: { key: val, tenantId, other: val } → { key: val, other: val }
    
    # Remove "tenantId, " or "tenantId: someVar, " at start/middle of object
    content = re.sub(r'tenantId:\s*(?:tenantId|TENANT_ID|saasUser\.tenantId|\d+)\s*,\s*', '', content)
    content = re.sub(r'(?<=[{,])\s*tenantId\s*,\s*', ' ', content)
    
    # Remove ", tenantId" or ", tenantId: someVar" at end of object (before })
    content = re.sub(r',\s*tenantId:\s*(?:tenantId|TENANT_ID|saasUser\.tenantId|\d+)\s*(?=\s*[})])', '', content)
    content = re.sub(r',\s*tenantId\s*(?=\s*[})])', '', content)
    
    # Step 6: Handle multiline patterns - tenantId on its own line
    # Remove lines that are just "tenantId," or "tenantId: TENANT_ID," or "tenantId: tenantId,"
    content = re.sub(
        r'\n\s*tenantId:\s*(?:tenantId|TENANT_ID|saasUser\.tenantId|\d+)\s*,?\s*\n',
        '\n',
        content
    )
    content = re.sub(
        r'\n\s*tenantId\s*,\s*\n',
        '\n',
        content
    )
    
    # Step 7: Handle enabled: !!tenantId — replace with true or remove
    # Pattern: { enabled: !!tenantId } → remove the option or set enabled: true
    content = re.sub(r'enabled:\s*!!tenantId\s*&&\s*', 'enabled: ', content)
    content = re.sub(r'&&\s*!!tenantId', '', content)
    content = re.sub(r'!!tenantId\s*&&\s*', '', content)
    content = re.sub(r'enabled:\s*!!tenantId', 'enabled: true', content)
    content = re.sub(r'enabled:\s*!!TENANT_ID', 'enabled: true', content)
    
    # Step 8: Clean up empty objects that might result from removal
    # { } in useQuery → remove argument
    content = re.sub(r'\.useQuery\(\s*\{\s*\}\s*\)', '.useQuery()', content)
    content = re.sub(r'\.useQuery\(\s*\{\s*\}\s*,', '.useQuery(undefined,', content)
    
    # Step 9: Clean up double commas or trailing commas in objects
    content = re.sub(r',\s*,', ',', content)
    # Clean up { , key } → { key }
    content = re.sub(r'\{\s*,\s*', '{ ', content)
    
    # Step 10: Remove unused tenantId variable references that might remain
    # Like: if (!tenantId) return null; — these guards are no longer needed
    # But be careful not to remove legitimate uses
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Process all frontend files
frontend_files = (
    glob.glob('/home/ubuntu/whatsapp-automation-app/client/src/pages/*.tsx') +
    glob.glob('/home/ubuntu/whatsapp-automation-app/client/src/components/*.tsx') +
    glob.glob('/home/ubuntu/whatsapp-automation-app/client/src/hooks/*.ts') +
    glob.glob('/home/ubuntu/whatsapp-automation-app/client/src/hooks/*.tsx')
)

changed = 0
for f in sorted(frontend_files):
    if fix_file(f):
        changed += 1
        print(f"FIXED: {os.path.basename(f)}")

print(f"\n✅ {changed} files modified")
