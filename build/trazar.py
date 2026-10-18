import numpy as np, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from scipy import ndimage as ndi

W, H = 1280, 720
sellos = json.load(open('data/sellos.json', encoding='utf-8'))
ESC = ['yapeyu','santafe','norte','sierras','mendoza','uspallata','cruce','baires']
by = {e: sorted(s['n'] for s in sellos if s['escena'] == e) for e in ESC}

def cost_map(path):
    im = Image.open(path).convert('RGB').resize((W//2, H//2), Image.LANCZOS)
    a = np.asarray(im).astype(float)
    g = a.mean(axis=2)
    g = ndi.gaussian_filter(g, 1.4)
    gx = ndi.sobel(g, axis=1); gy = ndi.sobel(g, axis=0)
    mag = np.hypot(gx, gy)
    std = sum(np.sqrt(np.maximum(ndi.uniform_filter(a[..., c]**2, 9) - ndi.uniform_filter(a[..., c], 9)**2, 0)) for c in range(3))
    C = mag / np.percentile(mag, 95) + 0.6 * std / np.percentile(std, 95)
    C = ndi.gaussian_filter(C, 5)
    return C

def dp_path(C, ylo, yhi, xlo, xhi, maxd=2, lam=0.12):
    ys = np.arange(ylo, yhi + 1); n = len(ys); T = xhi - xlo + 1
    cost = np.full((T, n), 1e9); back = np.zeros((T, n), int)
    cost[0] = C[ys, xlo]
    for i in range(1, T):
        x = xlo + i
        best = np.full(n, 1e9); arg = np.zeros(n, int)
        for d in range(-maxd, maxd + 1):
            prev = np.full(n, 1e9)
            if d >= 0: prev[d:] = cost[i-1][:n-d] if d else cost[i-1]
            else: prev[:d] = cost[i-1][-d:]
            val = prev + lam * abs(d)
            better = val < best
            best[better] = val[better]; arg[better] = (np.arange(n) - d)[better]
        cost[i] = best + C[ys, x]; back[i] = arg
    j = int(np.argmin(cost[-1])); out = [j]
    for i in range(T - 1, 0, -1):
        j = back[i][j]; out.append(j)
    out = out[::-1]
    return np.array([ys[j] for j in out], float), cost[-1].min() / T

def smooth(y, k=21):
    pad = np.pad(y, (k//2, k//2), mode='edge')
    return np.convolve(pad, np.ones(k)/k, mode='valid')

def resample(pts, k):
    pts = np.array(pts, float)
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(pts, axis=0).T))]
    t = np.linspace(0, d[-1], k)
    return np.c_[np.interp(t, d, pts[:, 0]), np.interp(t, d, pts[:, 1])]

def row(C, ylo, yhi, span_px, n, rtl=False, xr=(60, 1220)):
    xlo, xhi = xr[0] // 2, xr[1] // 2           # escala media
    ys, c = dp_path(C, ylo, yhi, xlo, xhi)
    ys = smooth(ys)
    xs = np.arange(xlo, xhi + 1)
    pts = np.c_[xs * 2, ys * 2]        # a escala 1280
    # ventana de largo span_px con menor costo medio
    if span_px is not None and span_px < pts[-1, 0] - pts[0, 0] - 5:
        best = None
        step = 6
        for s in range(0, len(xs) - int(span_px/2), step):
            e = s + int(span_px/2)
            cm = np.mean([C[int(ys[i]), xs[i]] for i in range(s, e, 3)])
            cm += 0.0004 * abs((s + e)/2 - len(xs)/2)   # leve preferencia por el centro
            if best is None or cm < best[0]: best = (cm, s, e)
        _, s, e = best
        pts = pts[s:e+1]
    sq = resample(pts, n)
    line = resample(pts, max(8, int(len(pts)/6)))
    if rtl: sq, line = sq[::-1], line[::-1]
    return sq, line

OVR = {'mendoza': {'A': (380, 1220), 'B': (340, 1220)}, 'uspallata': {'A': (480, 1230)}, 'sierras': {'A': (310, 1220)}}
layout = {}
for e in ESC:
    nums = by[e]; N = len(nums)
    C = cost_map('assets/escena_%s.webp' % e)
    if N >= 13:
        nA = (N + 1) // 2
        ov = OVR.get(e, {})
        a, la = row(C, 150, 218, None, nA, xr=ov.get('A', (60, 1220)))          # banda alta
        b, lb = row(C, 236, 300, None, N - nA, rtl=True, xr=ov.get('B', (60, 1220)))  # banda baja
        sq = np.vstack([a, b]); line = np.vstack([la, lb])
    else:
        span = min(1100, max(1, (N - 1)) * 175)
        sq, line = row(C, 170, 300, span, N)
    layout[e] = {'sq': [[int(n), round(float(x), 1), round(float(y), 1)] for n, (x, y) in zip(nums, sq)],
                 'line': [[round(float(x), 1), round(float(y), 1)] for x, y in line]}
    print(e, N, 'casilleros')
json.dump(layout, open('data/layout.json', 'w'))

# vistas previas con zonas de HUD
try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 26)
except Exception: font = ImageFont.load_default()
def render(e):
    im = Image.open('assets/escena_%s.webp' % e).convert('RGBA')
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    d.rectangle((940, 12, 1268, 290), fill=(20, 30, 60, 110))      # panel jugadores
    d.rectangle((12, 12, 380, 70), fill=(20, 30, 60, 110))         # titulo escena
    d.rectangle((0, 640, 1280, 720), fill=(20, 30, 60, 130))       # barra inferior
    L = layout[e]
    pl = [tuple(p) for p in L['line']]
    d.line(pl, fill=(255, 255, 255, 200), width=5)
    for n, x, y in L['sq']:
        d.ellipse((x-30, y-30, x+30, y+30), fill=(250, 240, 215, 235), outline=(31, 46, 77, 255), width=4)
        t = str(n); w = d.textlength(t, font=font)
        d.text((x - w/2, y - 15), t, fill=(31, 46, 77, 255), font=font)
    return Image.alpha_composite(im, ov).convert('RGB')
sheet = Image.new('RGB', (1280*3, 720))
for i, e in enumerate(['sierras', 'mendoza', 'uspallata']):
    sheet.paste(render(e), (i * 1280, 0))
sheet.resize((1800, 421), Image.LANCZOS).save('preview/layout_fix.png')
for k, grp in enumerate([ESC[:4], ESC[4:]]):
    sheet = Image.new('RGB', (1280*2, 720*2))
    for i, e in enumerate(grp):
        sheet.paste(render(e), ((i % 2) * 1280, (i // 2) * 720))
    sheet.resize((1600, 900), Image.LANCZOS).save('preview/layout_%d.png' % (k + 1))
print('listo')
