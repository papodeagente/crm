#!/usr/bin/env python3
"""
Fix all test files to include saasUser in the mock context.
Strategy: Find lines with 'req:' that are inside a context object (after 'user' block),
and insert saasUser before them.
"""

import re
import glob
import os

os.chdir('/home/ubuntu/whatsapp-automation-app')

SAAS_USER = 'saasUser: { userId: 1, tenantId: 1, role: "admin" as const, email: "test@example.com", name: "Test User" },'

test_files = glob.glob('server/*.test.ts')
fixed = 0

for filepath in sorted(test_files):
    with open(filepath, 'r') as f:
        content = f.read()
    
    if 'saasUser' in content:
        continue
    
    # Check if this file creates a tRPC caller (needs saasUser)
    if 'createCaller' not in content:
        continue
    
    original = content
    lines = content.split('\n')
    new_lines = []
    in_context_block = False
    found_user = False
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        # Detect context object start
        if 'TrpcContext' in line and ('{' in line or (i + 1 < len(lines) and '{' in lines[i + 1])):
            in_context_block = True
            found_user = False
        
        # Detect user property
        if in_context_block and ('user:' in stripped or 'user,' in stripped):
            found_user = True
        
        # Insert saasUser before req: if we're in a context block and found user
        if in_context_block and found_user and stripped.startswith('req:'):
            indent = line[:len(line) - len(line.lstrip())]
            new_lines.append(f'{indent}{SAAS_USER}')
            in_context_block = False
            found_user = False
        
        new_lines.append(line)
    
    new_content = '\n'.join(new_lines)
    
    if new_content != original:
        with open(filepath, 'w') as f:
            f.write(new_content)
        fixed += 1
        print(f'FIXED: {filepath}')
    else:
        print(f'NO MATCH: {filepath}')

print(f'\n✅ Fixed {fixed} files')
