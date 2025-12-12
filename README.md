
# Tic Tac Toe Tournament (Gato) – Multijugador + Torneo

Aplicación web en tiempo real para organizar y jugar torneos de Tic Tac Toe con más de 150 jugadores simultáneamente. Incluye:

- Lobby de registro y contador de jugadores.
- Creación automática de llaves **single-elimination** (con BYEs si el número de jugadores no es potencia de 2).
- Gestión de rondas y avance de ganadores.
- Salas de partido aisladas con sincronización de tablero y validador de movimientos.
- Diseño moderno (glassmorphism + animaciones) y UI responsive.

## Scripts

```bash
npm install
npm run dev   # entorno local
npm start     # modo producción
```

## Estructura
```
.
├─ package.json
├─ README.md
├─ Dockerfile
├─ fly.toml
├─ server/
│  ├─ server.js
│  └─ bracket.js
└─ public/
   ├─ index.html
   ├─ styles.css
   └─ client.js
```

## Variables de entorno
- `PORT` (opcional): Puerto HTTP. Se ajusta automáticamente en proveedores como Render/Fly.

## Deploy rápido
- **Render.com**: crea un *Web Service* desde tu repo, Start Command: `npm start`.
- **Fly.io**: usa `fly launch` y `fly deploy` con los archivos `Dockerfile` y `fly.toml` incluidos.

