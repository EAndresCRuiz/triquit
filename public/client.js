
const socket = io();
let me = null;
let currentMatch = null;
let mySymbol = null;

const nameInput = document.getElementById('nameInput');
const registerBtn = document.getElementById('registerBtn');
const startBtn = document.getElementById('startBtn');
const playersList = document.getElementById('playersList');
const playersCount = document.getElementById('playersCount');
const pairings = document.getElementById('pairings');
const roundNum = document.getElementById('roundNum');
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const matchInfo = document.getElementById('matchInfo');

let hostId = null;
const scoreboardEl = document.getElementById('scoreboard');
const resultsEl = document.getElementById('results');


registerBtn.addEventListener('click', () => {
  socket.emit('register', nameInput.value);
});

startBtn.addEventListener('click', () => {
  socket.emit('start_tournament');
});

socket.on('registered', (player) => {
  me = player;
  registerBtn.disabled = true;
  nameInput.disabled = true;
   applyHostGuard();
});

socket.on('host_set', ({ hostId: hid }) => {
  hostId = hid;
  applyHostGuard();
});

socket.on('player_list', (list) => {
  playersCount.textContent = `Jugadores: ${list.length}`;
  playersList.innerHTML = '';
  list.forEach(p => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${p.name}</span><span class="dot ${p.connected?'online':'offline'}"></span>`;
    playersList.appendChild(li);
  });
});

function applyHostGuard() {
  const canStart = me && me.id === hostId;
  startBtn.disabled = !canStart;
  startBtn.title = canStart ? 'Eres el organizador' : 'Solo el organizador puede iniciar el torneo';
}

socket.on('tournament_started', ({ round }) => {
  roundNum.textContent = round;
});

socket.on('pairings', (matches) => {
  pairings.innerHTML = '';
  matches.forEach(m => {
    const div = document.createElement('div');
    div.className = 'pair';
    const p1 = m.p1 ? m.p1.name : 'BYE';
    const p2 = m.p2 ? m.p2.name : 'BYE';
    const status = m.status === 'bye' ? 'BYE' : (m.winner ? `Ganador: ${m.winner.name}` : 'Pendiente');
    div.innerHTML = `<div class="round">Ronda ${m.round}</div><div><strong>${p1}</strong> vs <strong>${p2}</strong></div><div class="muted">${status}</div>`;
    pairings.appendChild(div);
  });
});

socket.on('match_created', ({ matchId, room, players, round }) => {
  // Información general
});

socket.on('match_assigned', ({ matchId, room, symbol }) => {
  currentMatch = matchId;
  mySymbol = symbol;
  matchInfo.textContent = `Partido ${matchId} • Tú eres ${symbol}`;
  socket.emit('join_match', { matchId, playerId: me.id });
});

socket.on('match_state', ({ matchId, board, turn, players, winner }) => {
  renderBoard(board);
  if (winner) {
    statusEl.textContent = `Ganador: ${winner.player.name}`;
  } else {
    statusEl.textContent = `Turno: ${turn}`;
  }
});

socket.on('match_update', ({ matchId, board, turn, winner, tie }) => {
  renderBoard(board);
  if (winner) {
    statusEl.textContent = `Ganador: ${winner.player.name}`;
  } else if (tie) {
    statusEl.textContent = `Empate. Se reinicia el tablero (sudden death).`;
  } else {
    statusEl.textContent = `Turno: ${turn}`;
  }
});

socket.on('round_advanced', ({ round }) => {
  roundNum.textContent = round;
});

socket.on('tournament_finished', ({ champion }) => {
  alert(`¡Campeón: ${champion.name}!`);
});

boardEl.addEventListener('click', (e) => {
  if (!currentMatch || !me) return;
  const cellEl = e.target.closest('.cell');
  if (!cellEl) return;
  const idx = parseInt(cellEl.dataset.idx, 10);
  socket.emit('move', { matchId: currentMatch, playerId: me.id, cell: idx });
});

function renderBoard(board) {
  Array.from(boardEl.children).forEach((cellEl, idx) => {
    cellEl.textContent = board[idx] || '';
  });
}


startBtn.addEventListener('click', () => {
  if (!me || me.id !== hostId) {
    alert('Solo el organizador puede iniciar el torneo.');
    return;
  }
  socket.emit('start_tournament');
});

socket.on('scoreboard', (table) => {
  scoreboardEl.innerHTML = '';
  table.forEach(row => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${row.name}</span>
      <span class="muted">Pts: ${row.points} • W:${row.wins} E:${row.ties} D:${row.losses}</span>
    `;
    scoreboardEl.appendChild(li);
  });
});

socket.on('match_result', ({ round, winner, loser }) => {
  addResult(`R${round}: ${winner.name} venció a ${loser.name}`);
});

socket.on('match_tie', ({ round, players }) => {
  addResult(`R${round}: Empate entre ${players.X} y ${players.O}. Se repite la partida.`);
});

function addResult(text) {
  const li = document.createElement('li');
  li.textContent = text;
  resultsEl.prepend(li); // el más reciente arriba
}

socket.on('match_restart', ({ matchId, board, turn }) => {
  renderBoard(board);
  statusEl.textContent = `Empate. Se repite la partida. Turno: ${turn}`;
});
