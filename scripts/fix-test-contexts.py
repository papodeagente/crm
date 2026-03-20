#!/usr/bin/env python3
"""
Fix all test files to include saasUser in the mock context.
The tenantProcedure middleware now requires ctx.saasUser.tenantId,
so all test mock contexts need to include saasUser.
"""

import re
import glob
import os

os.chdir('/home/ubuntu/whatsapp-automation-app')

# Find all test files
test_files = glob.glob('server/*.test.ts')

for filepath in sorted(test_files):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Skip files that already have saasUser in their context
    if 'saasUser' in content:
        print(f'SKIP (already has saasUser): {filepath}')
        continue
    
    original = content
    
    # Pattern 1: ctx has user and req/res but no saasUser
    # Add saasUser after the user field in the ctx object
    # Match: const ctx: TrpcContext = {\n    user,\n    req:
    content = re.sub(
        r'(const ctx(?:\s*:\s*TrpcContext)?\s*=\s*\{[^}]*?user(?::\s*\w+)?,?\s*\n)(\s*)(req:)',
        r'\1\2saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },\n\2\3',
        content
    )
    
    # Pattern 2: Some tests use user directly in the object
    # Match: { user, req: ... } without saasUser
    if content == original:
        content = re.sub(
            r'(const ctx\s*=\s*\{[^}]*?user,?\s*\n)(\s*)(req:)',
            r'\1\2saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },\n\2\3',
            content
        )
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f'FIXED: {filepath}')
    else:
        print(f'NO MATCH: {filepath}')

print('\n✅ Done')
