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

  var POS = D.pos, CELDA = D.celda;

  var pid = Q.get('pid') || ls('ecdg_pid');
  if (!pid) { pid = 'p' + aleatorio(10); ls('ecdg_pid', pid); }

  /* ---------- íconos de los casilleros especiales (provisorios, dibujados en código) ---------- */
  var N = '#1F2E4D';
  function svg(c) { return '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="' + N + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' + c + '</svg>'; }
  var ICONOS = {
    oca: svg('<path d="M9 33c0-7 6-11 13-11h6c3 0 4-2 4-5v-4c0-3 2-5 5-5 2 0 4 1 4 3v3c0 6-3 9-6 10 3 2 4 5 3 8H15c-4 0-6-2-6-5z" fill="#FFFDF5"/><path d="M39 9l7 3-7 2z" fill="#E8932E"/><circle cx="36.5" cy="9" r="1.3" fill="' + N + '" stroke="none"/><path d="M20 42v4M28 42v4M17 46h6M25 46h6" stroke="#E8932E"/>'),
    puente: svg('<path d="M3 30h42" /><path d="M6 30c0-10 8-15 18-15s18 5 18 15" fill="#F4E8CE"/><path d="M12 30v-9M24 30V15M36 30v-9"/><path d="M4 38c4-3 6 3 10 0s6 3 10 0 6 3 10 0 6 3 10 0" stroke="#4B8FB5"/>'),
    posada: svg('<path d="M5 24L24 8l19 16z" fill="#C5543F"/><rect x="9" y="24" width="30" height="18" fill="#F4E8CE"/><rect x="20" y="30" width="9" height="12" fill="' + N + '"/><rect x="12" y="28" width="6" height="6" fill="#8DB7C9"/><rect x="31" y="28" width="6" height="6" fill="#8DB7C9"/>'),
    pozo: svg('<path d="M10 18v-7l14-6 14 6v7" /><path d="M13 11h22"/><path d="M10 28v9c0 4 6 7 14 7s14-3 14-7v-9" fill="#BDB7A8"/><ellipse cx="24" cy="28" rx="14" ry="6" fill="#3E6E8E"/><path d="M14 20v8M34 20v8"/>'),
    dados: svg('<rect x="4" y="12" width="22" height="22" rx="4" fill="#FFFDF5" transform="rotate(-10 15 23)"/><rect x="24" y="18" width="20" height="20" rx="4" fill="#FFFDF5" transform="rotate(8 34 28)"/><g fill="' + N + '" stroke="none"><circle cx="10" cy="19" r="2"/><circle cx="20" cy="27" r="2"/><circle cx="15" cy="23" r="2"/><circle cx="30" cy="24" r="1.8"/><circle cx="38" cy="32" r="1.8"/><circle cx="34" cy="28" r="1.8"/></g>'),
    laberinto: svg('<path d="M24 24h3v-3h-6v6h9v-9H18v12h15V15H12v18h27V9H6v30h36" stroke-width="2.6"/>'),
    carcel: svg('<rect x="6" y="8" width="36" height="32" rx="3" fill="#D3D6DC"/><path d="M14 8v32M22 8v32M30 8v32M38 8v32" stroke-width="3"/><path d="M6 16h36M6 32h36"/>'),
    calavera: svg('<path d="M10 22c0-9 6-15 14-15s14 6 14 15c0 5-2 8-5 10v6H15v-6c-3-2-5-5-5-10z" fill="#FFFDF5"/><circle cx="18" cy="23" r="4" fill="' + N + '"/><circle cx="30" cy="23" r="4" fill="' + N + '"/><path d="M24 28l-2 4h4z" fill="' + N + '"/><path d="M19 38v-4M24 38v-4M29 38v-4"/>'),
    meta: svg('<circle cx="24" cy="24" r="9" fill="#F0B52C"/><g stroke="#C98A12"><path d="M24 4v7M24 37v7M4 24h7M37 24h7M10 10l5 5M33 33l5 5M38 10l-5 5M15 33l-5 5"/></g><circle cx="21.5" cy="23" r="1.2" fill="' + N + '" stroke="none"/><circle cx="26.5" cy="23" r="1.2" fill="' + N + '" stroke="none"/><path d="M21 27c2 2 4 2 6 0"/>'),
    inicio: svg('<path d="M12 6v38"/><path d="M12 8h26l-6 8 6 8H12z" fill="#7C9A6A"/>'),
    normal: svg('<circle cx="24" cy="24" r="6" fill="#F4E8CE"/>')
  };
  var TINTES = { oca: '#F0B52C', puente: '#8DB7C9', posada: '#D98B5B', pozo: '#5A7DA8', dados: '#8FB77A', laberinto: '#A88BC0', carcel: '#8A8F9A', calavera: '#C9534A', meta: '#F0B52C', inicio: '#8FB77A' };

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
    pendiente: false,
    cerrando: false
  };
  var cola = Promise.resolve(), ocupado = 0, generacion = 0;
  var fichasEl = {};

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
    var puede = !app.soloInvitado && ((hs && hs.sala && hs.sala.fase !== 'fin' && hs.sala.v === 2) || gs);
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
    if (!app.soloInvitado && hs && hs.sala && hs.sala.fase !== 'fin' && hs.sala.v === 2) reanudarAnfitrion(hs);
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
    reiniciarApp();
    prepararInicio(); msgInicio(texto);
  }

  /* ---------- limpieza ---------- */
  function reiniciarApp() {
    app.cerrando = true;
    if (app.anf && app.anfitrion) { try { app.anf.cerrar(); } catch (e) { } }
    if (app.peer) { try { app.peer.destroy(); } catch (e) { } }
    app.peer = null; app.conns = {}; app.conexionG = null; app.anf = null;
    app.visible = null; app.ultimoEnc = null; app.codigo = null;
    app.modo = null; app.anfitrion = false; app.pendiente = false;
    cola = Promise.resolve(); ocupado = 0; ++generacion;
    $('conexion').hidden = true; $('fin').hidden = true;
    $('fichas').innerHTML = ''; fichasEl = {};
    quitarPulsos();
    app.cerrando = false;
  }

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
    var t = 'Jugá conmigo a El camino del General (juego de la oca). Sala ' + app.codigo + ': ' + linkSala();
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
        var nom = h('b', { text: j.nombre + (j.id === pid && app.modo === 'red' ? ' (vos)' : '') });
        var b = h('div', null, nom);
        el.appendChild(b);
        if (app.anf && j.id === app.anf.idAnfitrion) nom.appendChild(h('span', { cls: 'etiqueta', text: 'Anfitrión' }));
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
  var tableroListo = false;
  var casEl = {};
  function construirTablero() {
    if (tableroListo) return;
    tableroListo = true;
    $('fondo').src = IMG.tablero;
    var cas = $('casilleros'), svgEl = $('camino'), NS = 'http://www.w3.org/2000/svg';
    // camino de tierra que une las 63 casillas en orden
    var pts = [], i;
    for (i = 1; i <= R.META; i++) pts.push(POS[i][0] + ',' + POS[i][1]);
    [['#8A6A3A', 28, .5, null], ['#D8B97E', 22, .8, null], ['#8A6A3A', 3, .55, '2 11']].forEach(function (c) {
      var pl = document.createElementNS(NS, 'polyline');
      pl.setAttribute('points', pts.join(' ')); pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', c[0]);
      pl.setAttribute('stroke-width', c[1]); pl.setAttribute('stroke-opacity', c[2]);
      pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round');
      if (c[3]) pl.setAttribute('stroke-dasharray', c[3]);
      svgEl.appendChild(pl);
    });
    // flechitas en cada tramo, en el hueco entre casillas
    for (i = 1; i < R.META; i++) {
      var a = POS[i], b = POS[i + 1];
      var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      var tr = document.createElementNS(NS, 'path');
      tr.setAttribute('d', 'M-6 -7L7 0L-6 7Z');
      tr.setAttribute('fill', '#1F2E4D'); tr.setAttribute('stroke', '#F4E8CE'); tr.setAttribute('stroke-width', '2');
      tr.setAttribute('transform', 'translate(' + mx + ' ' + my + ') rotate(' + ang + ')');
      svgEl.appendChild(tr);
    }
    // casilleros: tinte + ícono; los números van arriba de las fichas
    var nums = h('div', { id: 'numeros', style: 'position:absolute;inset:0;pointer-events:none;z-index:3' });
    for (i = 1; i <= R.META; i++) {
      var t = R.tipoDe(i), esp = t !== 'normal';
      var el = h('div', { cls: 'cas' + (esp ? ' especial' : ''), style: 'left:' + POS[i][0] + 'px;top:' + POS[i][1] + 'px' });
      if (esp) {
        el.appendChild(h('div', { cls: 'tinte', style: 'background:' + TINTES[t] }));
        var ic = h('div', { cls: 'ico' }); ic.innerHTML = ICONOS[t]; el.appendChild(ic);
        if (t === 'meta') el.appendChild(h('div', { cls: 'rot', text: 'META' }));
        if (t === 'inicio') el.appendChild(h('div', { cls: 'rot', text: 'SALIDA' }));
      }
      cas.appendChild(el); casEl[i] = el;
      nums.appendChild(h('div', { cls: 'cas', style: 'left:' + POS[i][0] + 'px;top:' + POS[i][1] + 'px' }, h('span', { cls: 'num', text: String(i) })));
    }
    $('escenario').insertBefore(nums, $('izq'));
  }
  function quitarPulsos() { Object.keys(casEl).forEach(function (k) { casEl[k].classList.remove('pulsa', 'turno-cas'); }); }
  function pulsar(n) { var e = casEl[n]; if (!e) return; e.classList.remove('pulsa'); void e.offsetWidth; e.classList.add('pulsa'); }

  /* ---------- fichas ---------- */
  var ESCALA = 0.27;
  var OFF = [[-27, 0], [0, -4], [27, 0], [-14, 24], [14, 24]];   // dónde apoya cada ficha dentro de la casilla
  function crearFicha(j) {
    var m = D.fichasMeta[j.slot], w = Math.round(m[0] * ESCALA), hh = Math.round(m[1] * ESCALA);
    var el = h('div', { cls: 'ficha quieta', style: 'width:' + w + 'px;height:' + hh + 'px' },
      h('img', { src: IMG['ficha_' + j.slot], alt: j.nombre, style: 'width:100%;height:100%;display:block', draggable: 'false' }));
    el._w = w; el._h = hh;
    $('fichas').appendChild(el);
    fichasEl[j.id] = el;
    return el;
  }
  function elFicha(j) { return fichasEl[j.id] || crearFicha(j); }
  function ponerFicha(j, n, modo) {
    var el = elFicha(j), p = POS[n], o = OFF[j.slot];
    el.classList.remove('quieta', 'salto');
    if (modo === 'quieto') el.classList.add('quieta');
    else if (modo === 'salto') el.classList.add('salto');
    var pie = p[1] + o[1] + 10;
    el.style.left = (p[0] + o[0] - el._w / 2) + 'px';
    el.style.top = (pie - el._h) + 'px';
    el.style.zIndex = Math.round(pie) + j.slot;
    el._n = n;
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
  function dadoEl(v) {
    var d = h('div', { cls: 'dado' });
    for (var i = 0; i < 9; i++) d.appendChild(h('i', { cls: v && CARAS[v].indexOf(i) >= 0 ? 'on' : '' }));
    return d;
  }
  var eventoCierra = null;
  function abrirEvento(nodo) {
    var e = $('evento'); e.innerHTML = ''; e.appendChild(nodo); e.classList.remove('fuera');
  }
  async function cerrarEvento() { $('evento').classList.add('fuera'); await espera(260); }
  async function esperarEvento(ms) {
    await new Promise(function (res) {
      var t = setTimeout(res, RAPIDO ? 20 : ms);
      eventoCierra = function () { clearTimeout(t); res(); };
    });
    eventoCierra = null;
  }
  $('evento').onclick = function () { if (eventoCierra) eventoCierra(); };

  async function tirarDados(dd, nombre) {
    var d0 = dadoEl(0), d1 = dadoEl(0), suma = h('div', { cls: 'ev-suma', text: '' });
    abrirEvento(h('div', null, h('span', { cls: 'ev-quien', text: nombre + ' tira' }), h('div', { cls: 'dados' }, d0, d1), suma));
    d0.classList.add('tira'); d1.classList.add('tira');
    for (var i = 0; i < 8; i++) {
      var a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6);
      d0.replaceWith(d0 = dadoEl(a)); d1.replaceWith(d1 = dadoEl(b));
      d0.classList.add('tira'); d1.classList.add('tira');
      await espera(110);
    }
    var f0 = dadoEl(dd[0]), f1 = dadoEl(dd[1]);
    d0.replaceWith(f0); d1.replaceWith(f1);
    suma.textContent = dd[0] + ' + ' + dd[1] + ' = ' + (dd[0] + dd[1]);
    pintarDados(dd);
    await esperarEvento(1300);
    await cerrarEvento();
  }

  /* ---------- panel "última jugada" ---------- */
  function nombreJug(sala, id) { var j = R.jugadorPorId(sala, id); return j ? j.nombre : 'Alguien'; }
  function describir(sala, ult) {
    if (!ult) return { tipo: 'inicio', titulo: '¡A jugar!', texto: 'Llegá primero a la casilla 63.' };
    var j = R.jugadorPorId(sala, ult.id), nom = j ? j.nombre : 'Alguien';
    if (ult.pasa) return { tipo: 'normal', titulo: 'Turno salteado', texto: nom + ' no estaba conectado.' };
    var ef = ult.efecto, suma = ult.dados[0] + ult.dados[1], pre = nom + ' sacó ' + suma + '. ';
    var reb = ult.pasos[0] && ult.pasos[0].tipo === 'rebote' ? '¡Se pasó de la meta y rebota! ' : '';
    switch (ef.tipo) {
      case 'oca': return ef.a === R.META ? { tipo: 'oca', titulo: '¡De oca a oca!', texto: pre + 'La última oca lo lleva directo a la meta.' } : { tipo: 'oca', titulo: '¡De oca a oca!', texto: pre + 'Salta a la oca de la casilla ' + ef.a + ' y tira de nuevo.' };
      case 'puente': return { tipo: 'puente', titulo: '¡De puente a puente!', texto: pre + 'Cruza hasta la casilla ' + ef.a + ' y tira de nuevo.' };
      case 'dados': return { tipo: 'dados', titulo: '¡De dado a dado!', texto: pre + 'Salta a la casilla ' + ef.a + ' y tira de nuevo.' };
      case 'posada': return { tipo: 'posada', titulo: '¡La posada!', texto: pre + 'Se queda a descansar: pierde un turno.' };
      case 'pozo': return { tipo: 'pozo', titulo: '¡Al pozo!', texto: pre + (ef.rescata ? 'Rescata a ' + nombreJug(sala, ef.rescata) + ' y ahora se queda él.' : 'Queda atrapado hasta que otro caiga.') };
      case 'laberinto': return { tipo: 'laberinto', titulo: '¡El laberinto!', texto: pre + 'Se perdió: vuelve a la casilla ' + ef.a + '.' };
      case 'carcel': return { tipo: 'carcel', titulo: '¡A la cárcel!', texto: pre + 'Pierde dos turnos.' };
      case 'calavera': return { tipo: 'calavera', titulo: '¡La calavera!', texto: pre + 'Vuelve al principio.' };
      case 'meta': return { tipo: 'meta', titulo: '¡Llegó!', texto: nom + ' llegó a la casilla 63.' };
      default: return { tipo: 'normal', titulo: reb ? '¡Rebote!' : 'Casilla ' + ef.casillero, texto: pre + reb + (reb ? 'Queda en la ' + ef.casillero + '.' : 'Sin sorpresas.') };
    }
  }
  function pintarJugada(d) {
    $('jugada-icono').innerHTML = ICONOS[d.tipo] || ICONOS.normal;
    $('jugada-titulo').textContent = d.titulo;
    $('jugada-texto').textContent = d.texto;
  }

  /* ---------- animación de una jugada ---------- */
  async function animarJugada(sala) {
    var ult = sala.ultima, j = R.jugadorPorId(sala, ult.id);
    if (!j) return aplicar(sala, false);
    sacarFichasSobrantes(sala);
    sala.jugadores.forEach(function (x) { if (!fichasEl[x.id]) { var f = elFicha(x); ponerFicha(x, x.pos, 'quieto'); } });
    quitarTurnoMarca(); quitarPulsos();
    if (ult.pasa) {
      pintarJugada(describir(sala, ult));
      await espera(1500);
      return aplicar(sala, false);
    }
    pintarJugada({ tipo: 'dados', titulo: j.nombre + ' tira', texto: '' });
    await tirarDados(ult.dados, j.nombre);
    var pos = ult.desde, n, ruta, k;
    for (var i = 0; i < ult.pasos.length; i++) {
      var paso = ult.pasos[i];
      if (paso.tipo === 'camina' || paso.tipo === 'rebote') {
        ruta = [];
        if (paso.tipo === 'rebote') { for (n = pos + 1; n <= R.META; n++) ruta.push(n); for (n = R.META - 1; n >= paso.a; n--) ruta.push(n); }
        else for (n = pos + 1; n <= paso.a; n++) ruta.push(n);
        for (k = 0; k < ruta.length; k++) { ponerFicha(j, ruta[k], 'paso'); await espera(380); }
        pos = paso.a;
        pulsar(pos);
        var desc = describir(sala, ult);
        pintarJugada(desc);
        var tipoLlegada = ult.efecto.tipo, esRebote = ult.pasos[0].tipo === 'rebote';
        if (tipoLlegada === 'normal' && !esRebote) { await espera(900); }
        else {
          abrirEvento(h('div', null, h('div', { cls: 'ev-ico' }), h('h3', { text: desc.titulo }), h('p', { text: desc.texto }), h('div', { cls: 'ev-pie', text: 'Tocá para seguir' })));
          $('evento').querySelector('.ev-ico').innerHTML = ICONOS[desc.tipo] || ICONOS.normal;
          await esperarEvento(3600);
          await cerrarEvento();
        }
      } else {
        ponerFicha(j, paso.a, 'salto');
        pos = paso.a;
        await espera(1100);
        pulsar(pos);
        await espera(500);
      }
    }
    (ult.salteados || []).forEach(function () { });
    return aplicar(sala, false, true);
  }

  function quitarTurnoMarca() { Object.keys(fichasEl).forEach(function (id) { fichasEl[id].classList.remove('turno'); }); }

  /* ---------- aplicar un estado completo ---------- */
  async function aplicar(sala, estatico, vieneDeAnimacion) {
    app.visible = sala;
    if (sala.fase === 'sala') {
      $('fin').hidden = true;
      mostrar('sala'); pintarSala(sala);
      return;
    }
    construirTablero();
    if ($('juego').hidden) mostrar('juego');
    sacarFichasSobrantes(sala);
    quitarPulsos();
    sala.jugadores.forEach(function (j) { var el = elFicha(j); ponerFicha(j, j.pos, 'quieto'); el.classList.toggle('pozo', !!j.pozo); });
    var activo = sala.jugadores[sala.turno];
    Object.keys(fichasEl).forEach(function (id) { fichasEl[id].classList.toggle('turno', sala.fase === 'jugando' && activo && activo.id === id); });
    if (sala.fase === 'jugando' && activo && casEl[activo.pos]) casEl[activo.pos].classList.add('turno-cas');
    pintarDados(sala.ultima && sala.ultima.dados);
    if (!vieneDeAnimacion) pintarJugada(describir(sala, sala.ultima));
    else if (sala.ultima && sala.ultima.extra) { /* se mantiene el cartel del efecto */ }
    pintarJugadores(sala);
    pintarTurno(sala);
    pintarFin(sala);
    controles();
    if (vieneDeAnimacion && sala.ultima && sala.ultima.salteados && sala.ultima.salteados.length) {
      var nombres = sala.ultima.salteados.map(function (id) { return nombreJug(sala, id); }).join(', ');
      pintarJugada({ tipo: 'posada', titulo: 'Turno salteado', texto: nombres + ' no juega esta vuelta.' });
    }
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
    $('turno-nombre').textContent = app.modo === 'local' ? a.nombre : (mio ? '¡Te toca!' : a.nombre);
    $('turno-sub').textContent = mio ? (app.modo === 'local' ? 'Tira dados' : 'Tirá los dados') : (a.conectado ? 'está jugando' : 'sin señal');
  }

  function pintarJugadores(sala) {
    var cont = $('jugadores'); cont.innerHTML = '';
    var activo = sala.jugadores[sala.turno];
    sala.jugadores.forEach(function (j) {
      var fila = h('div', { cls: 'jug' + (sala.fase === 'jugando' && activo && activo.id === j.id ? ' activo' : '') + (j.conectado ? '' : ' fuera'), style: '--c:' + COLORES[j.slot] },
        h('img', { src: IMG['ficha_' + j.slot], alt: '' }),
        h('div', null, h('b', { text: j.nombre }), h('small', { text: 'Casilla ' + j.pos + (app.modo === 'red' && j.id === pid ? ' · vos' : '') })));
      var est = !j.conectado ? 'Sin señal' : j.pozo ? 'Pozo' : j.pausa > 0 ? ('Pierde ' + j.pausa) : '';
      if (est) fila.appendChild(h('span', { cls: 'estado', text: est }));
      cont.appendChild(fila);
    });
  }

  function pintarFin(sala) {
    var f = $('fin');
    if (sala.fase !== 'fin') { f.hidden = true; return; }
    var g = R.jugadorPorId(sala, sala.ganador);
    var caja = $('fin-caja'); caja.innerHTML = '';
    caja.appendChild(h('h2', { text: '¡' + g.nombre + ' ganó!' }));
    caja.appendChild(h('div', { cls: 'gana' }, h('img', { src: IMG['ficha_' + g.slot], alt: '' })));
    var ol = h('ol');
    sala.jugadores.slice().sort(function (a, b) { return b.pos - a.pos; }).forEach(function (j) {
      ol.appendChild(h('li', null, h('span', { text: j.nombre }), h('span', { text: 'casilla ' + j.pos })));
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
    b.textContent = mio ? 'Tirar dados' : 'Juega ' + (a ? a.nombre : '');
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
