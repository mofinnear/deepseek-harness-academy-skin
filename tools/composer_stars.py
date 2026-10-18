#!/usr/bin/env python3
"""
把输入框胶囊边框 composer-frame-v2.png 拆成「干净边框 + 两端大星」，让输入框变高时花饰不跟着放大。

原图两端的大星（连同旁边两颗小星）压在半圆弧线正中，九宫格只能把整个端盖按输入框高度缩放；
输入框一高，花饰就跟着放大好几倍。拆开以后：
  - composer-frame-v3.png：两端星饰处的弧线补齐（按扇区边界处的弧线截面重画），中间那一行正好是弧线的竖直切点，
    九宫格切片取 176 / 177，输入框变高时这一行拉成左右两条竖直金线；
  - composer-star-left.png / composer-star-right.png：两端大星和小星，去掉背后的弧线，
    以原图 y=177（整张图的竖直中心）为中心裁出，CSS 把它们固定在输入框左右两侧的竖直中心。
用法：python3 tools/composer_stars.py
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image

UI = Path(__file__).resolve().parent.parent / 'assets' / 'ui'
SRC = UI / 'composer-frame-v2.png'

CX, CY, R = 212.0, 178.0, 143.0   # 左端弧线圆心与半径（拟合可见弧段得到，右端对称）
UP, LOW = 33.0, -37.0             # 星饰所在扇区（相对水平向左，向上为正），扇区外的弧线是干净的
RING = (128.0, 158.0)             # 弧线所在的半径范围
AXIS_ROWS = (165, 199)            # 量大星竖直对称轴用的行：上下小星之间，左右两边都没有弧线
CROP_W, CROP_Y0, CROP_Y1 = 170, 97, 257  # 星饰裁切范围，竖直中心 177 = 整张图的中心


def bilinear(img, x, y):
    """img: H×W×4 float；x、y 为同形数组。"""
    x0 = np.clip(np.floor(x).astype(int), 0, img.shape[1] - 2)
    y0 = np.clip(np.floor(y).astype(int), 0, img.shape[0] - 2)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    top = img[y0, x0] * (1 - fx) + img[y0, x0 + 1] * fx
    bottom = img[y0 + 1, x0] * (1 - fx) + img[y0 + 1, x0 + 1] * fx
    return top * (1 - fy) + bottom * fy


def profile(img, deg, radii):
    """沿某个角度取弧线截面（预乘透明度后取 ±1° 的平均，避免单条采样的噪点）。"""
    acc = np.zeros((len(radii), 4))
    for d in (deg - 1, deg, deg + 1):
        t = math.radians(d)
        x = CX - radii * math.cos(t)
        y = CY - radii * math.sin(t)
        px = bilinear(img, x, y)
        px[:, :3] *= px[:, 3:] / 255
        acc += px
    return acc / 3


def split_left(img):
    """处理左端；返回（干净边框，星饰图）。"""
    h, w, _ = img.shape
    ys, xs = np.mgrid[0:h, 0:w].astype(float)
    dx, dy = CX - xs, CY - ys
    rad = np.hypot(dx, dy)
    ang = np.degrees(np.arctan2(dy, dx))
    sector = (xs < CX) & (ang < UP) & (ang > LOW)

    radii = np.arange(RING[0], RING[1] + 1.0)
    up, low = profile(img, UP + 1, radii), profile(img, LOW - 1, radii)
    t = np.clip((UP - ang) / (UP - LOW), 0, 1)[..., None]
    ri = np.clip(rad - RING[0], 0, len(radii) - 1.001)
    i0 = np.floor(ri).astype(int)
    f = (ri - i0)[..., None]
    a = up[i0] * (1 - f) + up[i0 + 1] * f
    b = low[i0] * (1 - f) + low[i0 + 1] * f
    arc = a * (1 - t) + b * t
    arc[(rad < RING[0]) | (rad > RING[1])] = 0
    alpha = arc[..., 3:]
    arc[..., :3] = np.where(alpha > 0, arc[..., :3] * 255 / np.maximum(alpha, 1e-6), 0)

    frame = img.copy()
    frame[sector] = arc[sector]

    # 大星左右对称，靠弧线的一侧（对称轴以右）在弧线范围内的部分不能直接用：弧线紧贴着上下两个尖角。
    # 左半边背后没有弧线，把它的透明度按对称轴镜像过来当右半边的轮廓，描边和抗锯齿都按原图。
    alpha = img[..., 3]
    centers = []
    for y in range(*AXIS_ROWS):
        opaque = np.where(alpha[y, :150] > 128)[0]
        left = opaque[0] - alpha[y, opaque[0] - 1] / 255
        right = opaque[-1] + alpha[y, opaque[-1] + 1] / 255
        centers.append((left + right) / 2)
    axis = float(np.median(centers))
    mirror = bilinear(img, 2 * axis - xs, ys)[..., 3]
    in_ring = (rad >= RING[0]) & (rad <= RING[1])
    star = img.copy()
    star[..., 3] = np.where(sector, np.where(in_ring & (xs > axis), np.minimum(alpha, mirror), alpha), 0)
    return frame, star[CROP_Y0:CROP_Y1, :CROP_W]


def main():
    img = np.asarray(Image.open(SRC).convert('RGBA')).astype(float)
    frame, left = split_left(img)
    flipped, right = split_left(frame[:, ::-1].copy())
    frame = flipped[:, ::-1]
    right = right[:, ::-1]
    save = lambda arr, name: Image.fromarray(np.clip(np.rint(arr), 0, 255).astype('uint8')).save(UI / name, optimize=True)
    save(frame, 'composer-frame-v3.png')
    save(left, 'composer-star-left.png')
    save(right, 'composer-star-right.png')
    print('wrote composer-frame-v3.png', frame.shape[1::-1], 'and composer-star-left/right.png', left.shape[1::-1])


if __name__ == '__main__':
    main()
