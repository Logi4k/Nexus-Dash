#!/usr/bin/env python3
with open('/mnt/d/Codex New Dash build - Copy/src/pages/Dashboard.tsx', 'rb') as f:
    content = f.read()
clean = '      {/* ── WEALTH TARGETS ────────────────────────────────────────────────────── */}'.encode('utf-8')
idx = content.find(b'WEALTH TARGETS')
if idx >= 0:
    line_start = content.rfind(b'\n', 0, idx) + 1
    line_end = content.find(b'\n', idx)
    if line_end < 0:
        line_end = len(content)
    content = content[:line_start] + clean + b'\n' + content[line_end+1:]
    with open('/mnt/d/Codex New Dash build - Copy/src/pages/Dashboard.tsx', 'wb') as f:
        f.write(content)
    print('Fixed!')
else:
    print('Not found')
