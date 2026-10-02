import sys; import numpy as np; from PIL import Image
o=np.array(Image.open(sys.argv[1]).convert('RGBA')).astype(float)
n=np.array(Image.open(sys.argv[2]).convert('RGBA')).astype(float)
r=np.array(Image.open(sys.argv[3]).convert('RGBA'))
H,W=o.shape[:2]; A=np.zeros((H,W)); A[:1312,400:1599]=r[...,3]/255
ao,an=o[...,3]>128,n[...,3]>128; print('IoU',round((ao&an).sum()/(ao|an).sum(),4))
print('脸部平均差',round(np.abs(o-n)[150:650,650:1250,:3].mean(),2))
lum=lambda a:a[...,:3]@[.299,.587,.114]
# 手臂正下方 30px 桌面
bottom=np.array([ (np.where(A[:1376,x]>.5)[0].max() if (A[:1376,x]>.5).any() else -1) for x in range(W)])
cols=np.where(bottom>=1150)[0]
m=np.zeros((H,W),bool)
for x in cols: m[bottom[x]+3:bottom[x]+33,x]=True
m&=(A<.05)
print('手臂下方桌面亮度 原/新',round(lum(o)[m].mean(),1),round(lum(n)[m].mean(),1),'降低',f'{(1-lum(n)[m].mean()/lum(o)[m].mean())*100:.0f}%')
# 白色袖口靠桌处（贴桌 60px 内、原图很白的角色像素）
near=np.zeros((H,W),bool)
for x in cols: near[max(bottom[x]-60,0):bottom[x]+1,x]=True
w=near&(A>.9)&(o[...,:3].min(-1)>200)
print('靠桌白色像素数',w.sum(),'原最亮',int(lum(o)[w].max()) if w.any() else '-','新最亮(99分位)',int(np.percentile(lum(n)[w],99)) if w.any() else '-','新平均/原平均',round(lum(n)[w].mean()/lum(o)[w].mean(),2) if w.any() else '-')
ch=A>.9; L_=lum(n); cx=1000
print('角色左/右半边平均亮度',round(L_[ch&(np.arange(W)[None,:]<cx)].mean(),1),round(L_[ch&(np.arange(W)[None,:]>=cx)].mean(),1),'| 原图',round(lum(o)[ch&(np.arange(W)[None,:]<cx)].mean(),1),round(lum(o)[ch&(np.arange(W)[None,:]>=cx)].mean(),1))
d=n[...,3][(n[...,3]>0)&(A<.05)&(np.arange(H)[:,None]>1150)]; print('书桌 alpha 248-254 像素数',((d>=248)&(d<255)).sum())
