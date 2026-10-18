import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':1280,'height':720})
        errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file:///home/claude/camino/dist/index.html')
        await pg.fill('#nombre','Rober')
        await pg.click('#local-n button[data-n="5"]')
        await pg.wait_for_function('!document.getElementById("tirar").disabled',polling=100)
        await pg.screenshot(path='preview/n_juego0.png')
        await pg.click('#tirar')
        await pg.wait_for_timeout(2600)
        await pg.screenshot(path='preview/n_juego1.png')
        print(errs)
        await b.close()
asyncio.run(main())
