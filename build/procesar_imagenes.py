import numpy as np, json, sys
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

UP = '/root/.claude/uploads/da9d2706-ce32-5492-87b8-9d6518d7d1ce/'
SRC = {
 'tarjeta':'8d284a03','iconos':'99511134','fichas':'fb49b848',
 'baires':'81c3a780','cruce':'ff000a1b','uspallata':'eb2eca1f','mendoza':'a7afeac2',
 'sierras':'fd0005a2','norte':'b04c7275','santafe':'bca3080c','yapeyu':'2fa5067c','portada':'6510ef66'}
def load(k): return Image.open(UP+SRC[k]+'-image.jpg').convert('RGB')

def frame_crop(im, name):
    a = np.asarray(im).astype(float)
    lum = a.mean(axis=2)
    dark = lum < 95
    H, W = dark.shape
    def first(vals, thr=0.45):
        for i, v in enumerate(vals):
            if v > thr: return i
        return None
    top = first([dark[r, 300:W-300].mean() for r in range(0, 220)])
    bot = first([dark[H-1-r, 300:W-300].mean() for r in range(0, 220)])
    lef = first([dark[300:H-300, c].mean() for c in range(0, 220)])
    rig = first([dark[300:H-300, W-1-c].mean() for c in range(0, 220)])
    print(name, 'frame', top, bot, lef, rig)
    m = 12
    x0, y0 = (lef or 30) + m, (top or 25) + m
    x1, y1 = W - ((rig or 30) + m), H - ((bot or 30) + m)
    inner = im.crop((x0, y0, x1, y1))
    w, h = inner.size
    if w / h > 16 / 9:
        nw = int(h * 16 / 9); ox = (w - nw) // 2
        inner = inner.crop((ox, 0, ox + nw, h))
    else:
        nh = int(w * 9 / 16); oy = (h - nh) // 2
        inner = inner.crop((0, oy, w, oy + nh))
    return inner

for k in ['baires','cruce','uspallata','mendoza','sierras','norte','santafe','yapeyu','portada']:
    im = frame_crop(load(k), k).resize((1280, 720), Image.LANCZOS)
    out = 'assets/escena_%s.webp' % k if k != 'portada' else 'assets/portada.webp'
    im.save(out, 'WEBP', quality=80, method=6)

# tarjeta
t = load('tarjeta'); t = t.resize((1200, int(1200 * t.height / t.width)), Image.LANCZOS)
t.save('assets/tarjeta.webp', 'WEBP', quality=82, method=6)
print('tarjeta', t.size)

def border_bg(arr, vmin, smax):
    mx = arr.max(axis=2).astype(float); mn = arr.min(axis=2).astype(float)
    sat = (mx - mn) / np.maximum(mx, 1)
    cand = (mx >= vmin) & (sat <= smax)
    lab, n = ndi.label(cand)
    edge = set(np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))) - {0}
    return np.isin(lab, list(edge))

def white_panel(arr):
    w = (arr.min(axis=2) > 243)
    rows = np.where(w.mean(axis=1) > 0.4)[0]; cols = np.where(w.mean(axis=0) > 0.4)[0]
    return cols[0], rows[0], cols[-1], rows[-1]

def cutout(im, bg_mask, bbox, scale):
    x0, y0, x1, y1 = bbox
    sub = im.crop((x0, y0, x1, y1)).convert('RGBA')
    m = ~bg_mask[y0:y1, x0:x1]
    m = ndi.binary_erosion(m, iterations=1)
    alpha = Image.fromarray((m * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.1))
    sub.putalpha(alpha)
    return sub.resize((max(1, round(sub.width * scale)), max(1, round(sub.height * scale))), Image.LANCZOS)

# fichas
f = load('fichas'); fa = np.asarray(f)
px0, py0, px1, py1 = white_panel(fa)
pad = 14
fa2 = fa[py0+pad:py1-pad, px0+pad:px1-pad]; f2 = Image.fromarray(fa2)
bg = border_bg(fa2, 178, 0.20)
mn = fa2.min(axis=2)
lab0, n0 = ndi.label((mn >= 238) & ~bg)
for l in range(1, n0 + 1):
    m = lab0 == l
    if m.sum() < 60: continue
    ys, xs = np.where(m)
    if ys.min() >= 560 and fa2[m].mean() >= 249.5:
        bg |= m
fg = ~bg
fg = ndi.binary_opening(fg, iterations=1)
lab, n = ndi.label(ndi.binary_dilation(fg, iterations=9))
objs = ndi.find_objects(lab)
boxes = []
for sl in objs:
    ys, xs = sl
    area = fg[sl].sum()
    if area > 4000: boxes.append((xs.start, ys.start, xs.stop, ys.stop))
boxes.sort(key=lambda b: b[0])
print('fichas encontradas', len(boxes), boxes)
fich_meta = []
for i, b in enumerate(boxes[:5]):
    x0, y0, x1, y1 = [max(0, b[0]-6), max(0, b[1]-6), min(fa2.shape[1], b[2]+6), min(fa2.shape[0], b[3]+6)]
    o = cutout(f2, bg, (x0, y0, x1, y1), 0.40)
    o.save('assets/ficha_%d.png' % i, optimize=True)
    fich_meta.append(list(o.size)); print('ficha', i, o.size)
json.dump(fich_meta, open('assets/fichas_meta.json', 'w'))

# iconos
ic = load('iconos'); ia = np.asarray(ic)
px0, py0, px1, py1 = white_panel(ia)
ia2 = ia[py0+pad:py1-pad, px0+pad:px1-pad]; i2 = Image.fromarray(ia2)
bg2 = border_bg(ia2, 238, 0.06)
lab, n = ndi.label(~bg2)
sizes = ndi.sum(~bg2, lab, range(1, n+1))
big = [i+1 for i, s in enumerate(sizes) if s > 50000]
sq = []
for l in big:
    ys, xs = np.where(lab == l)
    sq.append((xs.min(), ys.min(), xs.max()+1, ys.max()+1))
print('cuadrados', len(sq))
sq.sort(key=lambda b: (round((b[1]+b[3])/2/200), b[0]))
names = ['sello','posta','cordillera','mate','mula','meta']
for nm, b in zip(names, sq):
    x0, y0, x1, y1 = b
    w = x1 - x0; h = y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = 0.482 * min(w, h)
    side = int(2 * r) + 2
    crop = i2.crop((int(cx - side/2), int(cy - side/2), int(cx - side/2) + side, int(cy - side/2) + side)).convert('RGBA')
    mask = Image.new('L', (side*4, side*4), 0)
    ImageDraw.Draw(mask).ellipse((side*2 - r*4, side*2 - r*4, side*2 + r*4, side*2 + r*4), fill=255)
    mask = mask.resize((side, side), Image.LANCZOS)
    crop.putalpha(mask)
    crop = crop.resize((200, 200), Image.LANCZOS)
    crop.save('assets/icono_%s.png' % nm, optimize=True)
print('ok')

# hoja de contacto para revisar
sheet = Image.new('RGB', (1500, 700), (40, 52, 77))
x = 20
for i in range(5):
    o = Image.open('assets/ficha_%d.png' % i)
    sheet.paste(o, (x, 20), o); x += o.width + 20
x = 20
for nm in names:
    o = Image.open('assets/icono_%s.png' % nm)
    sheet.paste(o, (x, 360), o); x += 220
sheet.save('preview/contacto.png')
