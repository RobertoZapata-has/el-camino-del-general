import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width':800,'height':360})
        await pg.goto('file:///home/claude/camino/dist/index.html')
        await pg.fill('#nombre','Rober'); await pg.click('#local-n button[data-n="3"]')
        await pg.wait_for_function('!document.getElementById("tirar").disabled',polling=100)
        await pg.click('#tirar'); await pg.wait_for_timeout(1900)
        await pg.screenshot(path='preview/ui_card_800.png')
        await b.close()
asyncio.run(main())
