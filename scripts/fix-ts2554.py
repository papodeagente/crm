#!/usr/bin/env python3
"""
Fix TS2554 errors: Expected 1-2 arguments, but got 0.
These are .useQuery() calls where the procedure HAS .input() with optional fields,
so they need .useQuery({}) not .useQuery().

Read the error list and fix each specific line.
"""

import re

# Parse error file to get file:line pairs
errors = []
with open('/tmp/remaining-errors.txt') as f:
    for line in f:
        if 'TS2554' in line:
            # Format: file(line,col): error TS2554: ...
            m = re.match(r'(.+?)\((\d+),\d+\)', line)
            if m:
                errors.append((m.group(1), int(m.group(2))))

# Group by file
from collections import defaultdict
by_file = defaultdict(list)
for filepath, lineno in errors:
    by_file[filepath].append(lineno)

for filepath, linenos in by_file.items():
    with open(filepath, 'r') as f:
        lines = f.readlines()
    
    changed = False
    for lineno in linenos:
        idx = lineno - 1
        if idx < len(lines):
            line = lines[idx]
            # Fix .useQuery() → .useQuery({})
            # But only where it's a tRPC call with no args
            new_line = re.sub(r'\.useQuery\(\)', '.useQuery({})', line)
            new_line = re.sub(r'\.useMutation\(\)', '.useMutation({})', new_line)
            if new_line != line:
                lines[idx] = new_line
                changed = True
                print(f"FIXED: {filepath}:{lineno}")
    
    if changed:
        with open(filepath, 'w') as f:
            f.writelines(lines)

print(f"\n✅ Done")
