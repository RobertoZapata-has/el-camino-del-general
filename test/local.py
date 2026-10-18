import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
        await pg.goto('file:///home/claude/camino/dist/index.html?rapido=1')
        await pg.fill('#nombre','Rober')
        await pg.screenshot(path='preview/ui_inicio.png')
        await pg.click('#local-n button[data-n="4"]')
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='preview/ui_juego0.png')
        for i in range(400):
            st = await pg.evaluate('window.__ecdg.estado()')
            if st['fase']=='fin': break
            await pg.wait_for_function('!document.getElementById("tirar").disabled || window.__ecdg.estado().fase=="fin"', timeout=8000)
            if (await pg.evaluate('window.__ecdg.estado().fase'))=='fin': break
            await pg.click('#tirar')
            if i==6: await pg.wait_for_timeout(300); await pg.screenshot(path='preview/ui_juego1.png')
            await pg.wait_for_timeout(30)
        await pg.wait_for_timeout(800)
        st = await pg.evaluate('window.__ecdg.estado()')
        print('fase', st['fase'], 'jugadas', st['jugada'])
        await pg.screenshot(path='preview/ui_fin.png')
        print('errores', errs[:5])
        await b.close()
asyncio.run(main())
