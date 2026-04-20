#!/bin/bash
# Kivora — Build Script
# Auto-fixes content files then runs Hugo
# This runs on Cloudflare Pages before every build

set -e

echo "=== Kivora Build ==="

# Auto-fix content whitespace and format issues
echo "Cleaning content files..."
python3 -c "
import os, re

for directory in ['content/posts']:
    if not os.path.isdir(directory):
        continue
    for fname in os.listdir(directory):
        if not fname.endswith('.md'):
            continue
        fpath = os.path.join(directory, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
        except:
            continue
        lines = content.split('\n')
        if not lines or lines[0].strip() != '---':
            continue
        close_idx = -1
        for i in range(1, len(lines)):
            if lines[i].strip() == '---':
                close_idx = i
                break
        if close_idx == -1:
            continue
        new_lines = [line.lstrip() for line in lines]
        content = '\n'.join(new_lines)
        content = re.sub(r'^category: \"([^\"]+)\"', r'categories: [\"\1\"]', content, flags=re.MULTILINE)
        content = content.replace('categories: [\"undefined\"]', 'categories: [\"build\"]')
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  Cleaned: {directory}/{fname}')

print('Content cleanup complete.')
"

echo "Running Hugo..."
hugo --minify
echo "=== Kivora Build Successful ==="
