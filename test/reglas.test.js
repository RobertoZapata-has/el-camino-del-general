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

// --- reglas puntuales con dados forzados ---
let s = sala(2);
s.jugadores[0].pos = 1;
let t = R.tirar(s, 'p0', [3, 4]);            // 1+7 = 8, casillero común
assert.strictEqual(t.jugadores[0].pos, 8); assert.strictEqual(t.turno, 1);

s = sala(2); s.jugadores[0].pos = 1;
t = R.tirar(s, 'p0', [4, 4]);                // 1+8 = 9 = posta -> salta a 15, vuelve a tirar
assert.strictEqual(t.jugadores[0].pos, 15); assert.strictEqual(t.turno, 0); assert.strictEqual(t.ultima.extra, true);
assert.deepStrictEqual(t.ultima.pasos.map(p => p.a), [9, 15]);

s = sala(2); s.jugadores[0].pos = 75;        // 75+5 = 80, última posta: sin salto, vuelve a tirar
t = R.tirar(s, 'p0', [2, 3]);
assert.strictEqual(t.jugadores[0].pos, 80); assert.strictEqual(t.turno, 0);

s = sala(2); s.jugadores[0].pos = 40;        // 40+7 = 47 cordillera -> retrocede 5 a 42
t = R.tirar(s, 'p0', [3, 4]);
assert.strictEqual(t.jugadores[0].pos, 42); assert.strictEqual(t.turno, 1);

s = sala(2); s.jugadores[0].pos = 8;         // 8+5 = 13 mate -> pierde el próximo turno
t = R.tirar(s, 'p0', [2, 3]);
assert.strictEqual(t.jugadores[0].pausa, 1); assert.strictEqual(t.turno, 1);
t = R.tirar(t, 'p1', [1, 1]);                 // juega p1; el turno vuelve a p1 porque p0 está en pausa
assert.strictEqual(t.turno, 1); assert.deepStrictEqual(t.ultima.salteados, ['p0']); assert.strictEqual(t.jugadores[0].pausa, 0);

s = sala(2); s.jugadores[0].pos = 5;         // 5+7 = 12 mula -> tira de nuevo con la mitad
t = R.tirar(s, 'p0', [3, 4]);
assert.strictEqual(t.jugadores[0].mitad, true); assert.strictEqual(t.turno, 0);
let t2 = R.tirar(t, 'p0', [5, 5]);            // 10 -> 5
assert.strictEqual(t2.jugadores[0].pos, 12 + 5); assert.strictEqual(t2.ultima.mitad, true); assert.strictEqual(t2.jugadores[0].mitad, false);
let t3 = R.tirar(t, 'p0', [1, 1]);            // 2 -> 1
assert.strictEqual(t3.jugadores[0].pos, 13);   // 12+1 = 13 (mate) ; la mitad nunca baja de 1

s = sala(2); s.jugadores[0].pos = 80;        // 80+6 = 86 -> rebota a 80
t = R.tirar(s, 'p0', [3, 3]);
assert.strictEqual(t.jugadores[0].pos, 80); assert.strictEqual(t.ultima.pasos[0].tipo, 'rebote');

s = sala(2); s.jugadores[0].pos = 78;        // 78+5 = 83 exacto: gana
t = R.tirar(s, 'p0', [2, 3]);
assert.strictEqual(t.fase, 'fin'); assert.strictEqual(t.ganador, 'p0');
assert.strictEqual(R.tirar(t, 'p1', [1, 2]), null);   // terminada: nadie tira

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

// --- simulación masiva ---
const rng = mulberry(20261018);
const stats = {};
for (let n = 2; n <= 5; n++) {
  let totalRolls = 0, maxRolls = 0, games = 3000;
  const wins = new Array(n).fill(0);
  for (let g = 0; g < games; g++) {
    let sa = sala(n, rng), rolls = 0;
    R.empezar(R.nuevaSala('Z'), rng);
    while (sa.fase === 'jugando') {
      const p = sa.jugadores[sa.turno];
      const nx = R.tirar(sa, p.id, R.dados(rng));
      assert.ok(nx, 'tirada válida');
      sa = nx; rolls++;
      for (const j of sa.jugadores) assert.ok(j.pos >= 1 && j.pos <= 83, 'posición válida ' + j.pos);
      assert.ok(sa.turno >= 0 && sa.turno < n);
      assert.ok(rolls < 5000, 'la partida termina');
    }
    wins[sa.jugadores.findIndex(j => j.id === sa.ganador)]++;
    totalRolls += rolls; maxRolls = Math.max(maxRolls, rolls);
  }
  stats[n] = { tiradasPorJugador: +(totalRolls / games / n).toFixed(1), maxTotal: maxRolls, ganaElPrimero: +(wins[0] / games * 100).toFixed(1) + '%' };
}
console.log('Reglas OK. Simulación (3000 partidas por cantidad de jugadores):');
console.table(stats);
