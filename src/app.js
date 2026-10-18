/* El camino del General - interfaz y red.
   Anfitrión = centro de la estrella (PeerJS). Los invitados mandan intenciones y reciben el estado. */
(function () {
  'use strict';
  var R = window.Reglas, S = window.Sesion, D = window.DATOS, IMG = window.IMG;
  var Q = new URLSearchParams(location.search);
  var RAPIDO = Q.get('rapido') === '1';
  var COLORES = ['#B5483C', '#4B6E96', '#D9A62E', '#7C9A6A', '#8A6FA8'];
  var ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var PREFIJO = 'ecdg-';
  // Si hace falta atravesar redes cerradas (CGNAT) se agrega acá un servidor TURN propio.
  var TURN_EXTRA = [];
  var ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }].concat(TURN_EXTRA);

  var NOMBRE_TIPO = { sello: 'Sello', posta: 'Posta', cordillera: 'Cordillera', mate: 'Mate', mula: 'Mula', meta: 'Meta' };

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function h(tag, props) {
    var e = document.createElement(tag);
    if (props) for (var k in props) { if (k === 'text') e.textContent = props[k]; else if (k === 'cls') e.className = props[k]; else e.setAttribute(k, props[k]); }
    for (var i = 2; i < arguments.length; i++) { var c = arguments[i]; if (c == null) continue; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
    return e;
  }
  function espera(ms) { return new Promise(function (r) { setTimeout(r, RAPIDO ? Math.min(ms, 15) : ms); }); }
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { }
    return null;
  }
  function lsJson(k) { try { return JSON.parse(ls(k)); } catch (e) { return null; } }
  function aleatorio(n) { var s = ''; for (var i = 0; i < n; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)]; return s; }
  function limpiarCodigo(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); }

  var sellos = D.sellos, escenas = {}, posN = {};
  D.escenas.forEach(function (e) { escenas[e.id] = e; });
  Object.keys(D.layout).forEach(function (id) { D.layout[id].sq.forEach(function (q) { posN[q[0]] = { esc: id, x: q[1], y: q[2] }; }); });
  function escenaDe(n) { return sellos[n - 1].escena; }
  function nombreDe(n) { return sellos[n - 1].nombre; }

  var pid = Q.get('pid') || ls('ecdg_pid');
  if (!pid) { pid = 'p' + aleatorio(10); ls('ecdg_pid', pid); }

  /* ---------- estado de la app ---------- */
  var app = {
    modo: null,          // 'red' | 'local'
    anfitrion: false,
    anf: null,           // Sesion.Anfitrion (anfitrión o local)
    codigo: null,
    peer: null, conns: {}, conexionG: null,
    soloInvitado: !!limpiarCodigo(Q.get('sala')),
    visible: null,       // estado que se está mostrando
    ultimoEnc: null,     // último estado encolado
    escena: null,
    pendiente: false,
    cerrando: false
  };
  var cola = Promise.resolve(), ocupado = 0;
  var fichasEl = {}, tokenSlots = [];

  /* ---------- pantallas ---------- */
  function mostrar(id) {
    ['inicio', 'sala', 'juego', 'salida'].forEach(function (p) { $(p).hidden = (p !== id); });
    document.body.classList.toggle('jugando', id === 'juego');
    if (id === 'juego') fit();
  }
  function fit() {
    var s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    $('escenario').style.transform = 'translate(' + (-640 * s) + 'px,' + (-360 * s) + 'px) scale(' + s + ')';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 120); });

  function msgInicio(t, ok) { var m = $('msg-inicio'); m.textContent = t || ''; m.className = 'msg' + (ok ? ' ok' : ''); }

  /* ---------- inicio ---------- */
  function nombreIngresado() {
    var n = R.limpiarNombre($('nombre').value);
    if (n) ls('ecdg_nombre', n);
    return n;
  }
  function prepararInicio() {
    $('hero').style.backgroundImage = 'url(' + IMG.portada + ')';
    $('nombre').value = ls('ecdg_nombre') || '';
    var cod = limpiarCodigo(Q.get('sala'));
    if (app.soloInvitado) {
      $('bloque-crear').hidden = true; $('bloque-local').hidden = true;
      $('codigo').value = cod; $('codigo').readOnly = true;
    }
    var hs = lsJson('ecdg_host'), gs = lsJson('ecdg_inv');
    var puede = !app.soloInvitado && ((hs && hs.sala && hs.sala.fase !== 'fin') || gs);
    if (app.soloInvitado && gs && gs.codigo === cod) puede = true;
    $('bloque-reanudar').hidden = !puede;
    mostrar('inicio');
  }
  $('btn-crear').onclick = function () { if (!nombreIngresado()) { msgInicio('Escribí tu nombre primero.'); return; } crearSala(); };
  $('btn-unirse').onclick = function () {
    if (!nombreIngresado()) { msgInicio('Escribí tu nombre primero.'); return; }
    var c = limpiarCodigo($('codigo').value);
    if (c.length !== 5) { msgInicio('El código tiene 5 letras o números.'); return; }
    unirse(c);
  };
  $('codigo').addEventListener('input', function () { this.value = limpiarCodigo(this.value); });
  $('btn-reanudar').onclick = function () {
    var gs = lsJson('ecdg_inv'), hs = lsJson('ecdg_host');
    if (!app.soloInvitado && hs && hs.sala && hs.sala.fase !== 'fin') reanudarAnfitrion(hs);
    else if (gs) { $('nombre').value = gs.nombre || $('nombre').value; unirse(gs.codigo); }
  };
  Array.prototype.forEach.call(document.querySelectorAll('#local-n button'), function (b) {
    b.onclick = function () { jugarLocal(+b.getAttribute('data-n')); };
  });

  /* ---------- modo local ---------- */
  function jugarLocal(n) {
    var nombre = nombreIngresado();
    reiniciarApp();
    app.modo = 'local'; app.anfitrion = true;
    app.anf = new S.Anfitrion({ codigo: 'LOCAL', idAnfitrion: 'L0', alCambiar: alCambiarSala });
    for (var i = 0; i < n; i++) app.anf.recibir('L' + i, { t: 'unir', nombre: i === 0 && nombre ? nombre : 'Jugador ' + (i + 1) });
    app.anf.recibir('L0', { t: 'empezar' });
  }

  /* ---------- red: anfitrión ---------- */
  function opcionesPeer() {
    var o = { debug: 0, config: { iceServers: ICE } };
    var b = Q.get('broker');
    if (b) { var p = b.split(':'); o.host = p[0]; o.port = +p[1] || 9000; o.path = '/'; o.secure = false; }
    return o;
  }
  function PeerClase() { return window.Peer || (window.peerjs && window.peerjs.Peer); }

  function crearSala() {
    msgInicio('Creando sala…', true);
    abrirPeerAnfitrion(aleatorio(5), null, 0);
  }
  function reanudarAnfitrion(hs) {
    msgInicio('Retomando…', true);
    var sala = hs.sala;
    sala.jugadores.forEach(function (j) { if (j.id !== pid) j.conectado = false; });
    abrirPeerAnfitrion(sala.codigo, sala, 0);
  }
  function abrirPeerAnfitrion(codigo, salaPrevia, intento) {
    reiniciarApp();
    var Peer = PeerClase();
    var peer = new Peer(PREFIJO + codigo, opcionesPeer());
    app.peer = peer; app.modo = 'red'; app.anfitrion = true; app.codigo = codigo;
    peer.on('open', function () {
      var anf = new S.Anfitrion({
        sala: salaPrevia || undefined, codigo: codigo, idAnfitrion: pid,
        enviar: function (id, m) { var c = app.conns[id]; if (c && c.open) { try { c.send(m); } catch (e) { } } },
        difundir: function (m) { Object.keys(app.conns).forEach(function (id) { var c = app.conns[id]; if (c && c.open) { try { c.send(m); } catch (e) { } } }); },
        alCambiar: alCambiarSala
      });
      app.anf = anf;
      anf.recibir(pid, { t: 'unir', nombre: nombreIngresado() || (salaPrevia && R.jugadorPorId(salaPrevia, pid) ? R.jugadorPorId(salaPrevia, pid).nombre : '') });
      if (salaPrevia) anf._publicar();
    });
    peer.on('connection', function (conn) {
      var id = null;
      conn.on('data', function (m) {
        if (!m || typeof m !== 'object' || !app.anf) return;
        if (m.t === 'unir') {
          id = String(m.pid || '').slice(0, 40);
          if (!id) return;
          var vieja = app.conns[id];
          app.conns[id] = conn;
          if (vieja && vieja !== conn) { try { vieja.close(); } catch (e) { } }
          app.anf.recibir(id, m);
          // Si no pudo entrar (llena o empezada), el anfitrión ya le mandó el error.
        } else if (id) {
          app.anf.recibir(id, m);
        }
      });
      conn.on('close', function () { if (id && app.conns[id] === conn) { delete app.conns[id]; if (app.anf) app.anf.desconectado(id); } });
      conn.on('error', function () { });
    });
    peer.on('disconnected', function () { if (app.peer === peer && !peer.destroyed) { try { peer.reconnect(); } catch (e) { } } });
    peer.on('error', function (err) {
      if (app.peer !== peer) return;
      if (err.type === 'unavailable-id') {
        if (salaPrevia && intento < 6) { setTimeout(function () { if (app.peer === peer || !app.peer) abrirPeerAnfitrion(codigo, salaPrevia, intento + 1); }, 2000); return; }
        if (!salaPrevia && intento < 6) { abrirPeerAnfitrion(aleatorio(5), null, intento + 1); return; }
        reiniciarApp(); msgInicio('No pudimos abrir la sala. Probá de nuevo.'); prepararInicio();
      } else if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error' || err.type === 'socket-closed') {
        $('conexion').hidden = false; $('conexion').textContent = 'Sin conexión con el servidor…';
        setTimeout(function () { if (app.peer === peer && !peer.destroyed) { try { peer.reconnect(); } catch (e) { } $('conexion').hidden = true; } }, 3000);
      }
    });
  }

  function alCambiarSala(sala) {
    var s = R.clonar(sala);
    if (app.modo === 'red') ls('ecdg_host', JSON.stringify({ sala: s, pid: pid, t: Date.now() }));
    recibirEstado(s);
  }

  /* ---------- red: invitado ---------- */
  function unirse(codigo) {
    reiniciarApp();
    app.modo = 'red'; app.anfitrion = false; app.codigo = codigo;
    msgInicio('Conectando…', true);
    ls('ecdg_inv', JSON.stringify({ codigo: codigo, nombre: nombreIngresado() }));
    conectarInvitado(0);
  }
  function conectarInvitado(intento) {
    var codigo = app.codigo, Peer = PeerClase();
    if (!codigo || app.cerrando) return;
    var peer = new Peer(undefined, opcionesPeer());
    var anterior = app.peer; app.peer = peer;
    if (anterior) { try { anterior.destroy(); } catch (e) { } }
    var abierto = false, resuelto = false;
    function reintentar() {
      if (resuelto || app.peer !== peer || app.cerrando) return;
      resuelto = true;
      if (app.visible) { $('conexion').hidden = false; $('conexion').textContent = 'Reconectando…'; }
      setTimeout(function () { conectarInvitado(intento + 1); }, 2500);
    }
    peer.on('open', function () {
      var conn = peer.connect(PREFIJO + codigo, { reliable: true, serialization: 'json' });
      app.conexionG = conn;
      var limite = setTimeout(function () { if (!abierto) { try { conn.close(); } catch (e) { } fallo('No pudimos conectar con la sala. ¿El anfitrión sigue conectado?'); } }, 12000);
      conn.on('open', function () {
        abierto = true; clearTimeout(limite);
        conn.send({ t: 'unir', pid: pid, nombre: nombreIngresado() || (lsJson('ecdg_inv') || {}).nombre || '' });
        $('conexion').hidden = true;
      });
      conn.on('data', function (m) {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'estado') { msgInicio(''); recibirEstado(R.clonar(m.sala)); }
        else if (m.t === 'error') {
          resuelto = true; ls('ecdg_inv', null);
          fallo(m.e === 'llena' ? 'La sala está llena (son 5 como máximo).' : 'La partida ya empezó.');
        } else if (m.t === 'cerrada') {
          resuelto = true; ls('ecdg_inv', null);
          fallo('El anfitrión cerró la sala.');
        }
      });
      conn.on('close', function () { clearTimeout(limite); if (app.conexionG === conn) reintentar(); });
      conn.on('error', function () { });
    });
    peer.on('error', function (err) {
      if (app.peer !== peer) return;
      if (err.type === 'peer-unavailable') {
        if (app.visible && intento < 40) reintentar();
        else { resuelto = true; fallo('No encontramos esa sala. Revisá el código o pedile al anfitrión que la abra de nuevo.'); }
      } else if (intento < 40) reintentar();
      else fallo('No hay conexión. Probá de nuevo en un rato.');
    });
    peer.on('disconnected', function () { /* el canal de datos sigue vivo sin el broker */ });
  }
  function fallo(texto) {
    var estabaJugando = !!app.visible;
    reiniciarApp();
    if (app.soloInvitado && estabaJugando) { /* se queda en la invitación */ }
    prepararInicio(); msgInicio(texto);
  }

  /* ---------- limpieza ---------- */
  function reiniciarApp() {
    app.cerrando = true;
    if (app.anf && app.anfitrion) { try { app.anf.cerrar(); } catch (e) { } }
    if (app.peer) { try { app.peer.destroy(); } catch (e) { } }
    app.peer = null; app.conns = {}; app.conexionG = null; app.anf = null;
    app.visible = null; app.ultimoEnc = null; app.escena = null; app.codigo = null;
    app.modo = null; app.anfitrion = false; app.pendiente = false;
    cola = Promise.resolve(); ocupado = 0; ++generacion;
    $('conexion').hidden = true; $('fin').hidden = true;
    $('tarjeta').classList.add('fuera');
    $('fichas').innerHTML = ''; fichasEl = {};
    app.cerrando = false;
  }
  var generacion = 0;

  function salirDelJuego() {
    var invitado = !app.anfitrion && app.modo === 'red';
    if (app.modo === 'red' && app.anfitrion) ls('ecdg_host', null);
    if (invitado) { try { app.conexionG && app.conexionG.send({ t: 'salir' }); } catch (e) { } ls('ecdg_inv', null); }
    reiniciarApp();
    if (invitado && app.soloInvitado) mostrar('salida'); else { prepararInicio(); msgInicio(''); }
  }

  /* ---------- sala (lobby) ---------- */
  function linkSala() { return location.origin + location.pathname + '?sala=' + app.codigo; }
  $('btn-wsp').onclick = function () {
    var t = 'Jugá conmigo a El camino del General (Juego de la Oca sanmartiniana). Sala ' + app.codigo + ': ' + linkSala();
    window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank');
  };
  $('btn-copiar').onclick = function () {
    var b = this, url = linkSala();
    function listo() { b.textContent = '¡Link copiado!'; setTimeout(function () { b.textContent = 'Copiar link'; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(listo, function () { prompt('Copiá el link:', url); });
    else prompt('Copiá el link:', url);
  };
  $('btn-empezar').onclick = function () { enviar({ t: 'empezar' }); };
  $('btn-salir-sala').onclick = salirDelJuego;

  function pintarSala(sala) {
    $('sala-codigo').textContent = sala.codigo;
    var ys = $('slots'); ys.innerHTML = '';
    for (var s = 0; s < 5; s++) {
      var j = null; sala.jugadores.forEach(function (x) { if (x.slot === s) j = x; });
      var el = h('div', { cls: 'slot' + (j ? ' lleno' : '') });
      if (j) {
        el.appendChild(h('img', { src: IMG['ficha_' + s], alt: '' }));
        var b = h('div', null, h('b', { text: j.nombre + (j.id === pid && app.modo === 'red' ? ' (vos)' : '') }));
        if (j.id === sala.jugadores[0].id && false) { }
        el.appendChild(b);
        if (app.anf && j.id === app.anf.idAnfitrion || (!app.anfitrion && j.slot === 0 && false)) b.firstChild.appendChild(h('span', { cls: 'etiqueta', text: 'Anfitrión' }));
        if (!j.conectado) b.appendChild(h('small', { text: 'Sin señal' }));
      } else {
        el.appendChild(h('div', { cls: 'vacio' })); el.appendChild(h('span', { text: 'Esperando jugador…' }));
      }
      ys.appendChild(el);
    }
    var host = app.anfitrion;
    $('sala-invitar').hidden = !host;
    $('btn-empezar').hidden = !host;
    $('btn-empezar').disabled = sala.jugadores.length < 2;
    $('sala-nota').textContent = host
      ? (sala.jugadores.length < 2 ? 'Mandá el link a tus amigos. Con 2 jugadores ya se puede empezar (máximo 5).' : 'Cuando estén todos, tocá Empezar.')
      : 'Esperando que el anfitrión empiece la partida…';
  }

  /* ---------- envío de intenciones ---------- */
  function enviar(msg) {
    if (!app.modo) return;
    if (app.anfitrion) {
      var quien = app.modo === 'local' ? (msg.t === 'tirar' ? quienTira() : 'L0') : pid;
      app.anf.recibir(quien, msg);
    } else if (app.conexionG && app.conexionG.open) {
      try { app.conexionG.send(msg); } catch (e) { }
    }
  }
  function quienTira() { var s = app.visible; return s && s.jugadores[s.turno] ? s.jugadores[s.turno].id : null; }

  /* ---------- recepción de estados y cola de animación ---------- */
  function recibirEstado(sala) {
    app.pendiente = false;
    var prev = app.ultimoEnc;
    if (prev && sala.partida === prev.partida && sala.seq <= prev.seq) return;
    app.ultimoEnc = sala;
    var gen = generacion;
    var tarea;
    if (!prev || sala.fase === 'sala' || sala.partida !== prev.partida || sala.jugada < prev.jugada || sala.jugada > prev.jugada + 1) {
      tarea = function () { return aplicar(sala, true); };
    } else if (sala.jugada === prev.jugada + 1 && sala.ultima) {
      tarea = function () { return animarJugada(sala); };
    } else {
      tarea = function () { return aplicar(sala, false); };
    }
    ocupado++;
    cola = cola.then(function () { if (gen !== generacion) return; return tarea(); }).catch(function (e) { console.error(e); }).then(function () { ocupado--; controles(); });
  }

  /* ---------- tablero ---------- */
  var fondoActivo = 'fondo-a';
  function tipoClase(n) { return R.tipoDe(n); }

  function construirEscena(id) {
    var lay = D.layout[id], cas = $('casilleros'), svg = $('camino');
    cas.innerHTML = '';
    svg.innerHTML = '';
    var pts = lay.line.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
    var NS = 'http://www.w3.org/2000/svg';
    [['#1F2E4D', 16, 1], ['#F4E8CE', 8, 1]].forEach(function (c) {
      var pl = document.createElementNS(NS, 'polyline');
      pl.setAttribute('points', pts); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', c[0]);
      pl.setAttribute('stroke-width', c[1]); pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round');
      if (c[0] === '#F4E8CE') pl.setAttribute('stroke-dasharray', '2 14');
      svg.appendChild(pl);
    });
    lay.sq.forEach(function (q) {
      var n = q[0], t = tipoClase(n);
      var el = h('div', { cls: 'sq tipo-' + t, 'data-n': n, style: 'left:' + q[1] + 'px;top:' + q[2] + 'px' });
      if (t === 'sello') el.appendChild(document.createTextNode(String(n)));
      else { el.appendChild(h('img', { src: IMG['icono_' + t], alt: '' })); el.appendChild(h('span', { cls: 'num', text: String(n) })); }
      el.onclick = function () { aviso(n + '. ' + nombreDe(n), 2600); };
      cas.appendChild(el);
    });
    var e = escenas[id];
    var cant = lay.sq.length;
    $('esc-prov').textContent = cant + ' sellos en esta región';
    $('esc-nombre').textContent = e.nombre;
  }

  async function cambiarFondo(id) {
    var viejo = $(fondoActivo), nuevoId = fondoActivo === 'fondo-a' ? 'fondo-b' : 'fondo-a', nuevo = $(nuevoId);
    nuevo.src = IMG['escena_' + id];
    try { await nuevo.decode(); } catch (e) { }
    nuevo.style.opacity = '1'; viejo.style.opacity = '0';
    fondoActivo = nuevoId;
  }

  // Muestra la región indicada. Con viaje, hace la transición con cartel.
  async function irAEscena(id, viaje, texto) {
    if (app.escena === id) return;
    var primera = !app.escena;
    app.escena = id;
    if (primera || !viaje) {
      $(fondoActivo).src = IMG['escena_' + id];
      construirEscena(id); acomodarFichas(); return;
    }
    var v = $('viaje');
    v.textContent = texto || ('Viajamos a ' + escenas[id].nombre);
    v.style.background = escenas[id].color; v.style.border = '4px solid #1F2E4D';
    v.classList.remove('fuera');
    $('casilleros').classList.add('oculto'); $('fichas').classList.add('oculto'); $('camino').classList.add('oculto');
    await espera(350);
    await cambiarFondo(id);
    construirEscena(id); acomodarFichas();
    await espera(450);
    $('casilleros').classList.remove('oculto'); $('fichas').classList.remove('oculto'); $('camino').classList.remove('oculto');
    await espera(250);
    v.classList.add('fuera');
  }

  var DX = [-30, -15, 0, 15, 30], DY = [8, -2, 10, -2, 8], ESCALA = 0.32;
  function crearFicha(j) {
    var m = D.fichasMeta[j.slot], w = Math.round(m[0] * ESCALA), hh = Math.round(m[1] * ESCALA);
    var el = h('div', { cls: 'ficha quieta', style: 'width:' + w + 'px;height:' + hh + 'px;display:none' },
      h('img', { src: IMG['ficha_' + j.slot], alt: j.nombre, style: 'width:100%;height:100%;display:block', draggable: 'false' }));
    el._w = w; el._h = hh;
    $('fichas').appendChild(el);
    fichasEl[j.id] = el;
    return el;
  }
  function elFicha(j) { return fichasEl[j.id] || crearFicha(j); }

  // Coloca la ficha sobre el casillero n (si está en la región que se ve).
  function ponerFicha(j, n, modo) {
    var el = elFicha(j), p = posN[n];
    if (!p || p.esc !== app.escena) { el.style.display = 'none'; el._n = n; return false; }
    var x = p.x + DX[j.slot] - el._w / 2, y = p.y + DY[j.slot] - el._h + 6;
    el.classList.remove('quieta', 'salto', 'aparece');
    if (modo === 'quieto') el.classList.add('quieta');
    else if (modo === 'salto') el.classList.add('salto');
    else if (modo === 'aparece') el.classList.add('aparece');
    if (el.style.display === 'none') el.classList.add('quieta');
    el.style.display = 'block';
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.zIndex = Math.round(p.y) + j.slot;
    el._n = n;
    return true;
  }
  function acomodarFichas() {
    var s = app.visible;
    if (!s) return;
    s.jugadores.forEach(function (j) {
      var el = fichasEl[j.id] || crearFicha(j);
      ponerFicha(j, el._n || j.pos, 'quieto');
    });
  }
  function sacarFichasSobrantes(sala) {
    Object.keys(fichasEl).forEach(function (id) {
      if (!R.jugadorPorId(sala, id)) { fichasEl[id].remove(); delete fichasEl[id]; }
    });
  }

  /* ---------- dados ---------- */
  var CARAS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function pintarDado(id, v) {
    var d = $(id); d.innerHTML = '';
    for (var i = 0; i < 9; i++) d.appendChild(h('i', { cls: v && CARAS[v].indexOf(i) >= 0 ? 'on' : '' }));
  }
  function pintarDados(dd) { pintarDado('d0', dd ? dd[0] : 0); pintarDado('d1', dd ? dd[1] : 0); }
  async function tirarDados(dd) {
    $('d0').classList.add('tira'); $('d1').classList.add('tira');
    for (var i = 0; i < 6; i++) { pintarDado('d0', 1 + Math.floor(Math.random() * 6)); pintarDado('d1', 1 + Math.floor(Math.random() * 6)); await espera(100); }
    $('d0').classList.remove('tira'); $('d1').classList.remove('tira');
    pintarDados(dd);
    await espera(350);
  }

  /* ---------- avisos y tarjeta ---------- */
  var avisoT = null;
  function aviso(txt, ms) {
    var a = $('aviso'); a.textContent = txt; a.classList.remove('fuera');
    clearTimeout(avisoT); avisoT = setTimeout(function () { a.classList.add('fuera'); }, RAPIDO ? 100 : (ms || 2200));
  }
  var cerrarTarjeta = null;
  async function mostrarTarjeta(n, tipo, efecto, ms) {
    var s = sellos[n - 1], t = $('tarjeta');
    t.style.backgroundImage = 'url(' + IMG.tarjeta + ')';
    $('t-cinta').textContent = tipo === 'sello' ? 'Sello N.º ' + n : (NOMBRE_TIPO[tipo].toUpperCase() + ' · N.º ' + n);
    var c = $('t-cuerpo'); c.innerHTML = '';
    c.appendChild(h('h3', { text: s.nombre }));
    c.appendChild(h('div', { cls: 'prov', text: s.prov }));
    if (s.incluye) c.appendChild(h('div', { cls: 'incluye', text: s.incluye }));
    c.appendChild(h('div', { cls: 'pendiente', text: 'La ficha histórica y la anécdota llegan pronto.' }));
    if (efecto) c.appendChild(h('div', { cls: 'efecto', text: efecto }));
    $('t-sello').src = IMG['icono_' + tipo];
    t.classList.remove('fuera');
    await new Promise(function (res) {
      var t0 = setTimeout(res, RAPIDO ? 20 : ms);
      cerrarTarjeta = function () { clearTimeout(t0); res(); };
    });
    cerrarTarjeta = null;
    t.classList.add('fuera');
    await espera(260);
  }
  $('tarjeta').onclick = function () { if (cerrarTarjeta) cerrarTarjeta(); };

  function textoEfecto(ef, j) {
    switch (ef.tipo) {
      case 'posta': return ef.a ? '¡Posta! Cambiás de caballo y salís disparado hasta el sello ' + ef.a + '. Volvés a tirar.' : '¡Última posta del camino! Cambiás de caballo y volvés a tirar.';
      case 'cordillera': return '¡Paso de la cordillera! El frío te hace retroceder hasta el sello ' + ef.a + '.';
      case 'mate': return 'Mate bajo el árbol histórico. Perdés el próximo turno, pero qué rico estaba.';
      case 'mula': return '¡La mula no quiere avanzar! Volvés a tirar, pero con la mitad de los dados.';
      case 'meta': return '¡Llegaste! Tenías todos los sellos en el pasaporte.';
      default: return '¡Sello estampado!';
    }
  }

  /* ---------- animación de una jugada ---------- */
  async function animarJugada(sala) {
    var ult = sala.ultima, j = R.jugadorPorId(sala, ult.id);
    if (!j) return aplicar(sala, false);
    var antes = app.visible;
    sacarFichasSobrantes(sala);
    sala.jugadores.forEach(function (x) { elFicha(x); });
    quitarTurnoMarca();
    if (ult.pasa) {
      aviso(j.nombre + ' no está conectado: se pasa su turno.', 2600);
      await espera(1400);
      return aplicar(sala, false);
    }
    // Primero llevamos la cámara a donde está la ficha (por si no estaba ahí).
    if (app.escena !== escenaDe(ult.desde)) await irAEscena(escenaDe(ult.desde), true, 'Juega ' + j.nombre + ' en ' + escenas[escenaDe(ult.desde)].nombre);
    if (ult.mitad) aviso('Dados a la mitad por la mula.', 1800);
    await tirarDados(ult.dados);
    var pos = ult.desde;
    for (var i = 0; i < ult.pasos.length; i++) {
      var paso = ult.pasos[i];
      if (paso.tipo === 'camina' || paso.tipo === 'rebote') {
        var ruta = [], n;
        if (paso.tipo === 'rebote') { for (n = pos + 1; n <= R.META; n++) ruta.push(n); for (n = R.META - 1; n >= paso.a; n--) ruta.push(n); }
        else for (n = pos + 1; n <= paso.a; n++) ruta.push(n);
        for (var k = 0; k < ruta.length; k++) {
          var nn = ruta[k];
          if (escenaDe(nn) !== app.escena) {
            await irAEscena(escenaDe(nn), true, j.nombre + ' sigue camino hacia ' + escenas[escenaDe(nn)].nombre);
            ponerFicha(j, nn, 'aparece'); await espera(350);
          } else { ponerFicha(j, nn, 'paso'); await espera(190); }
        }
        if (paso.tipo === 'rebote') aviso('¡Te pasaste del Museo! Rebotás hacia atrás.', 2200);
        pos = paso.a;
        var ef = ult.efecto, esUltimo = (i === ult.pasos.length - 1) || (ult.pasos[i + 1] && ult.pasos[i + 1].tipo !== 'camina');
        if (esUltimo) {
          var t = ef.tipo;
          await mostrarTarjeta(ef.casillero, t, textoEfecto(ef, j), t === 'sello' ? 1500 : 3000);
        }
      } else {
        // posta o retroceso: salto
        var destino = paso.a;
        if (escenaDe(destino) === app.escena) { ponerFicha(j, destino, 'salto'); await espera(800); }
        else { await irAEscena(escenaDe(destino), true, paso.tipo === 'posta' ? j.nombre + ' galopa hacia ' + escenas[escenaDe(destino)].nombre : j.nombre + ' retrocede a ' + escenas[escenaDe(destino)].nombre); ponerFicha(j, destino, 'aparece'); await espera(400); }
        pos = destino;
      }
    }
    (ult.salteados || []).forEach(function (id) {
      var q = R.jugadorPorId(sala, id);
      if (q) aviso(q.nombre + ' se quedó tomando mate: pierde este turno.', 2600);
    });
    return aplicar(sala, false);
  }

  function quitarTurnoMarca() { Object.keys(fichasEl).forEach(function (id) { fichasEl[id].classList.remove('turno'); }); }

  /* ---------- aplicar un estado completo ---------- */
  async function aplicar(sala, estatico) {
    var antes = app.visible;
    app.visible = sala;
    if (sala.fase === 'sala') {
      $('fin').hidden = true;
      mostrar('sala'); pintarSala(sala);
      return;
    }
    if (document.getElementById('juego').hidden) { mostrar('juego'); }
    sacarFichasSobrantes(sala);
    var activo = sala.jugadores[sala.turno];
    var foco = sala.fase === 'fin' ? R.jugadorPorId(sala, sala.ganador) : activo;
    var obj = foco ? escenaDe(foco.pos) : 'baires';
    var primera = !app.escena;
    if (app.escena !== obj) {
      var txt = foco ? ('Ahora juega ' + foco.nombre + ' en ' + escenas[obj].nombre) : null;
      if (sala.fase === 'fin') txt = foco.nombre + ' llegó a ' + escenas[obj].nombre;
      await irAEscena(obj, !estatico && !primera, txt);
    }
    sala.jugadores.forEach(function (j) {
      var el = elFicha(j), era = el.style.display === 'none';
      var igual = el._n === j.pos;
      ponerFicha(j, j.pos, igual && !era ? 'quieto' : (estatico ? 'quieto' : 'quieto'));
    });
    Object.keys(fichasEl).forEach(function (id) { fichasEl[id].classList.toggle('turno', sala.fase === 'jugando' && activo && activo.id === id); });
    if (!antes || estatico || !sala.ultima || sala.ultima.pasa) pintarDados(sala.ultima && sala.ultima.dados);
    else pintarDados(sala.ultima.dados);
    pintarJugadores(sala);
    pintarTira(sala);
    pintarTurno(sala);
    pintarFin(sala);
    marcarActual(sala);
    controles();
  }

  function marcarActual(sala) {
    Array.prototype.forEach.call($('casilleros').children, function (e) { e.classList.remove('actual'); });
    if (sala.fase !== 'jugando') return;
    var a = sala.jugadores[sala.turno];
    if (!a) return;
    var e = $('casilleros').querySelector('[data-n="' + a.pos + '"]');
    if (e) e.classList.add('actual');
  }

  function esMiTurno(sala) {
    if (!sala || sala.fase !== 'jugando') return false;
    var a = sala.jugadores[sala.turno];
    if (!a) return false;
    return app.modo === 'local' || a.id === pid;
  }

  function pintarTurno(sala) {
    var t = $('hud-turno'), a = sala.jugadores[sala.turno];
    if (sala.fase !== 'jugando' || !a) { t.hidden = true; return; }
    t.hidden = false;
    var mio = esMiTurno(sala);
    t.classList.toggle('mio', mio);
    $('turno-nombre').textContent = app.modo === 'local' ? 'Juega ' + a.nombre : (mio ? '¡Te toca!' : 'Juega ' + a.nombre);
    $('turno-sub').textContent = mio ? (a.mitad ? 'Tirá: los dados valen la mitad' : 'Tocá “Tirar dados”') : (a.conectado ? 'Esperá tu turno' : 'Sin señal: se le pasa el turno enseguida');
  }

  function pintarJugadores(sala) {
    var cont = $('jugadores'); cont.innerHTML = '';
    var activo = sala.jugadores[sala.turno];
    sala.jugadores.forEach(function (j) {
      var fila = h('div', { cls: 'jug' + (sala.fase === 'jugando' && activo && activo.id === j.id ? ' activo' : '') + (j.conectado ? '' : ' fuera'), style: '--c:' + COLORES[j.slot] },
        h('img', { src: IMG['ficha_' + j.slot], alt: '' }),
        h('div', null, h('b', { text: j.nombre + (app.modo === 'red' && j.id === pid ? ' (vos)' : '') }), h('small', { text: 'Sello ' + j.pos + ' de ' + R.META })));
      var est = !j.conectado ? 'Sin señal' : j.pausa > 0 ? 'Mate' : j.mitad ? 'Mula' : '';
      if (est) fila.appendChild(h('span', { cls: 'estado', text: est }));
      else fila.appendChild(h('span'));
      cont.appendChild(fila);
    });
  }

  function pintarTira(sala) {
    var m = $('marcas'), d = $('dots');
    if (!m.firstChild) {
      for (var n = 1; n <= R.META; n++) { var i = h('i', { style: 'background:' + escenas[escenaDe(n)].color }); i.setAttribute('data-e', escenaDe(n)); m.appendChild(i); }
    }
    Array.prototype.forEach.call(m.children, function (i) { i.classList.toggle('ver', i.getAttribute('data-e') === app.escena); });
    d.innerHTML = '';
    sala.jugadores.forEach(function (j) {
      d.appendChild(h('b', { style: '--c:' + COLORES[j.slot] + ';left:' + ((j.pos - 0.5) / R.META * 100) + '%' }));
    });
  }

  function pintarFin(sala) {
    var f = $('fin');
    if (sala.fase !== 'fin') { f.hidden = true; return; }
    var g = R.jugadorPorId(sala, sala.ganador);
    var caja = $('fin-caja'); caja.innerHTML = '';
    caja.appendChild(h('h2', { text: '¡' + g.nombre + ' llegó al Museo del Cabildo!' }));
    caja.appendChild(h('div', { cls: 'gana' }, h('img', { src: IMG['ficha_' + g.slot], alt: '' })));
    var ol = h('ol');
    sala.jugadores.slice().sort(function (a, b) { return b.pos - a.pos; }).forEach(function (j) {
      ol.appendChild(h('li', null, h('span', { text: j.nombre }), h('span', { text: 'sello ' + j.pos })));
    });
    caja.appendChild(ol);
    var bs = h('div', { cls: 'botones' });
    if (app.anfitrion) { var o = h('button', { cls: 'boton primario', text: 'Otra partida' }); o.onclick = function () { enviar({ t: 'otra' }); }; bs.appendChild(o); }
    else bs.appendChild(h('span', { text: 'Esperando que el anfitrión arme otra…', style: 'font-weight:600;align-self:center' }));
    var s = h('button', { cls: 'boton secundario', text: 'Salir' }); s.onclick = salirDelJuego; bs.appendChild(s);
    caja.appendChild(bs);
    f.hidden = false;
  }

  /* ---------- controles ---------- */
  function controles() {
    var s = app.visible, b = $('tirar');
    if (!s || s.fase !== 'jugando') { b.disabled = true; return; }
    var a = s.jugadores[s.turno], libre = ocupado === 0 && !app.pendiente;
    var mio = esMiTurno(s);
    b.disabled = !(mio && libre);
    if (mio) b.textContent = a.mitad ? 'Tirar (mitad)' : 'Tirar dados';
    else b.textContent = 'Juega ' + (a ? a.nombre : '');
    $('btn-menu').hidden = false;
  }
  $('tirar').onclick = function () {
    if ($('tirar').disabled) return;
    app.pendiente = true; controles();
    setTimeout(function () { if (app.pendiente) { app.pendiente = false; controles(); } }, 4000);
    enviar({ t: 'tirar' });
  };
  var salirT = null;
  $('btn-menu').onclick = function () {
    var b = this;
    if (b.getAttribute('data-seguro')) { clearTimeout(salirT); b.removeAttribute('data-seguro'); b.textContent = 'Salir'; salirDelJuego(); return; }
    b.setAttribute('data-seguro', '1'); b.textContent = '¿Seguro?';
    salirT = setTimeout(function () { b.removeAttribute('data-seguro'); b.textContent = 'Salir'; }, 3000);
  };
  $('btn-pantalla').onclick = function () {
    var de = document.documentElement;
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (de.requestFullscreen) de.requestFullscreen().then(function () { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function () { }); }).catch(function () { });
    } catch (e) { }
  };

  window.__ecdg = { estado: function () { return app.visible; }, app: app, ocupado: function () { return ocupado; }, pid: pid };

  prepararInicio();
})();
