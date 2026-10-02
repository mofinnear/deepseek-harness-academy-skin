"""生成侧栏星图底纹（SVG）。
用法: python3 tools/sidebar_starmap.py <输出前缀> [--seed N] [--dots N] [--cons N] [--sparks N]
输出 <前缀>.svg 和 <前缀>.uri（CSS 用的 data URI）。
星点用泊松盘采样（彼此保持最小距离），星座是随机游走的 3–6 颗星，起点彼此保持距离。"""
import urllib.parse, random, math, argparse
ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('--seed', type=int, default=20261002)
ap.add_argument('--dots', type=int, default=40); ap.add_argument('--cons', type=int, default=3)
ap.add_argument('--sparks', type=int, default=4)
o = ap.parse_args(); random.seed(o.seed)
W, H = 260, 1100
parts = []
def r2(v): return round(v, 1)
# 零散星点（分布在可见区 y 60–900 为主）
pts = []; tries = 0
gap = max(18, int(math.sqrt(W * 900 / max(o.dots, 1)) * 0.75))
while len(pts) < o.dots and tries < 20000:
    tries += 1
    x, y = random.uniform(6, W - 6), random.uniform(40, 1000)
    if all((x - a) ** 2 + (y - b) ** 2 > gap ** 2 for a, b in pts): pts.append((x, y))
for x, y in pts:
    r = random.choices([.5, .7, .9, 1.2, 1.6], [30, 30, 20, 12, 5])[0]
    op = random.choice([.35, .5, .65, .8, .95])
    col = random.choice(['#dfe8ff', '#eef3ff', '#fff6dc'])
    parts.append(f"<circle cx='{r2(x)}' cy='{r2(y)}' r='{r}' fill='{col}' opacity='{op}'/>")
# 星座
# 起点分带：可见区 y 120–800 均分成 cons 段，每段一组，左右交替并加抖动，保证分散
starts = []
band = (800 - 120) / max(o.cons, 1)
side = random.choice([0, 1])
for i in range(o.cons):
    y = 120 + band * (i + random.uniform(.2, .8))
    x = random.uniform(40, 120) if (i + side) % 2 == 0 else random.uniform(140, 220)
    starts.append((x, y))
for sx, sy in starts:
    for _ in range(300):
        n = random.randint(3, 6); x, y = sx, sy
        ang = random.uniform(0, 2 * math.pi); c = [(x, y)]; ok = True
        for i in range(n - 1):
            ang += random.uniform(-1.4, 1.4); step = random.uniform(20, 44)
            x, y = x + step * math.cos(ang), y + step * math.sin(ang)
            if not (14 < x < W - 14 and abs(y - sy) < band * .55): ok = False; break
            c.append((x, y))
        if ok: break
    if n >= 5 and random.random() < .35: c.append(c[random.randint(0, 1)])
    d = 'M' + ' L'.join(f'{r2(a)} {r2(b)}' for a, b in c)
    parts.append(f"<path d='{d}' fill='none' stroke='#e4ecff' stroke-width='.7' opacity='{random.choice([.4, .5, .6])}'/>")
    for a, b in set(c):
        parts.append(f"<circle cx='{r2(a)}' cy='{r2(b)}' r='{random.choice([1.4, 1.7, 2.0, 2.4])}' fill='#f4f7ff'/>")
# 四角星光
def spark(x, y, s): return f"<path d='M{x} {y-s} Q{x} {y} {x+s} {y} Q{x} {y} {x} {y+s} Q{x} {y} {x-s} {y} Q{x} {y} {x} {y-s}Z' fill='#f8faff' opacity='.9'/>"
for _ in range(o.sparks):
    parts.append(spark(r2(random.uniform(15, W - 15)), r2(random.uniform(60, 900)), random.choice([3.5, 4.5, 6])))
svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='{W}' height='{H}' viewBox='0 0 {W} {H}'>" + ''.join(parts) + "</svg>"
open(o.out + '.svg', 'w').write(svg)
uri = "data:image/svg+xml," + urllib.parse.quote(svg, safe="/:=' ")
open(o.out + '.uri', 'w').write(uri); print(o.out, len(uri))
