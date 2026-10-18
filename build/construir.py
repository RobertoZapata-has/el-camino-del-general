import base64, json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def leer(p): return open(os.path.join(R, p), encoding='utf-8').read()
MIME = {'.webp': 'image/webp', '.png': 'image/png'}
USAR = ['tablero', 'portada', 'ficha_0', 'ficha_1', 'ficha_2', 'ficha_3', 'ficha_4']
img = {}
for f in sorted(os.listdir(os.path.join(R, 'assets'))):
    n, e = os.path.splitext(f)
    if e in MIME and n in USAR:
        img[n] = 'data:%s;base64,%s' % (MIME[e], base64.b64encode(open(os.path.join(R, 'assets', f), 'rb').read()).decode())
assert set(img) == set(USAR), set(USAR) - set(img)
tab = json.loads(leer('data/tablero.json'))
datos = {'pos': {int(k): v for k, v in tab['pos'].items()}, 'celda': tab['celda'],
         'fichasMeta': json.loads(leer('assets/fichas_meta.json'))}
html = leer('src/index.html')
rep = {'/*@CSS@*/': leer('src/estilo.css'), '/*@PEERJS@*/': leer('src/peerjs.min.js'),
       '/*@DATOS@*/null': json.dumps(datos, ensure_ascii=False), '/*@IMG@*/null': json.dumps(img),
       '/*@REGLAS@*/': leer('src/reglas.js'), '/*@SESION@*/': leer('src/sesion.js'), '/*@APP@*/': leer('src/app.js')}
for k, v in rep.items():
    assert k in html, k
    html = html.replace(k, v.replace('</script', '<\\/script') if k != '/*@CSS@*/' else v)
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
open(os.path.join(R, 'dist/index.html'), 'w', encoding='utf-8').write(html)
print(len(html) // 1024, 'KB')
