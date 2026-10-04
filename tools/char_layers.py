#!/usr/bin/env python3
"""
第九步「固定书桌 + 人物层」的素材生成。

人物层：直接用 relit3 立绘（2398×2624），缩到立绘坐标 1199×1312（陪伴栏里人物按这个尺寸显示，比合成图里的人物清楚一倍），
放到固定书桌上：桌面后沿以上全部保留；以下去掉身体两侧垂下的头发（只去和两侧头发连通的部分，衬衫上偏蓝的阴影、
好奇表情的蓝色笔杆不动），手臂和手压在桌上。接触阴影程序生成（贴边一层 + 右下柔和投影），画布底部多留 PAD px 给阴影。
输出 assets/combo/char-*.png（1199×1352）和 thumb-*.png（256×256，同一个头部框）。

书桌：--desk 给出 GPT 交付的固定书桌（1405×1120）时，裁出合成图坐标 x 250–1250 存为 desk-fixed.png（alpha ≥ 240 改成 255），
并切出羽毛笔和墨水瓶所在的矩形存为 desk-front.png，叠在人物层上面（这块和下面的书桌像素相同，只有盖住头发的地方看得出来）。

坐标：立绘坐标 p 和合成图坐标 c（1000×1120，即 round14 x 250–1250）的关系是 c = (174, −3) + 0.465 × p，
和 round14 合成图里人物的位置、大小一致（skin.css 合成图段按这个换算）。
用法：python3 tools/char_layers.py --src <素材目录>/round6/relit3 [--desk <素材目录>/round15/desk-fixed.png] [--debug <目录>]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

DIR = Path(__file__).resolve().parent.parent / 'assets' / 'combo'
SOURCES = {'default': 'academy-maid-pensive', 'happy': 'expr-happy', 'curious': 'expr-curious', 'wink': 'expr-wink'}
W, H, PAD = 1199, 1312, 40
EDGE = 1117          # 桌面后沿：固定书桌在合成图 y≈515，round14 是 518，换成立绘坐标约 1114–1120
RAMP = 6             # 去头发时从桌沿往下 6px 过渡
SIDE_L, SIDE_R = 150, 960   # 桌沿以下，这两条线外侧的头发是「两侧垂下的头发」，从这里开始找连通的头发
THUMB_BOX = (34, 77, 944, 987)   # 头部框（立绘坐标），和以前合成图缩略图的框是同一处
FRONT_BOX = (634, 330, 760, 615)  # 羽毛笔和墨水瓶（合成图坐标）


def char_layer(src):
    im = Image.open(src).convert('RGBA').resize((W, H), Image.LANCZOS)
    a = np.zeros((H + PAD, W, 4), float)
    a[:H] = np.asarray(im).astype(float)
    a[..., 3] = np.where(a[..., 3] >= 240, 255, a[..., 3])   # relit3 主体 alpha 是 250–254
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    yy = np.arange(H + PAD)[:, None] * np.ones((1, W), int)
    xx = np.arange(W)[None, :] * np.ones((H + PAD, 1), int)
    hair = (((b > 110) & (b - r > 45) & (b - g > 15)) | ((b > 170) & (b - r > 28) & (b >= g))) & (a[..., 3] > 20)
    low = yy >= EDGE
    seed = hair & low & ((xx < SIDE_L) | (xx > SIDE_R))
    side = ndimage.binary_propagation(seed, mask=hair & low)
    side = ndimage.gaussian_filter(ndimage.binary_dilation(side, iterations=1).astype(float), 0.8)
    ramp = np.clip((yy - EDGE) / RAMP, 0, 1)
    a[..., 3] *= 1 - side * ramp
    # 接触阴影：桌沿以下的人物轮廓
    al = a[..., 3] / 255
    body = ((al > 0.5) & low).astype(float)
    contact = ndimage.gaussian_filter(ndimage.shift(body, (4, 2), order=0), 4) * 0.5
    soft = ndimage.gaussian_filter(ndimage.shift(body, (15, 11), order=0), 15) * 0.4
    sh = np.clip(1 - (1 - contact) * (1 - soft), 0, 0.6) * (1 - al) * low
    oa = al + sh * (1 - al)
    out = np.zeros_like(a)
    out[..., :3] = (a[..., :3] * al[..., None] + np.array([40, 22, 18]) * (sh * (1 - al))[..., None]) / np.maximum(oa, 1e-6)[..., None]
    out[..., 3] = oa * 255
    return Image.fromarray(np.clip(out, 0, 255).astype('uint8'))


def desk_layers(src):
    d = Image.open(src).convert('RGBA')
    if d.size != (1405, 1120):
        raise SystemExit(f'desk 尺寸应为 1405×1120，实际 {d.size}')
    a = np.asarray(d.crop((250, 0, 1250, 1120))).copy()
    a[..., 3] = np.where(a[..., 3] >= 240, 255, a[..., 3])   # GPT 给的主体 alpha 是 245–254
    Image.fromarray(a).save(DIR / 'desk-fixed.png', optimize=True)
    front = np.zeros_like(a)
    x1, y1, x2, y2 = FRONT_BOX
    front[y1:y2, x1:x2] = a[y1:y2, x1:x2]
    Image.fromarray(front).save(DIR / 'desk-front.png', optimize=True)
    print('wrote', DIR / 'desk-fixed.png', DIR / 'desk-front.png')


def main():
    args = sys.argv[1:]
    opt = lambda name: args[args.index(name) + 1] if name in args else None
    src, desk, debug = opt('--src'), opt('--desk'), opt('--debug')
    if desk:
        desk_layers(desk)
    if not src:
        return
    for key, name in SOURCES.items():
        layer = char_layer(Path(src) / f'{name}.png')
        layer.save(DIR / f'char-{key}.png', optimize=True)
        layer.crop(THUMB_BOX).resize((256, 256), Image.LANCZOS).save(DIR / f'thumb-{key}.png', optimize=True)
        print('wrote', DIR / f'char-{key}.png', DIR / f'thumb-{key}.png')
        if debug:
            # 预览：按合成图坐标叠到固定书桌上
            Path(debug).mkdir(parents=True, exist_ok=True)
            base = Image.new('RGBA', (1000, 1120), (225, 228, 235, 255))
            base.alpha_composite(Image.open(DIR / 'desk-fixed.png'))
            small = layer.resize((round(W * 0.465), round((H + PAD) * 0.465)), Image.LANCZOS)
            top = Image.new('RGBA', base.size, (0, 0, 0, 0))
            top.paste(small, (174, -3), small)
            base.alpha_composite(top)
            base.alpha_composite(Image.open(DIR / 'desk-front.png'))
            base.save(Path(debug) / f'preview-{key}.png')


if __name__ == '__main__':
    main()
