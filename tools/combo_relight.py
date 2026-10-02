"""角色 + 书桌合成图重新打光：光源在左侧偏左后方。
1) 角色靠近桌面的部分（手臂、袖子、手、白色袖口、衣服下沿）按离桌面的距离变暗，暗部偏冷蓝紫；
2) 画面右侧（远离光源）整体渐暗，脸部区域保护；
3) 桌面上角色附近变暗：接触暗线 + 近处软影 + 向右前方的大投影 + 淡倒影；
4) 书桌不透明区域 alpha 统一为 255。
用法: python3 relight.py <combo.png> <立绘.png> <输出.png>"""
import sys; import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
X0, TOP, FRONT = 400, 1150, 1376
src, relit, out = sys.argv[1:4]
im = np.array(Image.open(src).convert('RGBA')).astype(float)
H, W = im.shape[:2]
r = np.array(Image.open(relit).convert('RGBA'))
A = np.zeros((H, W)); A[:r.shape[0], X0:X0 + r.shape[1]] = r[..., 3] / 255
ys, xs = np.mgrid[0:H, 0:W]
def blur(a, s): return ndi.gaussian_filter(a, s)
def shift(a, dx, dy):
    b = np.zeros_like(a); b[dy:, dx:] = a[:H - dy, :W - dx]; return b
SH = np.array([0.50, 0.52, 0.70])          # 冷蓝紫暗部（乘法色）
def shade(f):                               # f: 0..1 的暗度 → 每通道乘数
    return 1 - f[..., None] * (1 - SH)

# ---------- 角色本身 ----------
deskA = (im[..., 3] / 255) * (1 - A)          # 书桌及物件（不含角色）
deskTop = deskA * (ys >= TOP - 10)
# 离桌面的距离：桌面像素 → 距离变换
dist = ndi.distance_transform_edt(deskTop < 0.5)
near = np.exp(-dist / 55) * 0.62 + np.exp(-dist / 160) * 0.22   # 贴桌处最暗，向上柔和过渡
# 只影响桌面后沿以下一段距离内的角色（脸不受影响）
near *= np.clip((ys - 900) / 200, 0, 1)
# 角色朝下的面（每列下沿往上）再压暗一点：袖子、手的底面
bottom = np.full(W, -1)
for x in range(W):
    c = np.where(A[:FRONT, x] > 0.5)[0]
    if len(c): bottom[x] = c.max()
under = np.clip(1 - (bottom[None, :] - ys) / 40, 0, 1) * (bottom[None, :] >= TOP) * 0.25
# 画面右侧渐暗（远离光源），保护脸
right = np.clip((xs - 850) / 600, 0, 1) ** 1.1 * 0.40
face = np.exp(-(((xs - 950) / 330) ** 2 + ((ys - 420) / 300) ** 2))
right *= 1 - 0.85 * face
# 胸前衣服下沿：桌面后沿以上 ~250px 内整体渐暗（身体下半部分被桌子挡光）
lower = np.clip((ys - 1010) / 260, 0, 1) * 0.22
f_char = np.clip(near + under + right + lower, 0, 0.78) * A
# 皮肤用偏暖的粉紫暗部，其余用冷蓝紫
R_, G_, B_ = im[..., 0], im[..., 1], im[..., 2]
skin = ((R_ > 190) & (R_ > G_ + 12) & (G_ > B_ - 5) & (B_ > 120)).astype(float)
skin = ndi.gaussian_filter(skin, 1.5)
SH_SKIN = np.array([0.74, 0.58, 0.64])
mult = 1 - f_char[..., None] * (1 - (SH * (1 - skin[..., None]) + SH_SKIN * skin[..., None]))
im[..., :3] *= mult

# ---------- 桌面 ----------
desk_zone = deskA * ((ys >= TOP) & (ys <= FRONT)) * np.clip((FRONT - ys) / 18, 0, 1)
ao   = blur(shift(A, 2, 5), 4)
near_s = blur(shift(A, 12, 14), 14)
cast = blur(shift(A, 60, 40), 45)              # 左后方光 → 影子落向右前方
body = blur(shift(A * (ys < TOP + 200), 30, 60), 70)   # 身体整体挡光，桌面靠近角色处整片变暗
f_desk = np.clip(0.9 * ao + 0.6 * near_s + 0.45 * cast + 0.45 * body, 0, 0.85) * desk_zone
im[..., :3] *= shade(f_desk)
# 淡倒影
rgb = im[..., :3].copy(); refl = np.zeros_like(rgb); ra = np.zeros((H, W)); L = 70
for k in range(1, L):
    cols = np.where((bottom >= TOP - 40) & (bottom + k <= FRONT))[0]
    yd, ysrc = bottom[cols] + k, bottom[cols] - k
    w = A[ysrc, cols] * (1 - k / L) ** 1.6
    refl[yd, cols] = rgb[ysrc, cols]; ra[yd, cols] = np.maximum(ra[yd, cols], w)
ra = blur(ra, 2) * desk_zone * 0.22
for c in range(3): refl[..., c] = blur(refl[..., c], 3)
im[..., :3] = im[..., :3] * (1 - ra[..., None]) + refl * ra[..., None]

a = im[..., 3]; a[a >= 248] = 255
Image.fromarray(im.clip(0, 255).astype(np.uint8)).save(out)
