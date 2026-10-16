import sys, glob, os
from PIL import Image, ImageDraw
files = sorted(glob.glob(sys.argv[1]))
W=480
ims=[]
for f in files:
    im=Image.open(f).convert('RGB'); im.thumbnail((W,W)); ims.append((os.path.basename(f),im))
cols=3; rows=(len(ims)+cols-1)//cols
H=max(i.size[1] for _,i in ims)+20
out=Image.new('RGB',(cols*W,rows*H),'white'); d=ImageDraw.Draw(out)
for k,(n,im) in enumerate(ims):
    x=(k%cols)*W; y=(k//cols)*H; out.paste(im,(x,y+20)); d.text((x+4,y+4),n,fill='black')
out.save(sys.argv[2])
