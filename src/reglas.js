/* Reglas de El camino del General. Lógica pura, sin pantalla ni red.
   Sirve igual en el navegador (global Reglas) y en Node (para las pruebas). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Reglas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var META = 83;
  var MAX_JUGADORES = 5;
  var RETROCESO = 5;
  // Casilleros especiales, elegidos por el nombre real del sitio.
  var POSTAS = [9, 15, 19, 21, 22, 23, 24, 39, 45, 66, 80];   // sitios que son postas
  var CORDILLERA = [47, 51, 57, 74];                          // pasos de la cordillera
  var MATE = [13, 18, 75, 76];                                // árboles históricos: pausa
  var MULA = [12, 37, 49, 64];                                // troperos y estancias

  function tipoDe(n) {
    if (n === META) return 'meta';
    if (POSTAS.indexOf(n) >= 0) return 'posta';
    if (CORDILLERA.indexOf(n) >= 0) return 'cordillera';
    if (MATE.indexOf(n) >= 0) return 'mate';
    if (MULA.indexOf(n) >= 0) return 'mula';
    return 'sello';
  }

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  function limpiarNombre(s) {
    s = String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
    return s.slice(0, 16);
  }

  function dados(rng) {
    return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
  }

  function nuevaSala(codigo) {
    return { v: 1, codigo: codigo, fase: 'sala', seq: 0, partida: 0, jugada: 0, turno: 0, ganador: null, ultima: null, jugadores: [] };
  }

  function jugadorPorId(sala, id) {
    for (var i = 0; i < sala.jugadores.length; i++) if (sala.jugadores[i].id === id) return sala.jugadores[i];
    return null;
  }

  function slotLibre(sala) {
    for (var s = 0; s < MAX_JUGADORES; s++) {
      var ocupado = false;
      for (var i = 0; i < sala.jugadores.length; i++) if (sala.jugadores[i].slot === s) ocupado = true;
      if (!ocupado) return s;
    }
    return -1;
  }

  // Agrega a alguien a la sala, o lo reconecta si ya estaba (mismo id).
  function agregarJugador(sala, id, nombre) {
    var ya = jugadorPorId(sala, id);
    if (ya) {
      ya.conectado = true;
      var n = limpiarNombre(nombre);
      if (n && sala.fase === 'sala') ya.nombre = n;
      return { ok: true, jugador: ya, reconectado: true };
    }
    if (sala.fase !== 'sala') return { ok: false, error: 'empezada' };
    var slot = slotLibre(sala);
    if (slot < 0) return { ok: false, error: 'llena' };
    var j = { id: id, nombre: limpiarNombre(nombre) || ('Jugador ' + (slot + 1)), slot: slot, pos: 1, pausa: 0, mitad: false, conectado: true };
    sala.jugadores.push(j);
    sala.jugadores.sort(function (a, b) { return a.slot - b.slot; });
    sala.seq++;
    return { ok: true, jugador: j, reconectado: false };
  }

  function quitarJugador(sala, id) {
    if (sala.fase !== 'sala') return false;
    var antes = sala.jugadores.length;
    sala.jugadores = sala.jugadores.filter(function (j) { return j.id !== id; });
    if (sala.jugadores.length !== antes) { sala.seq++; return true; }
    return false;
  }

  function empezar(sala, rng) {
    if (sala.fase === 'jugando' || sala.jugadores.length < 2) return false;
    sala.jugadores.forEach(function (j) { j.pos = 1; j.pausa = 0; j.mitad = false; });
    sala.fase = 'jugando';
    sala.ganador = null;
    sala.ultima = null;
    sala.turno = Math.floor(rng() * sala.jugadores.length);
    sala.partida = (sala.partida || 0) + 1;
    sala.jugada = 0;
    sala.seq++;
    return true;
  }

  // Busca quién juega después de la posición idx. Las pausas del mate se cobran acá.
  function siguiente(sala, idx) {
    var n = sala.jugadores.length, salteados = [];
    for (var k = 0; k < n * 2 + 2; k++) {
      idx = (idx + 1) % n;
      var j = sala.jugadores[idx];
      if (j.pausa > 0) { j.pausa--; salteados.push(j.id); continue; }
      return { idx: idx, salteados: salteados };
    }
    return { idx: idx, salteados: salteados };
  }

  // El jugador de turno tira. Devuelve la sala nueva o null si no corresponde.
  function tirar(sala, id, dd) {
    if (sala.fase !== 'jugando') return null;
    var s = clonar(sala);
    var p = s.jugadores[s.turno];
    if (!p || p.id !== id) return null;

    var desde = p.pos;
    var total = dd[0] + dd[1];
    var mitad = false;
    if (p.mitad) { total = Math.max(1, Math.floor(total / 2)); mitad = true; p.mitad = false; }

    var destino = p.pos + total, rebote = false;
    if (destino > META) { destino = META - (destino - META); rebote = true; }
    var pasos = [{ a: destino, tipo: rebote ? 'rebote' : 'camina' }];
    p.pos = destino;

    var extra = false, efecto = { tipo: tipoDe(destino), casillero: destino };
    if (efecto.tipo === 'meta') {
      s.fase = 'fin'; s.ganador = p.id;
    } else if (efecto.tipo === 'posta') {
      var prox = null;
      for (var i = 0; i < POSTAS.length; i++) if (POSTAS[i] > destino) { prox = POSTAS[i]; break; }
      if (prox) { pasos.push({ a: prox, tipo: 'posta' }); p.pos = prox; }
      efecto.a = prox; extra = true;
    } else if (efecto.tipo === 'cordillera') {
      var atras = Math.max(1, destino - RETROCESO);
      pasos.push({ a: atras, tipo: 'retroceso' }); p.pos = atras; efecto.a = atras;
    } else if (efecto.tipo === 'mate') {
      p.pausa = 1;
    } else if (efecto.tipo === 'mula') {
      p.mitad = true; extra = true;
    }

    var salteados = [];
    if (s.fase === 'jugando' && !extra) {
      var sig = siguiente(s, s.turno);
      s.turno = sig.idx; salteados = sig.salteados;
    }
    s.ultima = { id: p.id, dados: dd, mitad: mitad, desde: desde, pasos: pasos, efecto: efecto, extra: extra, salteados: salteados };
    s.jugada++;
    s.seq++;
    return s;
  }

  // Se usa cuando el jugador de turno no está: el anfitrión le pasa el turno.
  function pasarTurno(sala) {
    if (sala.fase !== 'jugando') return null;
    var s = clonar(sala);
    var p = s.jugadores[s.turno];
    var sig = siguiente(s, s.turno);
    s.turno = sig.idx;
    s.ultima = { id: p.id, pasa: true, dados: null, pasos: [], efecto: null, extra: false, salteados: sig.salteados, desde: p.pos };
    s.jugada++;
    s.seq++;
    return s;
  }

  function reiniciar(sala, rng) {
    var s = clonar(sala);
    s.fase = 'sala';
    return empezar(s, rng) ? s : null;
  }

  return {
    META: META, MAX_JUGADORES: MAX_JUGADORES, RETROCESO: RETROCESO,
    POSTAS: POSTAS, CORDILLERA: CORDILLERA, MATE: MATE, MULA: MULA,
    tipoDe: tipoDe, dados: dados, nuevaSala: nuevaSala, agregarJugador: agregarJugador,
    quitarJugador: quitarJugador, jugadorPorId: jugadorPorId, empezar: empezar, tirar: tirar,
    pasarTurno: pasarTurno, reiniciar: reiniciar, limpiarNombre: limpiarNombre, clonar: clonar
  };
});
