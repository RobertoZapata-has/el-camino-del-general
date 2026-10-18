/* Reglas de El camino del General: Juego de la Oca clásico de 63 casillas.
   Lógica pura, sin pantalla ni red. Sirve en el navegador (global Reglas) y en Node (pruebas). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Reglas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var META = 63;
  var MAX_JUGADORES = 5;
  var OCAS = [5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59];
  var PUENTE = 6, PUENTE_A = 12;
  var POSADA = 19;
  var POZO = 31;
  var DADOS = [26, 53];
  var LABERINTO = 42, LABERINTO_A = 30;
  var CARCEL = 52;
  var CALAVERA = 58;

  function tipoDe(n) {
    if (n === META) return 'meta';
    if (n === 1) return 'inicio';
    if (OCAS.indexOf(n) >= 0) return 'oca';
    if (n === PUENTE) return 'puente';
    if (n === POSADA) return 'posada';
    if (n === POZO) return 'pozo';
    if (DADOS.indexOf(n) >= 0) return 'dados';
    if (n === LABERINTO) return 'laberinto';
    if (n === CARCEL) return 'carcel';
    if (n === CALAVERA) return 'calavera';
    return 'normal';
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
    return { v: 2, codigo: codigo, fase: 'sala', seq: 0, partida: 0, jugada: 0, turno: 0, ganador: null, ultima: null, jugadores: [] };
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
    var j = { id: id, nombre: limpiarNombre(nombre) || ('Jugador ' + (slot + 1)), slot: slot, pos: 1, pausa: 0, pozo: false, conectado: true };
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
    sala.jugadores.forEach(function (j) { j.pos = 1; j.pausa = 0; j.pozo = false; });
    sala.fase = 'jugando';
    sala.ganador = null;
    sala.ultima = null;
    sala.turno = Math.floor(rng() * sala.jugadores.length);
    sala.partida = (sala.partida || 0) + 1;
    sala.jugada = 0;
    sala.seq++;
    return true;
  }

  // Quién juega después de la posición idx. Las pausas se cobran acá; quien está en el pozo no juega.
  function siguiente(sala, idx) {
    var n = sala.jugadores.length, salteados = [];
    for (var k = 0; k < n * 3 + 2; k++) {
      idx = (idx + 1) % n;
      var j = sala.jugadores[idx];
      if (j.pozo) { salteados.push(j.id); continue; }
      if (j.pausa > 0) { j.pausa--; salteados.push(j.id); continue; }
      return { idx: idx, salteados: salteados };
    }
    return { idx: idx, salteados: salteados };
  }

  function siguienteOca(n) {
    for (var i = 0; i < OCAS.length; i++) if (OCAS[i] > n) return OCAS[i];
    return META;
  }

  // El jugador de turno tira. Devuelve la sala nueva o null si no corresponde.
  function tirar(sala, id, dd) {
    if (sala.fase !== 'jugando') return null;
    var s = clonar(sala);
    var p = s.jugadores[s.turno];
    if (!p || p.id !== id) return null;
    if (p.pozo) p.pozo = false;   // solo pasa si no queda nadie más que lo rescate

    var desde = p.pos;
    var total = dd[0] + dd[1];
    var destino = p.pos + total, rebote = false;
    if (destino > META) { destino = META - (destino - META); rebote = true; }
    var pasos = [{ a: destino, tipo: rebote ? 'rebote' : 'camina' }];
    p.pos = destino;

    var tipo = tipoDe(destino), extra = false, rescata = null;
    var efecto = { tipo: tipo, casillero: destino };

    if (tipo === 'meta') {
      s.fase = 'fin'; s.ganador = p.id;
    } else if (tipo === 'oca') {
      var prox = siguienteOca(destino);
      pasos.push({ a: prox, tipo: 'oca' }); p.pos = prox; efecto.a = prox;
      if (prox === META) { s.fase = 'fin'; s.ganador = p.id; }
      else extra = true;
    } else if (tipo === 'puente') {
      pasos.push({ a: PUENTE_A, tipo: 'puente' }); p.pos = PUENTE_A; efecto.a = PUENTE_A; extra = true;
    } else if (tipo === 'dados') {
      var otro = destino === DADOS[0] ? DADOS[1] : DADOS[0];
      pasos.push({ a: otro, tipo: 'dados' }); p.pos = otro; efecto.a = otro; extra = true;
    } else if (tipo === 'laberinto') {
      pasos.push({ a: LABERINTO_A, tipo: 'laberinto' }); p.pos = LABERINTO_A; efecto.a = LABERINTO_A;
    } else if (tipo === 'calavera') {
      pasos.push({ a: 1, tipo: 'calavera' }); p.pos = 1; efecto.a = 1;
    } else if (tipo === 'posada') {
      p.pausa = 1;
    } else if (tipo === 'carcel') {
      p.pausa = 2;
    } else if (tipo === 'pozo') {
      s.jugadores.forEach(function (q) { if (q.id !== p.id && q.pozo) { q.pozo = false; rescata = q.id; } });
      p.pozo = true;
      efecto.rescata = rescata;
    }

    var salteados = [];
    if (s.fase === 'jugando' && !extra) {
      var sig = siguiente(s, s.turno);
      s.turno = sig.idx; salteados = sig.salteados;
    }
    s.ultima = { id: p.id, dados: dd, desde: desde, pasos: pasos, efecto: efecto, extra: extra, salteados: salteados };
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
    META: META, MAX_JUGADORES: MAX_JUGADORES, OCAS: OCAS, PUENTE: PUENTE, POSADA: POSADA, POZO: POZO,
    DADOS: DADOS, LABERINTO: LABERINTO, CARCEL: CARCEL, CALAVERA: CALAVERA,
    tipoDe: tipoDe, dados: dados, nuevaSala: nuevaSala, agregarJugador: agregarJugador,
    quitarJugador: quitarJugador, jugadorPorId: jugadorPorId, empezar: empezar, tirar: tirar,
    pasarTurno: pasarTurno, reiniciar: reiniciar, limpiarNombre: limpiarNombre, clonar: clonar
  };
});
