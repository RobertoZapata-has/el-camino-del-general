/* Sesión de juego: el anfitrión es el centro de la estrella.
   Recibe lo que piden los invitados, aplica las reglas y reparte el estado.
   No sabe nada de PeerJS: recibe funciones para enviar, así se puede probar sin red. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./reglas.js'));
  else root.Sesion = factory(root.Reglas);
})(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  var ESPERA_AUSENTE_MS = 12000;

  function Anfitrion(o) {
    this.sala = o.sala || R.nuevaSala(o.codigo);
    this.idAnfitrion = o.idAnfitrion;
    this.rng = o.rng || Math.random;
    this.enviar = o.enviar || function () {};
    this.difundir = o.difundir || function () {};
    this.alCambiar = o.alCambiar || function () {};
    this.temporizador = o.temporizador || function (fn, ms) { return setTimeout(fn, ms); };
    this.cancelar = o.cancelar || function (t) { clearTimeout(t); };
    this._espera = null;
    this.cerrada = false;
  }

  Anfitrion.prototype.estado = function () { return { t: 'estado', sala: this.sala }; };

  Anfitrion.prototype._publicar = function () {
    this.sala.seq++;
    this.difundir(this.estado());
    this.alCambiar(this.sala);
    this._vigilarTurno();
  };

  // Si le toca a alguien desconectado, se espera un rato y se le pasa el turno.
  Anfitrion.prototype._vigilarTurno = function () {
    var self = this;
    if (this._espera) { this.cancelar(this._espera); this._espera = null; }
    var s = this.sala;
    if (s.fase !== 'jugando') return;
    var p = s.jugadores[s.turno];
    if (!p || p.conectado) return;
    var jugada = s.jugada, partida = s.partida, id = p.id;
    this._espera = this.temporizador(function () {
      self._espera = null;
      var q = self.sala.jugadores[self.sala.turno];
      if (self.sala.jugada === jugada && self.sala.partida === partida && q && q.id === id && !q.conectado) {
        var n = R.pasarTurno(self.sala);
        if (n) { self.sala = n; self._publicar(); }
      }
    }, ESPERA_AUSENTE_MS);
  };

  Anfitrion.prototype.recibir = function (id, msg) {
    if (this.cerrada || !msg || typeof msg !== 'object') return;
    var s = this.sala, n;
    switch (msg.t) {
      case 'unir': {
        var r = R.agregarJugador(s, id, msg.nombre);
        if (!r.ok) { this.enviar(id, { t: 'error', e: r.error }); return; }
        if (!this.idAnfitrion) this.idAnfitrion = id;
        this._publicar();
        break;
      }
      case 'tirar': {
        n = R.tirar(s, id, R.dados(this.rng));
        if (n) { this.sala = n; this._publicar(); }
        break;
      }
      case 'empezar':
        if (id === this.idAnfitrion && R.empezar(s, this.rng)) this._publicar();
        break;
      case 'otra':
        if (id === this.idAnfitrion && s.fase === 'fin') {
          n = R.reiniciar(s, this.rng);
          if (n) { this.sala = n; this._publicar(); }
        }
        break;
      case 'saltear':
        if (id === this.idAnfitrion) {
          n = R.pasarTurno(s);
          if (n) { this.sala = n; this._publicar(); }
        }
        break;
      case 'salir':
        this.desconectado(id, true);
        break;
    }
  };

  // Se llama cuando se corta la conexión de alguien (o cuando elige salir).
  Anfitrion.prototype.desconectado = function (id, definitivo) {
    var s = this.sala, j = R.jugadorPorId(s, id);
    if (!j) return;
    if (s.fase === 'sala') {
      if (id === this.idAnfitrion) { j.conectado = false; } else { R.quitarJugador(s, id); }
    } else {
      j.conectado = false;
    }
    this._publicar();
  };

  Anfitrion.prototype.cerrar = function () {
    this.cerrada = true;
    if (this._espera) this.cancelar(this._espera);
    this.difundir({ t: 'cerrada' });
  };

  return { Anfitrion: Anfitrion, ESPERA_AUSENTE_MS: ESPERA_AUSENTE_MS };
});
