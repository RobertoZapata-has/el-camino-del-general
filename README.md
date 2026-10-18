# El camino del General

Juego de la Oca clásico (63 casillas) para 2 a 5 jugadores, en una sola pantalla. Multijugador por link (PeerJS, sin servidor propio).

- `index.html`: el juego completo (autocontenido), es lo que sirve GitHub Pages.
- `src/`, `data/`, `assets/`: fuentes. `python3 build/construir.py` regenera `dist/index.html`.
- `test/`: pruebas de reglas y de sesión (`node test/reglas.test.js`).
