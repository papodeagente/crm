#!/usr/bin/env python3
"""
Restore useTenantId() declarations in frontend files that still reference tenantId
as a local variable but had the import/declaration removed by the blindagem scripts.

Strategy:
1. Find all .tsx files that reference `tenantId` as a variable (not as a property like input.tenantId)
2. Check if they already import useTenantId
3. If not, add the import and declaration
4. For tRPC calls that pass { tenantId: tenantId || 0 }, remove the tenantId since backend handles it
5. For enabled: tenantId > 0, these are fine - they just gate the query on having a valid session
"""

import re
import os
import glob

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Check if file references tenantId as a standalone variable (not input.tenantId, not t.tenantId, etc.)
    # Pattern: tenantId used as variable - in conditions, props, or function args
    has_tenant_var = bool(re.search(r'(?<!\.)tenantId(?!\s*[:\?])', content))
    
    if not has_tenant_var:
        return False
    
    # Check if useTenantId is already imported
    has_import = 'useTenantId' in content
    has_declaration = 'const tenantId' in content or 'let tenantId' in content
    
    if not has_import and not has_declaration:
        # Add import
        # Find the last import line
        import_lines = list(re.finditer(r'^import .+$', content, re.MULTILINE))
        if import_lines:
            last_import = import_lines[-1]
            insert_pos = last_import.end()
            content = content[:insert_pos] + '\nimport { useTenantId } from "@/hooks/useTenantId";' + content[insert_pos:]
        
        # Find the component function and add const tenantId = useTenantId() after the first line
        # Look for function component pattern: export default function X() { or function X() {
        func_match = re.search(r'(export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{)', content)
        if func_match:
            insert_pos = func_match.end()
            content = content[:insert_pos] + '\n  const tenantId = useTenantId();' + content[insert_pos:]
    
    # Fix patterns like { tenantId: tenantId || 0 } in tRPC calls - remove tenantId from input
    content = re.sub(
        r'\{\s*tenantId:\s*tenantId\s*\|\|\s*0\s*\}',
        '{}',
        content
    )
    content = re.sub(
        r'\{\s*tenantId:\s*tenantId\s*\|\|\s*0,\s*',
        '{ ',
        content
    )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# Process all frontend files with tenantId references
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
