import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        async def nueva(n):
            c=await b.new_context(viewport={'width':1280,'height':720}); pg=await c.new_page()
            pg.on('pageerror', lambda e: print(n,'ERR',e))
            await pg.goto('file:///home/claude/camino/dist/index.html?rapido=1&broker=localhost:9000'); await pg.fill('#nombre',n); return pg
        h=await nueva('A'); await h.click('#btn-crear'); await h.wait_for_selector('#sala:not([hidden])')
        cod=await h.inner_text('#sala-codigo')
        g=await nueva('B'); await g.fill('#codigo',cod); await g.click('#btn-unirse'); await g.wait_for_selector('#sala:not([hidden])')
        await h.wait_for_function('window.__ecdg.estado().jugadores.length==2')
        await h.click('#btn-empezar'); await g.wait_for_selector('#juego:not([hidden])'); await h.wait_for_timeout(1500)
        for pg in (h,g):
            print(await pg.evaluate('''()=>{const s=window.__ecdg.estado();return JSON.stringify([s.fase,s.turno,window.__ecdg.pid,s.jugadores.map(j=>j.id),document.getElementById("tirar").disabled,document.getElementById("tirar").textContent,window.__ecdg.ocupado(),window.__ecdg.app.pendiente])}'''))
        await b.close()
asyncio.run(main())
