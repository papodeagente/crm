#!/usr/bin/env python3
"""
Fix .useQuery({}) and .useMutation({}) calls:
- For procedures WITHOUT .input(): revert .useQuery({}) → .useQuery() and .useQuery({}, opts) → .useQuery(undefined, opts)
- For procedures WITH .input(): keep .useQuery({}) as-is

Strategy: Parse all procedure definitions to build a set of procedures without .input(),
then find all frontend tRPC calls and fix them.
"""

import re
import os
import glob

# Step 1: Build set of procedures without .input()
def get_procs_without_input():
    files = ['server/routers.ts'] + glob.glob('server/routers/*.ts')
    procs_without = set()
    
    for f in files:
        with open(f) as fh:
            content = fh.read()
        for m in re.finditer(r'(\w+):\s*(?:tenant|sessionTenant|protected|public)Procedure\s*\n?\s*\.(\w+)', content):
            name = m.group(1)
            next_call = m.group(2)
            if next_call != 'input':
                procs_without.add(name)
    
    return procs_without

os.chdir('/home/ubuntu/whatsapp-automation-app')
procs_without_input = get_procs_without_input()
print(f"Found {len(procs_without_input)} procedures without .input()")

# Step 2: Fix frontend files
def fix_file(filepath, procs_without):
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    
    # Pattern: trpc.some.path.procName.useQuery({})
    # or: trpc.some.path.procName.useQuery({}, { ... })
    
    def fix_usequery(match):
        full = match.group(0)
        proc_name = match.group(1)
        method = match.group(2)  # useQuery or useMutation
        after = match.group(3)   # what comes after ({
        
        if proc_name in procs_without:
            if after.strip() == '}':
                # .useQuery({}) → .useQuery()
                return f'{proc_name}.{method}()'
            elif after.strip().startswith('},'):
                # .useQuery({}, opts) → .useQuery(undefined, opts)
                rest = after[after.index(',')+1:]
                return f'{proc_name}.{method}(undefined,{rest}'
        
        return full  # Keep as-is for procedures with .input()
    
    # Match: procName.useQuery({...})
    content = re.sub(
        r'(\w+)\.(useQuery|useMutation)\(\{(\}(?:\)|,)[^)]*\)?)',
        fix_usequery,
        content
    )
    
    # Simpler approach: just find .useQuery({}) and .useQuery({}, patterns
    # and check the procedure name before the method
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        return True
    return False

# The regex above is too complex. Let me use a simpler line-by-line approach
def fix_file_v2(filepath, procs_without):
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    changed = False
    new_lines = []
    
    for line in lines:
        orig_line = line
        
        # Find patterns like: .procName.useQuery({})
        for m in re.finditer(r'\.(\w+)\.(useQuery|useMutation)\(\{\}(\))', line):
            proc = m.group(1)
            method = m.group(2)
            if proc in procs_without:
                old = f'.{proc}.{method}({{}})'
                new = f'.{proc}.{method}()'
                line = line.replace(old, new)
                changed = True
        
        # Find patterns like: .procName.useQuery({},
        for m in re.finditer(r'\.(\w+)\.(useQuery|useMutation)\(\{\},', line):
            proc = m.group(1)
            method = m.group(2)
            if proc in procs_without:
                old = f'.{proc}.{method}({{}},'
                new = f'.{proc}.{method}(undefined,'
                line = line.replace(old, new)
                changed = True
        
        new_lines.append(line)
    
    if changed:
        with open(filepath, 'w') as f:
            f.writelines(new_lines)
    
    return changed

frontend_files = (
    glob.glob('/home/ubuntu/whatsapp-automation-app/client/src/pages/*.tsx') +
    glob.glob('/home/ubuntu/whatsapp-automation-app/client/src/components/*.tsx')
)

fixed = 0
for f in sorted(frontend_files):
    if fix_file_v2(f, procs_without_input):
        fixed += 1
        print(f"FIXED: {os.path.basename(f)}")

print(f"\n✅ {fixed} files modified")
