#!/usr/bin/env python3
"""
Phase 2: Remove remaining tenantId: TENANT_ID and tenantId: tenantId! patterns from frontend.
Also removes const TENANT_ID = useTenantId() and related guards.
"""

import re
import os
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Remove import of useTenantId (any remaining)
    content = re.sub(
        r'import\s*\{\s*useTenantId\s*\}\s*from\s*["\'][^"\']*["\'];\s*\n',
        '',
        content
    )
    
    # Remove const TENANT_ID = useTenantId(); and const tenantId = useTenantId();
    content = re.sub(r'\s*const\s+TENANT_ID\s*=\s*useTenantId\(\);\s*\n', '\n', content)
    content = re.sub(r'\s*const\s+tenantId\s*=\s*useTenantId\(\);\s*\n', '\n', content)
    
    # Handle { tenantId: TENANT_ID } as sole argument
    content = re.sub(r'\.useQuery\(\s*\{\s*tenantId:\s*TENANT_ID\s*\}\s*\)', '.useQuery()', content)
    content = re.sub(r'\.useQuery\(\s*\{\s*tenantId:\s*TENANT_ID\s*\}\s*,', '.useQuery(undefined,', content)
    content = re.sub(r'\.useQuery\(\s*\{\s*tenantId:\s*tenantId!?\s*\}\s*\)', '.useQuery()', content)
    content = re.sub(r'\.useQuery\(\s*\{\s*tenantId:\s*tenantId!?\s*\}\s*,', '.useQuery(undefined,', content)
    
    # Handle mutateAsync/mutate with sole tenantId
    content = re.sub(r'\.mutateAsync\(\s*\{\s*tenantId:\s*TENANT_ID\s*\}\s*\)', '.mutateAsync()', content)
    content = re.sub(r'\.mutate\(\s*\{\s*tenantId:\s*TENANT_ID\s*\}\s*\)', '.mutate()', content)
    content = re.sub(r'\.mutateAsync\(\s*\{\s*tenantId:\s*tenantId!?\s*\}\s*\)', '.mutateAsync()', content)
    content = re.sub(r'\.mutate\(\s*\{\s*tenantId:\s*tenantId!?\s*\}\s*\)', '.mutate()', content)
    
    # Remove tenantId: TENANT_ID, from objects (with comma after)
    content = re.sub(r'tenantId:\s*TENANT_ID\s*,\s*', '', content)
    content = re.sub(r'tenantId:\s*tenantId!?\s*,\s*', '', content)
    
    # Remove , tenantId: TENANT_ID from objects (with comma before, at end)
    content = re.sub(r',\s*tenantId:\s*TENANT_ID\s*(?=\s*[})])', '', content)
    content = re.sub(r',\s*tenantId:\s*tenantId!?\s*(?=\s*[})])', '', content)
    
    # Remove multiline tenantId: TENANT_ID, or tenantId: tenantId!,
    content = re.sub(r'\n\s*tenantId:\s*TENANT_ID\s*,?\s*\n', '\n', content)
    content = re.sub(r'\n\s*tenantId:\s*tenantId!?\s*,?\s*\n', '\n', content)
    
    # Handle enabled: !!TENANT_ID and enabled: !!tenantId
    content = re.sub(r'enabled:\s*!!TENANT_ID\s*&&\s*', 'enabled: ', content)
    content = re.sub(r'enabled:\s*!!tenantId\s*&&\s*', 'enabled: ', content)
    content = re.sub(r'&&\s*!!TENANT_ID', '', content)
    content = re.sub(r'&&\s*!!tenantId', '', content)
    content = re.sub(r'!!TENANT_ID\s*&&\s*', '', content)
    content = re.sub(r'!!tenantId\s*&&\s*', '', content)
    content = re.sub(r'enabled:\s*!!TENANT_ID', 'enabled: true', content)
    content = re.sub(r'enabled:\s*!!tenantId', 'enabled: true', content)
    
    # Remove guards like if (!tenantId) return null; or if (!TENANT_ID) return null;
    content = re.sub(r'\s*if\s*\(\s*!tenantId\s*\)\s*return\s+null;\s*\n', '\n', content)
    content = re.sub(r'\s*if\s*\(\s*!TENANT_ID\s*\)\s*return\s+null;\s*\n', '\n', content)
    content = re.sub(r'\s*if\s*\(\s*!tenantId\s*\)\s*return;\s*\n', '\n', content)
    content = re.sub(r'\s*if\s*\(\s*!TENANT_ID\s*\)\s*return;\s*\n', '\n', content)
    
    # Clean up empty objects
    content = re.sub(r'\.useQuery\(\s*\{\s*\}\s*\)', '.useQuery()', content)
    content = re.sub(r'\.useQuery\(\s*\{\s*\}\s*,', '.useQuery(undefined,', content)
    content = re.sub(r'\.mutateAsync\(\s*\{\s*\}\s*\)', '.mutateAsync()', content)
    content = re.sub(r'\.mutate\(\s*\{\s*\}\s*\)', '.mutate()', content)
    
    # Clean up double commas
    content = re.sub(r',\s*,', ',', content)
    content = re.sub(r'\{\s*,\s*', '{ ', content)
    
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
