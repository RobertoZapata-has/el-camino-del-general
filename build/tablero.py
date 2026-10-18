# Procesa la imagen del tablero: detecta las 63 casillas (grilla 9x7), arma el orden en espiral,
# borra el borde dorado del centro y guarda assets/tablero.webp (1280x720) y data/tablero.json
import json
from PIL import Image
import numpy as np
from scipy import ndimage as ndi
SRC='/root/.claude/uploads/da9d2706-ce32-5492-87b8-9d6518d7d1ce/cee038c5-image.jpg'
im=Image.open(SRC).convert('RGB'); W,H=im.size
a=np.asarray(im).astype(int)
m=(abs(a[:,:,0]-250)<12)&(abs(a[:,:,1]-236)<12)&(abs(a[:,:,2]-216)<16)
m=ndi.binary_opening(m,iterations=3)
lab,n=ndi.label(m)
objs=ndi.find_objects(lab)
cells=[]
for i,sl in enumerate(objs):
    area=(lab[sl]==i+1).sum()
    if 8000<area<80000:
        cells.append(((sl[1].start+sl[1].stop)/2,(sl[0].start+sl[0].stop)/2,sl[1].stop-sl[1].start,sl[0].stop-sl[0].start))
assert len(cells)==63,len(cells)
xs=sorted(c[0] for c in cells); ys=sorted(c[1] for c in cells)
def agrupar(v,k):
    # k grupos por cortes más grandes
    gaps=sorted(range(len(v)-1),key=lambda i:-(v[i+1]-v[i]))[:k-1]
    cuts=sorted(gaps); out=[];s=0
    for c in cuts+[len(v)-1]:
        out.append(np.mean(v[s:c+1])); s=c+1
    return out
cx=agrupar(xs,9); cy=agrupar(ys,7)
cw=np.median([c[2] for c in cells]); ch=np.median([c[3] for c in cells])
print('cols',[round(x) for x in cx],'rows',[round(y) for y in cy],cw,ch)
# espiral horaria desde abajo-izquierda
R,C=7,9
seen=set(); order=[]; r,c=R-1,0; dr,dc=0,1
for _ in range(R*C):
    order.append((r,c)); seen.add((r,c))
    nr,nc=r+dr,c+dc
    if not(0<=nr<R and 0<=nc<C) or (nr,nc) in seen:
        dr,dc=dc*-1,dr  # gira: (0,1)->(-1,0)->(0,-1)->(1,0)->(0,1)
        # fórmula de giro horario hacia arriba primero
        nr,nc=r+dr,c+dc
    r,c=nr,nc
print(order[:12],order[-4:])
# quitar el borde dorado de la casilla central: se detecta el dorado y se pega el parche de la casilla vecina
g=(a[:,:,0]>190)&(a[:,:,1]>130)&(a[:,:,1]<200)&(a[:,:,2]<110)
gl,gn=ndi.label(ndi.binary_closing(g,iterations=3)); best=None
for i,sl in enumerate(ndi.find_objects(gl)):
    w_=sl[1].stop-sl[1].start; h_=sl[0].stop-sl[0].start
    if 150<w_<260 and 150<h_<260: best=sl
gx0,gx1,gy0,gy1=best[1].start,best[1].stop,best[0].start,best[0].stop
print('dorado',gx0,gx1,gy0,gy1)
gcx=(gx0+gx1)/2; gcy=(gy0+gy1)/2
hw=int((gx1-gx0)/2+30); hh=int((gy1-gy0)/2+30)
# parche limpio: la casilla de la misma fila, columna 3, con el mismo corrimiento relativo
dx=cx[3]-cx[4]
src=im.crop((int(gcx)-hw,int(cy[5]+(gcy-cy[3]))-hh,int(gcx)+hw,int(cy[5]+(gcy-cy[3]))+hh))
im.paste(src,(int(gcx)-hw,int(gcy)-hh))
sc=1280/W; sy=720/H
im2=im.resize((1280,720),Image.LANCZOS); im2.save('assets/tablero.webp',quality=88)
data={'celda':[round(cw*sc,1),round(ch*sy,1)],'pos':{}}
for k,(r,c) in enumerate(order,1):
    data['pos'][k]=[round(cx[c]*sc,1),round(cy[r]*sy,1)]
json.dump(data,open('data/tablero.json','w'))
print(data['celda'],data['pos'][1],data['pos'][28],data['pos'][63])
