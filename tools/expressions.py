#!/usr/bin/env python3
"""
表情立绘的自检与缩略图生成（需要 Python 3 + Pillow）。

用法：
  python3 tools/expressions.py check <目录>    严格模式：只允许改脸，其余像素与默认立绘一致
  python3 tools/expressions.py pose <目录>     姿势模式：允许换手势和姿势，但人物大小、头部位置、桌面线要对齐
  python3 tools/expressions.py thumbs <目录>   用同一个裁切框，从四张立绘裁出 256×256 缩略图

<目录> 里应有：expr-happy.png、expr-curious.png、expr-wink.png（新画的三张）。
默认立绘固定取本项目的 assets/academy-maid-pensive.png。

严格模式：画布必须是 1199×1312 RGBA；脸部区域 FACE_BOX 以外，与默认立绘的平均像素差
必须小于 MAX_MEAN_DIFF，且透明轮廓几乎一致。也就是说只能改脸，别的地方都不能动。

姿势模式：画布同上；头部一带（y < HEAD_BAND）的透明轮廓与默认立绘重合度（IoU）不低于
MIN_HEAD_IOU；呆毛顶端在画布顶部 TOP_MAX 以内；桌面线 DESK_ROW 这一行有足够宽的
手臂或身体（≥ MIN_DESK_WIDTH 像素）；人物下沿到达 MIN_BOTTOM 以下。
这样切换表情时头部基本不动，手臂始终落在桌面上，只是动作不同。
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DEFAULT = ROOT / 'assets' / 'academy-maid-pensive.png'
SIZE = (1199, 1312)
# 允许改动的脸部区域（眉、眼、脸颊、嘴），左上 x,y 到右下 x,y，单位是原图像素
FACE_BOX = (260, 380, 720, 760)
MAX_MEAN_DIFF = 4.0      # 脸部以外的 RGBA 平均差（0–255）
MAX_ALPHA_SHIFT = 0.004  # 脸部以外透明轮廓不同的像素占比
# 缩略图裁切框（正方形）：头饰顶部约在 8%，下巴约在 75%
THUMB_BOX = (35, 77, 945, 987)
THUMB_SIZE = 256
HEAD_BAND = 450          # 头部、头饰、呆毛所在的上部区域
MIN_HEAD_IOU = 0.80      # 允许头部轻微歪头，但不能整体挪位或缩放
TOP_MAX = 40             # 呆毛顶端（默认图在 y≈6）
DESK_ROW = 1250          # 桌面线：默认图这一行手臂宽约 790px
MIN_DESK_WIDTH = 500
MIN_BOTTOM = 1270        # 人物下沿（默认图约 1298），会被桌子盖住 26px
NAMES = {
    'expr-default-thumb.png': None,  # None = 默认立绘
    'expr-happy-thumb.png': 'expr-happy.png',
    'expr-curious-thumb.png': 'expr-curious.png',
    'expr-wink-thumb.png': 'expr-wink.png',
}


def outside_face_mask():
    mask = Image.new('L', SIZE, 255)
    ImageDraw.Draw(mask).rectangle(FACE_BOX, fill=0)
    return mask


def check(folder):
    base = Image.open(DEFAULT).convert('RGBA')
    mask = outside_face_mask()
    outside = sum(1 for v in mask.getdata() if v)
    ok = True
    for name in ['expr-happy.png', 'expr-curious.png', 'expr-wink.png']:
        path = folder / name
        if not path.exists():
            print(f'FAIL {name}: 文件不存在')
            ok = False
            continue
        im = Image.open(path)
        problems = []
        if im.size != SIZE:
            problems.append(f'画布 {im.size[0]}×{im.size[1]}，应为 {SIZE[0]}×{SIZE[1]}')
        if im.mode != 'RGBA':
            problems.append(f'模式 {im.mode}，应为 RGBA（透明背景）')
        if not problems:
            diff = ImageChops.difference(im.convert('RGBA'), base)
            channels = [ImageChops.multiply(ch, mask) for ch in diff.split()]
            mean = sum(sum(ch.getdata()) for ch in channels) / (outside * 4)
            alpha_changed = sum(1 for a, b, m in zip(im.getchannel('A').getdata(), base.getchannel('A').getdata(), mask.getdata())
                                if m and abs(a - b) > 32)
            if mean > MAX_MEAN_DIFF:
                problems.append(f'脸部以外平均差 {mean:.1f}（上限 {MAX_MEAN_DIFF}）：姿势、位置或颜色被改动了')
            if alpha_changed / outside > MAX_ALPHA_SHIFT:
                problems.append(f'脸部以外透明轮廓变化 {alpha_changed / outside:.2%}：人物轮廓移动了，或抠图边缘不一致')
        if problems:
            ok = False
            print(f'FAIL {name}')
            for problem in problems:
                print(f'     - {problem}')
        else:
            print(f'ok   {name}')
    print('\n全部通过' if ok else '\n有未通过项：请在默认立绘上只重绘脸部区域 ' + str(FACE_BOX))
    return ok


def pose(folder):
    base = Image.open(DEFAULT).convert('RGBA').getchannel('A')
    base_head = [v > 128 for v in base.crop((0, 0, SIZE[0], HEAD_BAND)).getdata()]
    ok = True
    for name in ['expr-happy.png', 'expr-curious.png', 'expr-wink.png']:
        path = folder / name
        if not path.exists():
            print(f'FAIL {name}: 文件不存在')
            ok = False
            continue
        im = Image.open(path)
        problems = []
        if im.size != SIZE:
            problems.append(f'画布 {im.size[0]}×{im.size[1]}，应为 {SIZE[0]}×{SIZE[1]}')
        if im.mode != 'RGBA':
            problems.append(f'模式 {im.mode}，应为 RGBA（透明背景）')
        if not problems:
            alpha = im.getchannel('A')
            head = [v > 128 for v in alpha.crop((0, 0, SIZE[0], HEAD_BAND)).getdata()]
            inter = sum(1 for a, b in zip(head, base_head) if a and b)
            union = sum(1 for a, b in zip(head, base_head) if a or b)
            iou = inter / union if union else 0
            box = alpha.point(lambda v: 255 if v > 128 else 0).getbbox()
            desk = sum(1 for v in alpha.crop((0, DESK_ROW, SIZE[0], DESK_ROW + 1)).getdata() if v > 128)
            if iou < MIN_HEAD_IOU:
                problems.append(f'头部轮廓重合度 {iou:.2f}（下限 {MIN_HEAD_IOU}）：头的位置或大小和默认图差太多，切换时会跳')
            if not box or box[1] > TOP_MAX:
                problems.append(f'人物顶端在 y={box[1] if box else "?"}（应 ≤ {TOP_MAX}）：人物被缩小或下移了')
            if desk < MIN_DESK_WIDTH:
                problems.append(f'桌面线 y={DESK_ROW} 只有 {desk}px 宽（应 ≥ {MIN_DESK_WIDTH}）：手臂没有落在桌面上')
            if not box or box[3] < MIN_BOTTOM:
                problems.append(f'人物下沿在 y={box[3] if box else "?"}（应 ≥ {MIN_BOTTOM}）：身体要一直延伸到画布底部，被桌子挡住')
            if not problems:
                print(f'ok   {name}  头部重合 {iou:.2f}，桌面线宽 {desk}px')
                continue
        ok = False
        print(f'FAIL {name}')
        for problem in problems:
            print(f'     - {problem}')
    print('\n全部通过' if ok else '\n有未通过项：头部位置和大小保持与默认图一致，前臂落在画布底部的桌面线上')
    return ok


def thumbs(folder):
    for out, source in NAMES.items():
        path = DEFAULT if source is None else folder / source
        if not path.exists():
            print(f'skip {out}: 缺少 {path.name}')
            continue
        im = Image.open(path).convert('RGBA').crop(THUMB_BOX).resize((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
        im.save(folder / out, optimize=True)
        print(f'wrote {folder / out}')


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] not in ('check', 'pose', 'thumbs'):
        print(__doc__)
        sys.exit(2)
    target = Path(sys.argv[2]).expanduser().resolve()
    if sys.argv[1] == 'check':
        sys.exit(0 if check(target) else 1)
    if sys.argv[1] == 'pose':
        sys.exit(0 if pose(target) else 1)
    thumbs(target)
