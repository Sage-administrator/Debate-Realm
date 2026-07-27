import re, os
base = r'D:\Code\DebateTimer\DebateTimerV3\scripts'
cur = os.path.join(base, 'mem-3000.log')
data = []
with open(cur, encoding='utf-8') as f:
    for ln in f.read().splitlines()[1:]:
        m = re.match(r'(\d+:\d+:\d+)\s+pid=(\d+)\s+mem=([\d.]+)MB', ln)
        if m:
            data.append((m.group(1), int(m.group(2)), float(m.group(3))))
n = len(data)
mems = [d[2] for d in data]
mn, mx = min(mems), max(mems)
W, H = 760, 380
L, R, T, B = 60, 20, 34, 46
pw, ph = W - L - R, H - T - B
def x(i):
    return L + (i / (n - 1)) * pw if n > 1 else L + pw / 2
def y(v):
    return T + (1 - (v - mn) / (mx - mn if mx > mn else 1)) * ph
pts = ' '.join(f'{x(i):.1f},{y(v):.1f}' for i, (t, pid, v) in enumerate(data))
grid = ''
for k in range(5):
    val = mn + (mx - mn) * k / 4
    yy = y(val)
    grid += f'<line x1="{L}" y1="{yy:.1f}" x2="{L+pw}" y2="{yy:.1f}" stroke="#2a2a3a"/><text x="{L-8}" y="{yy+4:.1f}" fill="#9aa" font-size="11" text-anchor="end">{val:.0f}</text>'
peak_i = max(range(n), key=lambda i: data[i][2])
val_i = min(range(n), key=lambda i: data[i][2])
mark = f'<circle cx="{x(peak_i):.1f}" cy="{y(data[peak_i][2]):.1f}" r="4" fill="#ff6b6b"/><text x="{x(peak_i):.1f}" y="{y(data[peak_i][2])-10:.1f}" fill="#ff6b6b" font-size="11" text-anchor="middle">peak {mx:.0f}</text>'
mark += f'<circle cx="{x(val_i):.1f}" cy="{y(data[val_i][2]):.1f}" r="4" fill="#6bff95"/><text x="{x(val_i):.1f}" y="{y(data[val_i][2])+18:.1f}" fill="#6bff95" font-size="11" text-anchor="middle">min {mn:.0f}</text>'
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="monospace">
<rect width="{W}" height="{H}" fill="#14141f"/>
<text x="{W/2:.0f}" y="20" fill="#eee" font-size="14" text-anchor="middle">Nuxt dev :3000 内存趋势 (PID {data[0][1]}, Working Set MB)</text>
{grid}
<polyline fill="none" stroke="#4fd1ff" stroke-width="1.5" points="{pts}"/>
{mark}
<text x="{L}" y="{H-12}" fill="#9aa" font-size="11">start {data[0][0]}</text>
<text x="{L+pw}" y="{H-12}" fill="#9aa" font-size="11" text-anchor="end">end {data[-1][0]}</text>
</svg>'''
out = os.path.join(base, 'mem-trend.svg')
open(out, 'w', encoding='utf-8').write(svg)
print('wrote', n, 'points peak', mx, 'min', mn, '->', out)
