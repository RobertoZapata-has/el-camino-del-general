const assert = require('assert');
const R = require('../src/reglas.js');
const { Anfitrion, ESPERA_AUSENTE_MS } = require('../src/sesion.js');

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Red simulada: cada cliente tiene su buzón; el anfitrión es el centro.
function armar(seed) {
  const rng = mulberry(seed);
  const timers = []; let ahora = 0;
  const clientes = {};           // id -> {sala, conectado}
  const cola = [];
  const host = new Anfitrion({
    codigo: 'ABCDE', idAnfitrion: 'h', rng,
    enviar: (id, m) => cola.push([id, JSON.parse(JSON.stringify(m))]),
    difundir: (m) => { for (const id in clientes) if (clientes[id].conectado) cola.push([id, JSON.parse(JSON.stringify(m))]); },
    temporizador: (fn, ms) => { const t = { fn, en: ahora + ms, vivo: true }; timers.push(t); return t; },
    cancelar: (t) => { if (t) t.vivo = false; }
  });
  function vaciar() {
    while (cola.length) {
      const [id, m] = cola.shift();
      if (clientes[id] && m.t === 'estado') clientes[id].sala = m.sala;
      if (clientes[id] && m.t === 'error') clientes[id].error = m.e;
    }
  }
  function conectar(id, nombre) {
    clientes[id] = clientes[id] || { sala: null, conectado: true };
    clientes[id].conectado = true;
    host.recibir(id, { t: 'unir', nombre });
    vaciar();
  }
  function enviar(id, msg) { host.recibir(id, msg); vaciar(); }
  function caer(id) { clientes[id].conectado = false; host.desconectado(id); vaciar(); }
  function avanzar(ms) {
    ahora += ms;
    for (const t of timers.filter(t => t.vivo && t.en <= ahora)) { t.vivo = false; t.fn(); }
    vaciar();
  }
  return { host, clientes, conectar, enviar, caer, avanzar, vaciar, rng };
}

function mismoEstado(net) {
  for (const id in net.clientes) {
    const c = net.clientes[id];
    if (!c.conectado) continue;
    assert.deepStrictEqual(c.sala, net.host.sala, 'el cliente ' + id + ' ve lo mismo que el anfitrión');
  }
}

// --- 5 jugadores, partida completa con caídas y reconexiones ---
for (let seed = 1; seed <= 200; seed++) {
  const net = armar(seed);
  net.conectar('h', 'Anfitrión');
  ['a', 'b', 'c', 'd'].forEach((id, i) => net.conectar(id, 'Invitado ' + i));
  mismoEstado(net);
  net.conectar('e', 'Sobra'); assert.strictEqual(net.clientes.e.error, 'llena');
  assert.strictEqual(net.host.sala.jugadores.length, 5);

  net.enviar('a', { t: 'empezar' });                       // un invitado no puede empezar
  assert.strictEqual(net.host.sala.fase, 'sala');
  net.enviar('h', { t: 'empezar' });
  assert.strictEqual(net.host.sala.fase, 'jugando');
  mismoEstado(net);

  let pasos = 0, caidas = 0;
  while (net.host.sala.fase === 'jugando') {
    const s = net.host.sala; const p = s.jugadores[s.turno];
    const otro = s.jugadores.find(j => j.id !== p.id);
    net.enviar(otro.id, { t: 'tirar' });                    // fuera de turno: se ignora
    assert.strictEqual(net.host.sala.seq, s.seq);

    if (net.rng() < 0.03 && p.id !== 'h') {                 // se cae el que juega
      net.caer(p.id); caidas++;
      assert.strictEqual(net.host.sala.turno, s.turno);
      if (net.rng() < 0.5) net.conectar(p.id, 'vuelvo');     // vuelve antes de que se le pase el turno
      else { net.avanzar(ESPERA_AUSENTE_MS + 1); assert.notStrictEqual(net.host.sala.jugadores[net.host.sala.turno].id, p.id); net.conectar(p.id, 'vuelvo'); }
    } else {
      net.enviar(p.id, { t: 'tirar' });
    }
    mismoEstado(net);
    assert.ok(++pasos < 6000, 'termina');
  }
  assert.ok(net.host.sala.ganador);
  net.enviar('h', { t: 'otra' });
  assert.strictEqual(net.host.sala.fase, 'jugando'); assert.strictEqual(net.host.sala.jugadores.every(j => j.pos === 1), true);
  mismoEstado(net);
}

// --- sala: el que se va libera el lugar; reconectar conserva el lugar ---
{
  const net = armar(7);
  net.conectar('h', 'H'); net.conectar('a', 'A'); net.conectar('b', 'B');
  net.caer('a'); assert.strictEqual(net.host.sala.jugadores.length, 2);
  net.conectar('c', 'C'); assert.strictEqual(net.host.sala.jugadores.find(j => j.id === 'c').slot, 1);
  net.enviar('h', { t: 'empezar' });
  net.caer('b'); net.conectar('b', 'B');
  assert.strictEqual(net.host.sala.jugadores.find(j => j.id === 'b').conectado, true);
  net.conectar('z', 'Tarde'); assert.strictEqual(net.clientes.z.error, 'empezada');
}
console.log('Sesión OK: 200 partidas de 5 con caídas, reconexiones y pases de turno.');
