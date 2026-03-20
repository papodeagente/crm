#!/usr/bin/env python3
"""
Fix all test files to include saasUser in the mock context.
Handles multiple patterns: createAuthContext, createTestContext, inline ctx objects.
"""

import re
import glob
import os

os.chdir('/home/ubuntu/whatsapp-automation-app')

SAAS_USER_BLOCK = '    saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },'

test_files = glob.glob('server/*.test.ts')
fixed = 0

for filepath in sorted(test_files):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Skip files that already have saasUser
    if 'saasUser' in content:
        continue
    
    original = content
    
    # Strategy: Find any object that has `user,` or `user:` followed by `req:` 
    # and inject saasUser between them. This handles all patterns.
    
    # Pattern: return {\n    user,\n    req:  OR  return {\n    user: something,\n    req:
    # Also: const ctx = {\n    user,\n    req:
    content = re.sub(
        r'((?:return|const \w+(?:\s*:\s*\w+)?\s*=)\s*\{[^}]*?user(?:\s*:\s*\w+)?,?\s*\n)(\s*)(req\s*:)',
        lambda m: m.group(1) + m.group(2) + 'saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },\n' + m.group(2) + m.group(3),
        content
    )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        fixed += 1
        print(f'FIXED: {filepath}')
    else:
        print(f'NO MATCH: {filepath}')

print(f'\n✅ Fixed {fixed} files')
