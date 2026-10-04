#!/usr/bin/env python3
"""
第九步「固定书桌 + 人物层」：从合成图（assets/combo/combo-*.png，1000×1120，即 round14 x 250–1250）抠出人物层。

人物层 = 桌面后沿（y 518）以上的人物（去掉羽毛笔、墨水瓶、后面那本书）+ 桌沿以下压在桌上的身体、手臂、手。
桌沿以下的判断：在每个表情各自的大致范围（多边形）里，取「人物颜色（深蓝袖子、白衬衫/袖口、肤色、头发）
或 和开心表情差别大（手压在书页上）」并且和上方身体连通的部分，再补洞、平滑。
羽毛笔和头发重叠的地方挖掉后用周围头发颜色补上；羽毛笔、墨水瓶由固定书桌的「前景物件」层盖在人物上面。

接触阴影：桌沿以下人物的轮廓向右下偏移、模糊，作为半透明深色层合进人物层（只出现在人物以外）。

输出 assets/combo/char-*.png（1000×1120），调试图写到 --debug 目录。
给出 --desk（GPT 交付的固定书桌，1405×1120）时同时生成 desk-fixed.png；只要 desk-fixed.png 存在就重新生成 desk-front.png。
用法：python3 tools/combo_layers.py [--desk <素材目录>/round15/desk-fixed.png] [--debug <目录>]
坐标注释都是 round14 原图坐标（x 减 250 就是合成图坐标）。
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

DIR = Path(__file__).resolve().parent.parent / 'assets' / 'combo'
X0 = 250                 # 合成图在 round14 里的横向起点
EDGE = 518               # 桌面后沿
KEYS = ('default', 'happy', 'curious', 'wink')

# 桌沿以下人物的大致范围（round14 坐标），书的封面、墨水瓶、星图纸在范围外
REGION = {
    'happy':   [(430, 518), (1010, 518), (1010, 572), (900, 600), (840, 610), (720, 604), (600, 596), (470, 576), (430, 545)],
    'default': [(430, 518), (1010, 518), (1010, 572), (900, 602), (760, 606), (700, 608), (560, 610), (525, 596), (470, 566), (430, 545)],
    'curious': [(430, 518), (1010, 518), (1010, 572), (900, 602), (750, 606), (650, 600), (590, 600), (540, 596), (470, 566), (430, 545)],
    'wink':    [(430, 518), (1010, 518), (1010, 572), (900, 602), (760, 606), (700, 608), (540, 608), (505, 596), (470, 566), (430, 545)],
}
# 手：肤色和书页颜色几乎一样，手指之间又露出书页，只靠轮廓线围不住。每只手画一个比轮廓线小约 3px 的
# 保守多边形，算作「肯定是人物」；多边形和轮廓线之间的几像素靠颜色和差值补上
HAND = {
    'default': [(590, 550), (655, 548), (668, 558), (668, 578), (640, 580), (615, 582), (595, 590), (575, 590),
                (562, 582), (565, 570), (580, 555)],
    'curious': [(632, 533), (665, 530), (690, 545), (700, 555), (698, 572), (680, 575), (655, 575), (640, 570),
                (628, 560), (622, 548)],
    'wink':    [(595, 545), (660, 548), (667, 560), (668, 575), (640, 578), (600, 577), (590, 584), (575, 588),
                (550, 586), (540, 580), (550, 572), (575, 555)],
}
# 要去掉的物件：羽毛笔+墨水瓶（右，桌沿上下都有）、后面那本书（左，桌沿以上）。范围内不是头发/袖子的颜色就算物件
PROP_BOX = [(878, 330, 1010, 615), (250, 480, 470, EDGE)]
INKWELL = (880, 495, 1000, 615)   # 墨水瓶是深蓝玻璃，和袖子同色；四张里袖子右端都在 x ≤ 871，这个框里除了头发都算物件
RIGHT_LIMIT = 1010       # 再往右（花瓶、书摞）都不是人物


def poly_mask(points, shape):
    m = Image.new('L', (shape[1], shape[0]), 0)
    ImageDraw.Draw(m).polygon([(x - X0, y) for x, y in points], fill=255)
    return np.asarray(m) > 0


def colors(a):
    r, g, b = (a[..., i].astype(int) for i in range(3))
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    navy = (mx < 135) & (b >= r - 5)
    white = (mn > 170) & (b >= r - 2)   # 衬衫、袖口是偏冷的白；书页高光偏暖，不算
    skin = (r > 200) & (r - g > 18) & (r - g < 80) & (b < r - 15) & (b > g - 35)
    hair = (b > 110) & (b - r > 40)
    return navy, white, skin, hair


def char_mask(key, a, ref):
    h, w = a.shape[:2]
    alpha = a[..., 3] > 20
    navy, white, skin, hair = colors(a)
    yy = np.arange(h)[:, None] * np.ones((1, w), int)
    xx = np.arange(w)[None, :] * np.ones((h, 1), int) + X0

    # 桌沿以上
    above = alpha & (yy < EDGE) & (xx < RIGHT_LIMIT)
    prop = np.zeros_like(alpha)
    for x1, y1, x2, y2 in PROP_BOX:
        box = (xx >= x1) & (xx < x2) & (yy >= y1) & (yy < y2)
        prop |= box & ~(hair | navy)
    x1, y1, x2, y2 = INKWELL
    prop |= (xx >= x1) & (xx < x2) & (yy >= y1) & (yy < y2) & ~hair & alpha
    # 物件区里的袖子金线、高光等细碎小块不算：只保留和「腐蚀后还在的大块」连通的部分
    prop = ndimage.binary_propagation(ndimage.binary_opening(prop, iterations=3), mask=prop)
    prop = ndimage.binary_dilation(ndimage.binary_fill_holes(prop), iterations=1)
    above &= ~prop

    # 桌沿以下：深蓝袖子、白衬衫/袖口、头发按颜色；手和书页颜色几乎一样（肤色约 246,197,175，书页约 246,206,179），
    # 不能按颜色分，改用「和开心表情不同」找到手的轮廓线，再补洞把手心填进去。
    # 只是变暗的书页（各通道按同一比例变暗 = 手臂投下的阴影）不算，阴影由程序重新生成。
    region = poly_mask(REGION[key], (h, w)) & (yy >= EDGE)
    r, g, b = (a[..., i].astype(int) for i in range(3))
    outline = (r > 140) & (g < 0.45 * r) & (b < 0.45 * r)   # 手的红色轮廓线（桌子木纹 g/r 约 0.55，不会混进来）
    cand = navy | white | hair | outline
    if ref is not None:
        fa = ndimage.gaussian_filter(a[..., :3].astype(float), (1.2, 1.2, 0))
        fr = ndimage.gaussian_filter(ref[0][..., :3].astype(float), (1.2, 1.2, 0))
        diff = np.abs(fa - fr).max(-1)
        ratio = (fa + 8) / (fr + 8)
        shade = (ratio.max(-1) - ratio.min(-1) < 0.12) & (ratio.max(-1) < 1.05)
        cand |= (diff > 55) & ~shade & ~ref[1]
    sure = poly_mask(HAND[key], (h, w)) if key in HAND else np.zeros_like(alpha)
    cand = (cand & region & alpha & ~prop) | sure
    # 只要和桌沿上方的人物连通的部分（scipy 的 label 在这台机器上坏了，用 propagation）
    seed = above & (yy >= EDGE - 3)
    below = ndimage.binary_propagation(seed, mask=cand | seed) & (yy >= EDGE)
    # 补洞要连同桌沿以上一起做，否则紧贴桌沿的金饰小洞会被当成「通到外面」
    m = ndimage.binary_fill_holes(above | below)
    below = ndimage.binary_closing(m & (yy >= EDGE), iterations=2) & region & ~prop
    m = ndimage.binary_fill_holes(above | below) & ~prop
    if ref is not None:
        # 修边：桌沿以下和开心表情几乎一样（没被盖住的书页）或只是变暗的书页，从边上剔掉；
        trim = (yy >= EDGE) & ~ref[1] & ((diff < 30) | shade) & ~(navy | white | hair)
        trim &= ~ndimage.binary_erosion(m, iterations=4) & ~sure   # 只修边缘 4px 以内，手不动
        b2 = ndimage.binary_opening(m & ~trim & (yy >= EDGE), iterations=1) | sure
        b2 = ndimage.binary_propagation(seed, mask=b2 | seed) & (yy >= EDGE)
        b2 = (ndimage.binary_closing(b2, iterations=3) & region & (yy >= EDGE)) | sure
        m = ndimage.binary_fill_holes(above | b2) & ~prop
    return m, prop


def inpaint(rgb, hole, known, iters=60):
    """把 hole 里的像素用周围 known 像素的平均颜色一圈圈填进去。"""
    out = rgb.astype(float).copy()
    have = known & ~hole
    todo = hole.copy()
    k = np.ones((3, 3))
    for _ in range(iters):
        if not todo.any():
            break
        s = np.stack([ndimage.convolve(out[..., c] * have, k, mode='constant') for c in range(3)], -1)
        cnt = ndimage.convolve(have.astype(float), k, mode='constant')
        ring = todo & (cnt > 0)
        out[ring] = s[ring] / cnt[ring][:, None]
        have |= ring
        todo &= ~ring
    return out


def shadow(mask_below, shape):
    sh = np.zeros(shape, float)
    sh[mask_below] = 1
    sh = ndimage.shift(sh, (7, 5), order=0)
    sh = ndimage.gaussian_filter(sh, 6)
    return np.clip(sh * 0.55, 0, 0.55)


def main():
    debug = None
    if '--debug' in sys.argv:
        debug = Path(sys.argv[sys.argv.index('--debug') + 1])
        debug.mkdir(parents=True, exist_ok=True)
    imgs = {k: np.asarray(Image.open(DIR / f'combo-{k}.png').convert('RGBA')) for k in KEYS}
    masks = {}
    props = np.zeros(imgs['happy'].shape[:2], bool)
    for key in ('happy',) + tuple(k for k in KEYS if k != 'happy'):
        a = imgs[key]
        m, prop = char_mask(key, a, None if key == 'happy' else (imgs['happy'], masks['happy']))
        masks[key] = m
        props |= prop
        h, w = m.shape
        yy = np.arange(h)[:, None] * np.ones((1, w), int)
        rgb = a[..., :3].astype(float)
        # 挖掉的物件处用头发颜色补一圈（前景物件层会盖住，补的是防止错位时露出背景）
        _, _, _, hair = colors(a)
        # 只补紧贴头发的 3px，不往外长出色块；其余挖空处由前景物件层（羽毛笔、墨水瓶）盖住
        fillin = prop & ndimage.binary_dilation(hair & m, iterations=3)
        rgb = inpaint(rgb, fillin, m & ~prop)
        m = m | fillin
        soft = ndimage.gaussian_filter(m.astype(float), 0.7)
        alpha = np.clip(soft, 0, 1) * np.where(fillin, 255, a[..., 3])
        # 接触阴影：只在人物外面
        below = m & (yy >= EDGE)
        sh = shadow(below, m.shape) * (1 - np.clip(soft, 0, 1)) * (yy >= EDGE)
        out = np.zeros((h, w, 4), float)
        ca = alpha / 255
        oa = ca + sh * (1 - ca)
        shadow_rgb = np.array([40, 22, 18], float)
        out[..., :3] = (rgb * ca[..., None] + shadow_rgb * (sh * (1 - ca))[..., None]) / np.maximum(oa, 1e-6)[..., None]
        out[..., 3] = oa * 255
        Image.fromarray(np.clip(out, 0, 255).astype('uint8')).save(DIR / f'char-{key}.png', optimize=True)
        print('wrote', DIR / f'char-{key}.png')
        if debug:
            im = Image.fromarray(a).convert('RGBA')
            over = np.asarray(im).copy()
            edge = m ^ ndimage.binary_erosion(m)
            over[edge] = (255, 0, 0, 255)
            over[prop] = (over[prop] * 0.4 + np.array([0, 255, 0, 255]) * 0.6).astype('uint8')
            Image.fromarray(over).save(debug / f'mask-{key}.png')
    desk_layers(props, sys.argv[sys.argv.index('--desk') + 1] if '--desk' in sys.argv else None)


def desk_layers(props, src=None):
    """固定书桌：--desk 给出 GPT 原图（1405×1120）时裁成 x 250–1250 存为 desk-fixed.png；
    再从中切出羽毛笔、墨水瓶（人物层挖掉的地方，外扩 2px）存为 desk-front.png，叠在人物层上面。"""
    if src:
        d = Image.open(src).convert('RGBA')
        if d.size != (1405, 1120):
            raise SystemExit(f'desk 尺寸应为 1405×1120，实际 {d.size}')
        a = np.asarray(d.crop((X0, 0, X0 + 1000, 1120))).copy()
        a[..., 3] = np.where(a[..., 3] >= 240, 255, a[..., 3])   # GPT 给的主体 alpha 是 245–254
        Image.fromarray(a).save(DIR / 'desk-fixed.png', optimize=True)
        print('wrote', DIR / 'desk-fixed.png')
    path = DIR / 'desk-fixed.png'
    if not path.exists():
        return
    a = np.asarray(Image.open(path).convert('RGBA')).copy()
    xx = np.arange(a.shape[1])[None, :] + X0
    front = ndimage.binary_dilation(props, iterations=2) & (xx >= PROP_BOX[0][0])
    a[..., 3] = np.where(front, a[..., 3], 0)
    a[~front] = 0
    Image.fromarray(a).save(DIR / 'desk-front.png', optimize=True)
    print('wrote', DIR / 'desk-front.png')


if __name__ == '__main__':
    main()
