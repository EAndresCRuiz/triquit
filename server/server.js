
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createBracket, advanceRound } = require('./bracket');

const app = express();
app.use(cors());
app.use(express.static('public'));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 8080;

// Estado del torneo en memoria
let players = new Map(); // id -> { id, name, connected, socketId }
let tournament = null; // {round, matches}
let matchesState = new Map(); // matchId -> { board, turn, winner, players: {X, O}, room }
let started = false;

function resetTournament() {
  tournament = null;
  matchesState.clear();
  started = false;
}

let hostId = null; // id del jugador que puede iniciar el torneo
let scoreboard = new Map(); // playerId -> { name, points, wins, losses, ties }

function emitScoreboard() {
  const table = Array.from(scoreboard.entries()).map(([id, s]) => ({ id, ...s }));
  // Ordenar por puntos y victorias
  table.sort((a, b) => (b.points - a.points) || (b.wins - a.wins) || a.name.localeCompare(b.name));
  io.emit('scoreboard', table);
}

io.on('connection', (socket) => {
  // Registro de jugador
  socket.on('register', (name) => {
    const id = uuidv4();
    const player = { id, name: (name || 'Anónimo').slice(0, 32), connected: true, socketId: socket.id };
    players.set(id, player);
    socket.join('lobby');
    socket.emit('registered', player);
    io.to('lobby').emit('player_list', Array.from(players.values()));

    if (!hostId) {
      hostId = id;
      io.emit('host_set', { hostId }); // informa a todos quién es el organizador
    }

    scoreboard.set(id, { name: player.name, points: 0, wins: 0, losses: 0, ties: 0 });
    emitScoreboard();
  });


  socket.on('start_tournament', () => {
    if (started) return;


    const caller = Array.from(players.values()).find(p => p.socketId === socket.id);
    if (!caller || caller.id !== hostId) {
      socket.emit('error_msg', 'Solo el organizador puede iniciar el torneo.');
      return;
    }

    const playerList = Array.from(players.values());
    if (playerList.length < 2) {
      socket.emit('error_msg', 'Se requieren al menos 2 jugadores.');
      return;
    }

    tournament = createBracket(playerList);
    started = true;
    io.emit('tournament_started', { round: tournament.round });
    io.emit('pairings', tournament.matches);

    for (const m of tournament.matches) {
      if (m.status === 'pending') setupMatch(m);
    }
    proceedIfRoundFinished();

  });

  socket.on('join_match', ({ matchId, playerId }) => {
    const match = matchesState.get(matchId);
    if (!match) return;
    const p = players.get(playerId);
    if (!p) return;
    socket.join(match.room);
    socket.emit('match_state', { matchId, board: match.board, turn: match.turn, players: match.players, winner: match.winner });
  });


  socket.on('move', ({ matchId, playerId, cell }) => {
    const match = matchesState.get(matchId);
    if (!match || match.winner) return;

    const symbol = (match.players.X && match.players.X.id === playerId)
      ? 'X'
      : (match.players.O && match.players.O.id === playerId)
        ? 'O'
        : null;
    if (!symbol) return;
    if (match.turn !== symbol) return;
    if (cell < 0 || cell > 8) return;
    if (match.board[cell] !== null) return;

    match.board[cell] = symbol;
    match.turn = symbol === 'X' ? 'O' : 'X';

    const w = checkWinner(match.board);
    if (w) {
      match.winner = w;
      const winnerPlayer = match.players[w];
      const loserPlayer = (w === 'X') ? match.players.O : match.players.X;

      // --- NUEVO: actualizar marcador (victoria +3, derrota +0) ---
      const sw = scoreboard.get(winnerPlayer.id);
      sw.points += 3; sw.wins += 1; scoreboard.set(winnerPlayer.id, sw);

      const sl = scoreboard.get(loserPlayer.id);
      sl.losses += 1; scoreboard.set(loserPlayer.id, sl);
      emitScoreboard();

      // Notifica resultado a TODOS (no solo a la sala)
      io.emit('match_result', {
        matchId,
        round: tournament.round,
        winner: { id: winnerPlayer.id, name: winnerPlayer.name },
        loser: { id: loserPlayer.id, name: loserPlayer.name }
      });

      // Actualiza la llave del torneo
      const tm = tournament.matches.find(x => x.id === matchId);
      tm.winner = winnerPlayer;
      tm.status = 'finished';
      io.to(match.room).emit('match_update', {
        matchId, board: match.board, turn: match.turn,
        winner: { symbol: w, player: winnerPlayer }
      });
      proceedIfRoundFinished();

    } else if (match.board.every(c => c !== null)) {
      // --- NUEVO: EMPATE → repetir partida ---
      const pX = match.players.X, pO = match.players.O;

      // Actualizar marcador: empate +1 para ambos
      const sX = scoreboard.get(pX.id); sX.ties += 1; sX.points += 1; scoreboard.set(pX.id, sX);
      const sO = scoreboard.get(pO.id); sO.ties += 1; sO.points += 1; scoreboard.set(pO.id, sO);
      emitScoreboard();

      // Notificar empate a todos
      io.emit('match_tie', { matchId, round: tournament.round, players: { X: pX.name, O: pO.name } });

      // Reiniciar tablero y turno aleatorio (repetición)
      match.board = Array(9).fill(null);
      match.turn = Math.random() < 0.5 ? 'X' : 'O';
      io.to(match.room).emit('match_restart', { matchId, board: match.board, turn: match.turn });

    } else {
      io.to(match.room).emit('match_update', { matchId, board: match.board, turn: match.turn });
    }
  });


  socket.on('disconnect', () => {
    // marcar jugador como desconectado
    const playerEntry = Array.from(players.values()).find(p => p.socketId === socket.id);
    if (playerEntry) {
      playerEntry.connected = false;
    }
  });
});

function setupMatch(m) {
  const room = `room-${m.id}`;
  const p1 = m.p1; const p2 = m.p2;
  const board = Array(9).fill(null);
  const turn = Math.random() < 0.5 ? 'X' : 'O';
  const playersMap = turn === 'X' ? { X: p1, O: p2 } : { X: p2, O: p1 };
  matchesState.set(m.id, { board, turn, players: playersMap, winner: null, room });
  io.to('lobby').emit('match_created', { matchId: m.id, room, players: playersMap, round: m.round });

  // Notificar a cada jugador su asignación
  [p1, p2].forEach((p) => {
    const sock = io.sockets.sockets.get(p.socketId);
    if (sock) {
      sock.join(room);
      sock.emit('match_assigned', { matchId: m.id, room, symbol: (playersMap.X.id === p.id ? 'X' : 'O') });
    }
  });
}

function proceedIfRoundFinished() {
  const pending = tournament.matches.filter(m => m.status === 'pending');
  if (pending.length > 0) return;
  const next = advanceRound(tournament);
  if (!next) {
    // terminado
    const champ = tournament.matches.find(m => m.winner && m.round === tournament.round)?.winner;
    io.emit('tournament_finished', { champion: champ });
    resetTournament();
    return;
  }
  tournament = next;
  io.emit('round_advanced', { round: tournament.round });
  io.emit('pairings', tournament.matches);
  for (const m of tournament.matches) {
    if (m.status === 'pending') setupMatch(m);
  }
  proceedIfRoundFinished();
}

function checkWinner(b) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // filas
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columnas
    [0, 4, 8], [2, 4, 6]          // diagonales
  ];
  for (const [a, b2, c] of lines) {
    if (b[a] && b[a] === b[b2] && b[a] === b[c]) return b[a];
  }
  return null;
}

server.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
