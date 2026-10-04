#!/usr/bin/env python3
"""
第九步「固定书桌 + 人物层」的素材生成。

人物层：直接用 relit3 立绘，保持原始分辨率 2398×2624（立绘坐标 1199×1312 的 2 倍；打包时按 logo.config.json 的 maxPx 缩），
放到固定书桌上：桌面后沿以上全部保留；以下去掉身体两侧垂下的头发（只去和两侧头发连通的部分，衬衫上偏蓝的阴影、
好奇表情的蓝色笔杆不动），手臂和手压在桌上。人物贴近桌面的部分按到下沿的距离乘一个偏肉色的阴影色，桌面投影程序生成（贴边一层 + 右下柔和投影，偏肉色，正片叠底），画布底部多留 PAD px 给阴影。
输出 assets/combo/char-*.png（2398×2704）、shadow-*.png（桌面投影，1199×1352，页面里正片叠底）和 thumb-*.png（256×256，同一个头部框）。

书桌：--desk 给出 GPT 交付的固定书桌（1405×1120）时，裁出合成图坐标 x 250–1250 存为 desk-fixed.png（alpha ≥ 240 改成 255），
并切出羽毛笔和墨水瓶所在的矩形存为 desk-front.png，叠在人物层上面（这块和下面的书桌像素相同，只有盖住头发的地方看得出来）。

坐标：下面的常量都是立绘坐标（1199×1312），按 S 倍换算到 relit3 原图。立绘坐标 p 和合成图坐标 c（1000×1120，即 round14 x 250–1250）
的关系是 c = (FIG_X, FIG_Y) + FIG_K × p（FIG_K = 0.465 × FIG_SCALE），
和 round14 合成图里人物的位置、大小一致（skin.css 合成图段按这个换算）。
用法：python3 tools/char_layers.py --src <素材目录>/round6/relit3 [--override <素材目录>/round16] [--desk <素材目录>/round15/desk-fixed.png] [--debug <目录>]
（--override 目录里有同名立绘时优先用它，没有的仍用 --src）
给 GPT 画光影的输入图：python3 tools/char_layers.py --src … --desk <round15/desk-fixed.png> --compose <素材目录>/round17/输入
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

DIR = Path(__file__).resolve().parent.parent / 'assets' / 'combo'
SOURCES = {'default': 'academy-maid-pensive', 'happy': 'expr-happy', 'curious': 'expr-curious', 'wink': 'expr-wink'}
S = 2                # relit3 是立绘坐标的 2 倍
W, H, PAD = 1199 * S, 1312 * S, 40 * S

RAMP = 6 * S         # 去头发时从桌沿往下 6px 过渡
# 两侧垂下的头发：以前在桌沿以下去掉，结果左边头发在桌沿处被横着切平（用户反馈）。现在不去，让头发自然搭在桌面和后面那本书上（和 round14 一样）
CUT_SIDE_HAIR = False
SIDE_L, SIDE_R = 150 * S, 960 * S   # 桌沿以下，这两条线外侧的头发是「两侧垂下的头发」，从这里开始找连通的头发
# 漫画式阴影：不是盖黑，而是在底色上乘一个偏肉色的暖色（正片叠底），越深的地方越接近乘满这个颜色
AO_LEN, AO_TOP = 16 * S, 10 * S             # 人物贴桌部分：约 16px 衰减，从桌沿上方 10px 开始
AO_TINT = (0.93, 0.80, 0.80)                 # 乘满时：肤色 (250,215,195) → 约 (232,172,156)，白袖口变成浅粉灰
SHADOW_TINT = (214, 160, 150)                # 桌面投影的乘色（页面里 mix-blend-mode: multiply），米色书页上约 (206,160,136)
SHADOW_MAX = 0.75
THUMB_BOX = tuple(v * S for v in (34, 77, 944, 987))   # 头部框，和以前合成图缩略图的框是同一处
FRONT_BOX = (634, 330, 760, 615)  # 羽毛笔和墨水瓶所在范围（合成图坐标）
# 墨水瓶轮廓和插进瓶口的那段笔杆（书桌原图 1405 宽坐标；固定书桌不变，所以用固定多边形）。
# 前景层只取物件本身：以前取整个矩形，角色右移后矩形里的木纹会盖住袖子和头发（竖着切一刀）
INKWELL = [(906, 527), (912, 523), (925, 522), (940, 522), (947, 526), (946, 534), (941, 540), (951, 543), (959, 548),
           (964, 556), (964, 576), (968, 584), (967, 592), (958, 599), (940, 601), (905, 601), (887, 597), (883, 590),
           (886, 583), (889, 576), (890, 556), (895, 547), (904, 543), (909, 540), (906, 534)]
QUILL_SHAFT = [(925, 504), (946, 504), (938, 527), (926, 527)]
# 角色在书桌上的摆放（只改这三个数；陪伴栏的 skin.css 合成图段要按同样的数换算，见那里的注释）
FIG_X, FIG_Y = 230, -17   # 立绘左上角在合成图里的位置。round14 是 (174, −3)；relit3 的身体比 round14 长约 25px，
                          # 放在 −3 时腰和衬衫下摆露在桌面上、像从桌子里长出来（用户反馈），上提 25px
FIG_SCALE = 0.96           # 角色相对 round14 的缩放（1.0 = 立绘坐标 × 0.465）
FIG_K = 0.465 * FIG_SCALE # 立绘坐标 → 合成图坐标
DESK_BACK = 515           # 固定书桌桌面后沿（合成图坐标）
EDGE = round(((DESK_BACK - FIG_Y) / FIG_K + 3) * S)   # 桌面后沿换成立绘坐标（relit3 原图），加 3px 余量
CANVAS_DY = 27             # 只用于给 GPT 的输入图：整张画面往下移的像素（角色上提后呆毛会超出画布顶部）


def char_layer(src, shade=True):
    im = Image.open(src).convert('RGBA')
    if im.size != (W, H):
        im = im.resize((W, H), Image.LANCZOS)
    a = np.zeros((H + PAD, W, 4), float)
    a[:H] = np.asarray(im).astype(float)
    a[..., 3] = np.where(a[..., 3] >= 240, 255, a[..., 3])   # relit3 主体 alpha 是 250–254
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    yy = np.arange(H + PAD)[:, None] * np.ones((1, W), int)
    xx = np.arange(W)[None, :] * np.ones((H + PAD, 1), int)
    hair = (((b > 110) & (b - r > 45) & (b - g > 15)) | ((b > 170) & (b - r > 28) & (b >= g))) & (a[..., 3] > 20)
    low = yy >= EDGE
    if CUT_SIDE_HAIR:
        seed = hair & low & ((xx < SIDE_L) | (xx > SIDE_R))
        side = ndimage.binary_propagation(seed, mask=hair & low)
        side = ndimage.gaussian_filter(ndimage.binary_dilation(side, iterations=1).astype(float), 0.8)
        ramp = np.clip((yy - EDGE) / RAMP, 0, 1)
        a[..., 3] *= 1 - side * ramp
    if not shade:   # 给 GPT 的输入图：不加我们的阴影
        return Image.fromarray(np.clip(a, 0, 255).astype('uint8')), None
    al = a[..., 3] / 255
    body = (al > 0.5) & (yy >= EDGE - AO_TOP)
    # 环境遮蔽：人物贴近桌面的部分（袖子下沿、袖口、手腕、手的下侧）被桌面挡光，按「往下到人物下沿的距离」压暗，
    # 越靠近下沿越暗，并略偏暖（桌面反光）。往下逐行累计距离。
    down = np.zeros((H + PAD, W), float)
    for y in range(H + PAD - 2, EDGE - AO_TOP - 1, -1):
        down[y] = np.where(body[y], down[y + 1] + 1, 0)
    ao = np.exp(-down / AO_LEN) * body
    ao *= np.clip((yy - (EDGE - AO_TOP)) / AO_TOP, 0, 1)    # 桌沿上方渐入
    ao = ndimage.gaussian_filter(ao, 1.5 * S)
    a[..., :3] *= 1 - ao[..., None] * (1 - np.array(AO_TINT))
    # 桌面投影：桌沿以下的人物轮廓投在桌面/书页上（贴边一层窄而实，再加右下柔和投影），单独输出，
    # 页面里用正片叠底叠在书桌上；人物身上不画（乘以 1 − 人物不透明度）
    al = a[..., 3] / 255
    low_body = ((al > 0.5) & low).astype(float)
    contact = ndimage.gaussian_filter(ndimage.shift(low_body, (3 * S, 1 * S), order=0), 3 * S) * 0.9
    soft = ndimage.gaussian_filter(ndimage.shift(low_body, (12 * S, 8 * S), order=0), 12 * S) * 0.5
    sh = np.clip(1 - (1 - contact) * (1 - soft), 0, 1) * SHADOW_MAX * (1 - al) * low
    shadow = np.zeros((H + PAD, W, 4), float)
    shadow[..., :3] = SHADOW_TINT
    shadow[..., 3] = sh * 255
    layer = Image.fromarray(np.clip(a, 0, 255).astype('uint8'))
    shadow = Image.fromarray(shadow.astype('uint8')).resize((W // S, (H + PAD) // S), Image.LANCZOS)   # 模糊的，半分辨率就够
    return layer, shadow


def front_mask(full):
    """羽毛笔 + 墨水瓶的形状（书桌原图 1405×1120 坐标）。羽毛笔：桌面后沿以上书桌图里不透明的部分
    （去掉后沿那条细边）；墨水瓶和瓶口笔杆：固定多边形。"""
    a = np.asarray(full)[..., 3]
    h, w = a.shape
    yy = np.arange(h)[:, None] * np.ones((1, w), int)
    xx = np.arange(w)[None, :] * np.ones((h, 1), int)
    x1, y1, x2, y2 = FRONT_BOX
    box = (xx >= x1 + 250) & (xx < x2 + 250) & (yy >= y1) & (yy < y2)
    quill = (a > 20) & (yy < DESK_BACK - 3) & box
    quill = ndimage.binary_propagation(ndimage.binary_opening(quill, iterations=3), mask=quill)
    poly = Image.new('L', (w, h), 0)
    for pts in (INKWELL, QUILL_SHAFT):
        ImageDraw.Draw(poly).polygon(pts, fill=255)
    m = quill | (np.asarray(poly) > 0)
    return ndimage.gaussian_filter(m.astype(float), 0.6)   # 软边，0–1


def front_layer(full):
    a = np.asarray(full).astype(float).copy()
    a[..., 3] *= front_mask(full)
    return Image.fromarray(a.astype('uint8'))


def desk_layers(src):
    d = Image.open(src).convert('RGBA')
    if d.size != (1405, 1120):
        raise SystemExit(f'desk 尺寸应为 1405×1120，实际 {d.size}')
    a = np.asarray(d).copy()
    a[..., 3] = np.where(a[..., 3] >= 240, 255, a[..., 3])   # GPT 给的主体 alpha 是 245–254
    full = Image.fromarray(a)
    full.crop((250, 0, 1250, 1120)).save(DIR / 'desk-fixed.png', optimize=True)
    front_layer(full).crop((250, 0, 1250, 1120)).save(DIR / 'desk-front.png', optimize=True)
    print('wrote', DIR / 'desk-fixed.png', DIR / 'desk-front.png')


def compose_inputs(src, override, desk, out):
    """给 GPT 画光影用的输入图：固定书桌整张（1405×1120）+ relit3 角色（不加阴影）+ 羽毛笔墨水瓶，
    和 round14 合成图同一坐标（角色缩放 FIG_K / S，左上角 (FIG_X + 250, FIG_Y)），整张再往下移 CANVAS_DY。
    同时输出角色蒙版（白 = 角色，同样下移）。"""
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    full = Image.open(desk).convert('RGBA')
    fa = np.asarray(full).copy()
    fa[..., 3] = np.where(fa[..., 3] >= 240, 255, fa[..., 3])
    full = Image.fromarray(fa)
    front = front_layer(full)
    for key, name in SOURCES.items():
        path = Path(src) / f'{name}.png'
        if override and (Path(override) / f'{name}.png').exists():
            path = Path(override) / f'{name}.png'
        layer, _ = char_layer(path, shade=False)
        small = layer.resize((round(W * FIG_K / S), round((H + PAD) * FIG_K / S)), Image.LANCZOS)
        fig = Image.new('RGBA', full.size, (0, 0, 0, 0))
        fig.paste(small, (FIG_X + 250, FIG_Y + CANVAS_DY), small)
        img = Image.new('RGBA', full.size, (0, 0, 0, 0))
        img.alpha_composite(full.crop((0, 0, full.width, full.height - CANVAS_DY)), (0, CANVAS_DY))
        img.alpha_composite(fig)
        img.alpha_composite(front.crop((0, 0, full.width, full.height - CANVAS_DY)), (0, CANVAS_DY))
        img.save(out / f'compose-{key}.png')
        mask = np.asarray(fig)[..., 3]
        Image.fromarray(np.where(mask > 128, 255, 0).astype('uint8')).save(out / f'mask-{key}.png')
        print('wrote', out / f'compose-{key}.png', out / f'mask-{key}.png')


def main():
    args = sys.argv[1:]
    opt = lambda name: args[args.index(name) + 1] if name in args else None
    src, desk, debug, override = opt('--src'), opt('--desk'), opt('--debug'), opt('--override')
    if '--compose' in args:
        compose_inputs(src, override, desk, opt('--compose'))
        return
    if desk:
        desk_layers(desk)
    if not src:
        return
    for key, name in SOURCES.items():
        path = Path(src) / f'{name}.png'
        if override and (Path(override) / f'{name}.png').exists():
            path = Path(override) / f'{name}.png'   # 例如 GPT 改过手的那几张（round16）
        print('source', path.name, '<-', path.parent.name)
        layer, shadow = char_layer(path)
        layer.save(DIR / f'char-{key}.png', optimize=True)
        shadow.save(DIR / f'shadow-{key}.png', optimize=True)
        layer.crop(THUMB_BOX).resize((256, 256), Image.LANCZOS).save(DIR / f'thumb-{key}.png', optimize=True)
        print('wrote', DIR / f'char-{key}.png', DIR / f'thumb-{key}.png')
        if debug:
            # 预览：按合成图坐标叠到固定书桌上
            Path(debug).mkdir(parents=True, exist_ok=True)
            base = Image.new('RGBA', (1000, 1120), (225, 228, 235, 255))
            base.alpha_composite(Image.open(DIR / 'desk-fixed.png'))
            size = (round(W * FIG_K / S), round((H + PAD) * FIG_K / S))
            sh = Image.new('RGBA', base.size, (0, 0, 0, 0))
            small = shadow.resize(size, Image.LANCZOS)
            sh.paste(small, (FIG_X, FIG_Y), small)
            k = np.asarray(sh).astype(float)
            b = np.asarray(base).astype(float)
            b[..., :3] *= 1 - k[..., 3:] / 255 * (1 - k[..., :3] / 255)   # 正片叠底
            base = Image.fromarray(b.astype('uint8'))
            small = layer.resize(size, Image.LANCZOS)
            top = Image.new('RGBA', base.size, (0, 0, 0, 0))
            top.paste(small, (FIG_X, FIG_Y), small)
            base.alpha_composite(top)
            base.alpha_composite(Image.open(DIR / 'desk-front.png'))
            base.save(Path(debug) / f'preview-{key}.png')


if __name__ == '__main__':
    main()
