import base64, json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def leer(p): return open(os.path.join(R, p), encoding='utf-8').read()
MIME = {'.webp': 'image/webp', '.png': 'image/png'}
img = {}
for f in sorted(os.listdir(os.path.join(R, 'assets'))):
    n, e = os.path.splitext(f)
    if e in MIME:
        img[n] = 'data:%s;base64,%s' % (MIME[e], base64.b64encode(open(os.path.join(R, 'assets', f), 'rb').read()).decode())
escenas = [
 {'id':'yapeyu','nombre':'Yapeyú y el Litoral','color':'#C9764A'},
 {'id':'santafe','nombre':'Santa Fe','color':'#B89B6A'},
 {'id':'norte','nombre':'Camino al Alto Perú','color':'#C98FA0'},
 {'id':'sierras','nombre':'Sierras de Córdoba','color':'#8FA683'},
 {'id':'mendoza','nombre':'Mendoza','color':'#D4A94A'},
 {'id':'uspallata','nombre':'Valle de Uspallata','color':'#C58B5B'},
 {'id':'cruce','nombre':'Cruce de los Andes','color':'#8DB7C9'},
 {'id':'baires','nombre':'Buenos Aires','color':'#6F86B3'},
]
datos = {'sellos': json.loads(leer('data/sellos.json')), 'layout': json.loads(leer('data/layout.json')),
         'escenas': escenas, 'fichasMeta': json.loads(leer('assets/fichas_meta.json'))}
html = leer('src/index.html')
rep = {'/*@CSS@*/': leer('src/estilo.css'), '/*@PEERJS@*/': leer('src/peerjs.min.js'),
       '/*@DATOS@*/null': json.dumps(datos, ensure_ascii=False), '/*@IMG@*/null': json.dumps(img),
       '/*@REGLAS@*/': leer('src/reglas.js'), '/*@SESION@*/': leer('src/sesion.js'), '/*@APP@*/': leer('src/app.js')}
for k, v in rep.items():
    assert k in html, k
    html = html.replace(k, v.replace('</script', '<\\/script') if k != '/*@CSS@*/' else v)
os.makedirs(os.path.join(R, 'dist'), exist_ok=True)
open(os.path.join(R, 'dist/index.html'), 'w', encoding='utf-8').write(html)
print(len(html)//1024, 'KB')
