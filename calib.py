# Renders calibration composites: each view with its quads outlined and a warped "YOUR LOGO" panel.
import json, sys, os
from PIL import Image, ImageDraw, ImageFont
here = os.path.dirname(os.path.abspath(__file__))
q = json.loads(open(os.path.join(here,'quads.js')).read().split('= ',1)[1].rstrip().rstrip(';'))
views = {'front34':'hero-34.jpg','front':'front.jpg','side-l':'side.jpg','side-r':'side.jpg','rear34':'rear-34.jpg','rear':'rear.jpg'}
q['side-r'] = {{'door-fl':'door-fr','door-rl':'door-rr'}[k]: [[1792-p[0],p[1]] for p in [v[1],v[0],v[3],v[2]]] for k,v in q['side-l'].items()}
out = sys.argv[1] if len(sys.argv)>1 else os.path.join(here,'..','calib-out')
os.makedirs(out, exist_ok=True)
try: font = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 36)
except: font = ImageFont.load_default()
for vid, fn in views.items():
    im = Image.open(os.path.join(here,'cars',fn)).convert('RGBA')
    if vid=='side-r': im = im.transpose(Image.FLIP_LEFT_RIGHT)
    for sid, quad in q[vid].items():
        # warped label panel
        W,H = 600, 240
        panel = Image.new('RGBA',(W,H),(0,0,0,0))
        pd = ImageDraw.Draw(panel)
        pd.rectangle([6,6,W-6,H-6], outline=(214,76,30,255), width=10)
        pd.text((W/2,H/2), sid.upper(), fill=(20,19,17,230), font=ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 90), anchor='mm')
        # PIL QUAD transform takes dest-size and source quad; we want the inverse: use Image.transform with PERSPECTIVE coefficients
        import numpy as np
        def coeffs(src, dst):
            A=[]; 
            for (x,y),(u,v) in zip(src,dst):
                A.append([x,y,1,0,0,0,-u*x,-u*y]); A.append([0,0,0,x,y,1,-v*x,-v*y])
            A=np.array(A,dtype=float); b=np.array([c for p in dst for c in p],dtype=float)
            return np.linalg.solve(A,b)
        TL,TR,BR,BL = quad
        # map output image coords -> panel coords: need coefficients from dst(quad) to src(panel)
        c = coeffs(quad, [(0,0),(W,0),(W,H),(0,H)])
        warped = panel.transform(im.size, Image.PERSPECTIVE, tuple(c), Image.BICUBIC)
        im = Image.alpha_composite(im, warped)
        d = ImageDraw.Draw(im)
        for i,p in enumerate(quad):
            d.ellipse([p[0]-7,p[1]-7,p[0]+7,p[1]+7], fill=(31,95,214,255))
    # grid every 100px for reading coordinates
    d = ImageDraw.Draw(im)
    for x in range(0,1792,100):
        d.line([(x,0),(x,1008)], fill=(0,0,0,40)); d.text((x+3,3), str(x), fill=(0,0,0,160), font=font)
    for y in range(0,1008,100):
        d.line([(0,y),(1792,y)], fill=(0,0,0,40)); d.text((3,y+3), str(y), fill=(0,0,0,160), font=font)
    im.convert('RGB').save(os.path.join(out, vid+'.jpg'), quality=88)
print('wrote', out)
