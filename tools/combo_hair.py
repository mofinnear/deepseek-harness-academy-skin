#!/usr/bin/env python3
"""
从合成图（assets/combo/combo-*.png，1000×1120）左侧切出「只有头发」的一条，供陪伴栏把头发伸出去盖住对话框。

合成图本身在陪伴栏里严格截到栏内（书桌不能盖到对话框上），伸出栏外的只有这一条：
桌面后沿（y≈506）以上全部保留（头发、耳朵）；以下只保留和上方头发连通的蓝色发丝，桌面和桌上物件都去掉。
用法：python3 tools/combo_hair.py
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

DIR = Path(__file__).resolve().parent.parent / 'assets' / 'combo'
X1, Y1 = 270, 700   # 取合成图左侧 x 0–270、y 0–700（即 round14 合成图 x 250–520）
EDGE = 496          # 桌面后沿在 y 506–517，留 10px 余量，再用 8px 过渡
RAMP = 8

for key in ('default', 'happy', 'curious', 'wink'):
    im = Image.open(DIR / f'combo-{key}.png').convert('RGBA').crop((0, 0, X1, Y1))
    a = np.asarray(im).astype(float)
    r, g, b, alpha = (a[..., i] for i in range(4))
    hair = (((b > 110) & (b - r > 45) & (b - g > 15)) | ((b > 170) & (b - r > 28) & (b >= g))) & (alpha > 20)
    seen = np.zeros_like(hair)
    queue = deque((EDGE, x) for x in range(X1) if hair[EDGE, x])
    for p in queue:
        seen[p] = True
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (0, 1), (0, -1), (-1, 0), (1, 1), (1, -1)):
            ny, nx = y + dy, x + dx
            if EDGE <= ny < Y1 and 0 <= nx < X1 and hair[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    mask = Image.fromarray((seen * 255).astype('uint8')).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    mask = np.asarray(mask) / 255
    mask[:EDGE] = 1
    ramp = np.clip((np.arange(Y1) - EDGE) / RAMP, 0, 1)[:, None]
    a[..., 3] = alpha * (1 - ramp * (1 - mask))
    Image.fromarray(a.astype('uint8')).save(DIR / f'hair-{key}.png', optimize=True)
    print('wrote', DIR / f'hair-{key}.png')
