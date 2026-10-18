import asyncio, random
from playwright.async_api import async_playwright
URL='file:///home/claude/camino/dist/index.html'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--disable-features=WebRtcHideLocalIpsWithMdns'])
        errs=[]
        async def nueva(nombre, extra=''):
            ctx = await b.new_context(viewport={'width':1280,'height':720})
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e: errs.append((nombre,str(e))))
            await pg.goto(URL+'?rapido=1&broker=localhost:9000'+extra)
            await pg.fill('#nombre', nombre)
            return ctx, pg
        c0, host = await nueva('Anfi')
        await host.click('#btn-crear')
        await host.wait_for_selector('#sala:not([hidden])', timeout=10000)
        cod = await host.inner_text('#sala-codigo'); print('codigo', cod)
        pgs=[host]
        for i in range(1,5):
            c, pg = await nueva('Amigo%d'%i)
            await pg.fill('#codigo', cod); await pg.click('#btn-unirse')
            await pg.wait_for_selector('#sala:not([hidden])', timeout=15000)
            pgs.append(pg)
        await host.wait_for_function('window.__ecdg.estado().jugadores.length==5', timeout=10000)
        await host.screenshot(path='preview/e2e_sala.png')
        # sexto: debe fallar
        c, extra = await nueva('Sexto')
        await extra.fill('#codigo', cod); await extra.click('#btn-unirse')
        await extra.wait_for_function('document.getElementById("msg-inicio").textContent.includes("llena")', timeout=15000)
        print('sexto rechazado OK')
        await host.click('#btn-empezar')
        for pg in pgs: await pg.wait_for_selector('#juego:not([hidden])', timeout=10000)
        n=0
        pids=[await pg.evaluate('window.__ecdg.pid') for pg in pgs]
        while True:
            st = await host.evaluate('window.__ecdg.estado()')
            if st['fase']=='fin': break
            # desconecto a un invitado a mitad de partida para probar reconexión
            if n==25:
                await pgs[3].evaluate('window.__ecdg.app.conexionG.close()')
            turno = st['jugadores'][st['turno']]['id']
            if n%10==0: print('n',n,[j['pos'] for j in st['jugadores']], flush=True)
            for pg,pd in zip(pgs,pids):
                if pd==turno:
                    try:
                        await pg.wait_for_function('!document.getElementById("tirar").disabled', timeout=4000, polling=100)
                        await pg.evaluate('document.getElementById("tirar").click()'); n+=1
                    except Exception as e: print('fail', await pg.evaluate('JSON.stringify([document.getElementById("tirar").disabled, window.__ecdg.ocupado(), window.__ecdg.app.pendiente, window.__ecdg.estado().turno])'), flush=True)
            await host.wait_for_timeout(60)
            if n>1200: break
        await host.wait_for_timeout(1500)
        for i,pg in enumerate(pgs):
            s = await pg.evaluate('window.__ecdg.estado()')
            print(i, s['fase'], s['ganador'] and s['ganador'][:4], s['jugada'], s['seq'])
        await pgs[2].screenshot(path='preview/e2e_fin_invitado.png')
        await pgs[0].click('text=Otra partida')
        await pgs[2].wait_for_function('window.__ecdg.estado().fase=="jugando"', timeout=8000)
        print('revancha OK; tiradas', n, 'errores', errs[:5])
        await b.close()
asyncio.run(main())
