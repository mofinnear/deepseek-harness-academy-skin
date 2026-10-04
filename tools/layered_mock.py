from PIL import Image, ImageFilter
import numpy as np, sys
AS=sys.argv[1].rstrip('/')+'/'   # <素材目录>（旧的拼合草稿工具，已不再使用）
A=AS+'round6/relit3/'
desk=Image.open(AS+'desk3.png').convert('RGBA')
BACK=472
k=2.08; dk=desk.resize((int(desk.width*k),int(desk.height*k)),Image.LANCZOS)
TOP=140; edge=TOP+int(BACK*k); E=1110
PROTECT={'expr-curious':[(300,1130,680,1280)]}
def char(name):
    c=Image.open(A+name+'.png').convert('RGBA').resize((1199,1312),Image.LANCZOS)
    a=np.asarray(c).astype(float); R,G,B=a[...,0],a[...,1],a[...,2]
    a[...,3]=np.where(a[...,3]>=240,255,a[...,3])
    hair=(B>130)&(B-R>60)&(B-G>25)
    light=(B>170)&(B-R>28)&(B>=G); light[:,330:760]=False
    hair|=light
    for x0,y0,x1,y1 in PROTECT.get(name,[]): hair[y0:y1,x0:x1]=False
    hide=np.zeros(hair.shape,bool); hide[E:]=hair[E:]
    if name=='expr-happy': hide[E:,425:640]=True
    m=Image.fromarray((hide*255).astype('uint8')).filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.5))
    a[...,3]*=1-np.asarray(m)/255
    return Image.fromarray(a.astype('uint8'))
outs={}
for name in ['academy-maid-pensive','expr-happy','expr-curious','expr-wink']:
    ch=char(name)
    x0=dk.width//2-640; y0=edge-E
    canvas=Image.new('RGBA',(dk.width,dk.height+TOP),(225,228,235,255)); canvas.alpha_composite(dk,(0,TOP))
    al=np.asarray(ch)[...,3].copy(); al[:E]=0
    sh=Image.fromarray((al*0.45).astype('uint8')).filter(ImageFilter.GaussianBlur(10))
    shadow=Image.new('RGBA',ch.size,(30,20,35,0)); shadow.putalpha(sh)
    canvas.alpha_composite(shadow,(x0+10,y0+16)); canvas.alpha_composite(ch,(x0,y0))
    outs[name]=canvas
    canvas.save(f'm-{name}.png')
W,H=outs['expr-happy'].size
s=Image.new('RGB',(1410,1290),'white')
for i,(n,c) in enumerate(outs.items()):
    t=c.crop((600,0,2350,1600)).convert('RGB').resize((700,640)); s.paste(t,((i%2)*710,(i//2)*650))
s.save(sys.argv[2] if len(sys.argv) > 2 else '拼合草稿-desk3.png')
full=outs['academy-maid-pensive'].convert('RGB'); full.thumbnail((1400,1400)); full.save('m-full.png')
