# El camino del General

Juego de la Oca sanmartiniana para 2 a 5 jugadores: se avanza por los 83 sellos del Pasaporte Nacional Sanmartiniano. Multijugador por link (PeerJS, sin servidor propio).

- `index.html`: el juego completo (autocontenido), es lo que sirve GitHub Pages.
- `src/`, `data/`, `assets/`: fuentes. `python3 build/construir.py` regenera `dist/index.html`.
- `test/`: pruebas de reglas y de sesión (`node test/reglas.test.js`).
