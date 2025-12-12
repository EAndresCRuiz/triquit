
// Utilidades para crear llave single-elimination con BYEs
function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function createBracket(players) {
  // players: array de objetos {id, name}
  const total = players.length;
  const target = nextPowerOfTwo(total);
  const byes = target - total; // jugadores que avanzan automáticamente
  const shuffled = shuffle([...players]);

  const matches = [];
  // Asignar BYEs al final de la lista
  for (let i = 0; i < byes; i++) {
    const p = shuffled.pop();
    matches.push({ id: `R1-BYE-${i}`, round: 1, p1: p, p2: null, winner: p, status: 'bye' });
  }

  // Parear el resto
  let idx = 0; let m = 0;
  while (idx < shuffled.length) {
    const p1 = shuffled[idx++];
    const p2 = shuffled[idx++];
    matches.push({ id: `R1-M${m++}`, round: 1, p1, p2, winner: null, status: 'pending' });
  }

  return { round: 1, matches };
}

function advanceRound(previous) {
  // previous: { round, matches }
  const winners = previous.matches
    .map(m => m.winner)
    .filter(Boolean);
  if (winners.length <= 1) {
    return null; // torneo terminado
  }
  const next = { round: previous.round + 1, matches: [] };
  let idx = 0; let m = 0;
  while (idx < winners.length) {
    const p1 = winners[idx++];
    const p2 = winners[idx++];
    if (!p2) {
      next.matches.push({ id: `R${next.round}-BYE-${m}`, round: next.round, p1, p2: null, winner: p1, status: 'bye' });
    } else {
      next.matches.push({ id: `R${next.round}-M${m}`, round: next.round, p1, p2, winner: null, status: 'pending' });
    }
    m++;
  }
  return next;
}

module.exports = { createBracket, advanceRound };
