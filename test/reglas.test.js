const R = require('../src/reglas.js');
const assert = require('assert');

function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function sala(n, rng) {
  const s = R.nuevaSala('TEST');
  for (let i = 0; i < n; i++) R.agregarJugador(s, 'p' + i, 'J' + i);
  R.empezar(s, rng || (() => 0));
  s.turno = 0;
  return s;
}
function desde(s, pos, dd, id) { s.jugadores[0].pos = pos; return R.tirar(s, id || 'p0', dd); }

// casillero común
let t = desde(sala(2), 1, [3, 4]);
assert.strictEqual(t.jugadores[0].pos, 8); assert.strictEqual(t.turno, 1);

// oca: 1+4 = 5 -> salta a 9 y tira de nuevo
t = desde(sala(2), 1, [2, 2]);
assert.strictEqual(t.jugadores[0].pos, 9); assert.strictEqual(t.turno, 0); assert.strictEqual(t.ultima.extra, true);
assert.deepStrictEqual(t.ultima.pasos.map(p => p.a), [5, 9]);

// puente: 6 -> 12 y tira de nuevo
t = desde(sala(2), 1, [2, 3]);
assert.strictEqual(t.jugadores[0].pos, 12); assert.strictEqual(t.turno, 0);

// posada: 19, pierde un turno
let s = sala(2); t = desde(s, 12, [3, 4]);
assert.strictEqual(t.jugadores[0].pos, 19); assert.strictEqual(t.jugadores[0].pausa, 1); assert.strictEqual(t.turno, 1);
t = R.tirar(t, 'p1', [1, 1]);
assert.strictEqual(t.turno, 1); assert.deepStrictEqual(t.ultima.salteados, ['p0']); assert.strictEqual(t.jugadores[0].pausa, 0);

// dados: 26 <-> 53, tira de nuevo
t = desde(sala(2), 20, [3, 3]);
assert.strictEqual(t.jugadores[0].pos, 53); assert.strictEqual(t.turno, 0);
t = desde(sala(2), 47, [3, 3]);
assert.strictEqual(t.jugadores[0].pos, 26);

// laberinto: 42 -> 30
t = desde(sala(2), 35, [3, 4]);
assert.strictEqual(t.jugadores[0].pos, 30); assert.strictEqual(t.turno, 1);

// cárcel: 52, dos turnos sin jugar
s = sala(2); t = desde(s, 46, [3, 3]);
assert.strictEqual(t.jugadores[0].pos, 52); assert.strictEqual(t.jugadores[0].pausa, 2);
t = R.tirar(t, 'p1', [1, 2]); assert.deepStrictEqual(t.ultima.salteados, ['p0']); assert.strictEqual(t.turno, 1);
t = R.tirar(t, 'p1', [1, 2]); assert.deepStrictEqual(t.ultima.salteados, ['p0']); assert.strictEqual(t.turno, 1);
t = R.tirar(t, 'p1', [1, 2]); assert.deepStrictEqual(t.ultima.salteados, []); assert.strictEqual(t.turno, 0);

// calavera: 58 -> 1
t = desde(sala(2), 50, [4, 4]);
assert.strictEqual(t.jugadores[0].pos, 1); assert.strictEqual(t.turno, 1);

// pozo: queda atrapado hasta que otro caiga
s = sala(3); t = desde(s, 25, [3, 3]);
assert.strictEqual(t.jugadores[0].pos, 31); assert.strictEqual(t.jugadores[0].pozo, true); assert.strictEqual(t.turno, 1);
t = R.tirar(t, 'p1', [1, 2]); assert.strictEqual(t.turno, 2);              // p1 -> 4
t = R.tirar(t, 'p2', [1, 2]); assert.strictEqual(t.turno, 1);              // p0 en el pozo: se saltea
assert.ok(t.ultima.salteados.indexOf('p0') >= 0);
t.jugadores[1].pos = 25;
t = R.tirar(t, 'p1', [3, 3]);                                              // p1 cae en el pozo y rescata a p0
assert.strictEqual(t.jugadores[1].pos, 31); assert.strictEqual(t.jugadores[1].pozo, true); assert.strictEqual(t.jugadores[0].pozo, false); assert.strictEqual(t.ultima.efecto.rescata, 'p0');

// rebote en la meta
t = desde(sala(2), 60, [3, 3]);
assert.strictEqual(t.jugadores[0].pos, 60); assert.strictEqual(t.ultima.pasos[0].tipo, 'rebote');
t = desde(sala(2), 62, [3, 4]);
assert.strictEqual(t.jugadores[0].pos, 57);   // 69 -> 63 - 6

// meta exacta y oca final
t = desde(sala(2), 56, [3, 4]);
assert.strictEqual(t.fase, 'fin'); assert.strictEqual(t.ganador, 'p0');
assert.strictEqual(R.tirar(t, 'p1', [1, 2]), null);
t = desde(sala(2), 54, [2, 3]);               // 59 = última oca: va a la meta
assert.strictEqual(t.fase, 'fin'); assert.strictEqual(t.ganador, 'p0'); assert.strictEqual(t.jugadores[0].pos, 63);

assert.strictEqual(R.tirar(sala(2), 'p1', [1, 2]), null);   // no es su turno

// sala llena, reconexión y nombres
const l = R.nuevaSala('X');
for (let i = 0; i < 5; i++) assert.ok(R.agregarJugador(l, 'a' + i, 'N' + i).ok);
assert.strictEqual(R.agregarJugador(l, 'a9', 'Otro').error, 'llena');
assert.ok(R.agregarJugador(l, 'a2', 'Nuevo').reconectado);
const nom = R.limpiarNombre('  <b>Roberto   Santos</b> con nombre larguísimo ');
assert.ok(!/[<>]/.test(nom) && nom.length <= 16, 'nombre limpio: ' + nom);
R.empezar(l, () => 0.5);
assert.strictEqual(R.agregarJugador(l, 'zz', 'Tarde').error, 'empezada');

// hay 13 ocas y todas las especiales son distintas
assert.strictEqual(R.OCAS.length, 13);
let esp = 0; for (let n = 1; n <= 63; n++) if (R.tipoDe(n) !== 'normal') esp++;
console.log('casilleros especiales:', esp);

// --- simulación masiva ---
const rng = mulberry(20261018);
const stats = {};
for (let n = 2; n <= 5; n++) {
  let totalRolls = 0, maxRolls = 0, games = 3000;
  const wins = new Array(n).fill(0);
  for (let g = 0; g < games; g++) {
    let sa = sala(n, rng), rolls = 0;
    while (sa.fase === 'jugando') {
      const p = sa.jugadores[sa.turno];
      const nx = R.tirar(sa, p.id, R.dados(rng));
      assert.ok(nx, 'tirada válida');
      sa = nx; rolls++;
      for (const j of sa.jugadores) assert.ok(j.pos >= 1 && j.pos <= 63, 'posición válida ' + j.pos);
      assert.ok(sa.jugadores.filter(j => j.pozo).length <= 1, 'un solo jugador en el pozo');
      assert.ok(rolls < 5000, 'la partida termina');
    }
    wins[sa.jugadores.findIndex(j => j.id === sa.ganador)]++;
    totalRolls += rolls; maxRolls = Math.max(maxRolls, rolls);
  }
  stats[n] = { tiradasPorJugador: +(totalRolls / games / n).toFixed(1), maxTotal: maxRolls, ganaElPrimero: +(wins[0] / games * 100).toFixed(1) + '%' };
}
console.log('Reglas OK. Simulación (3000 partidas por cantidad de jugadores):');
console.table(stats);
