// ================================================
// Smart Chess Predictor - Main Game Script (Voices)
// ================================================

// 🔊 Voice assets
const checkSound      = new Audio("/static/sounds/check.mp3");
const voiceCheckmate  = new Audio("/static/sounds/checkmate.mp3");
const voiceStalemate  = new Audio("/static/sounds/stalemate.mp3");
const voiceIllegal    = new Audio("/static/sounds/illegal.mp3");
const voiceWhiteMove  = new Audio("/static/sounds/white_move.mp3");
const voiceBlackMove  = new Audio("/static/sounds/black_move.mp3");
const voiceAIMove     = new Audio("/static/sounds/ai_move.mp3");

// Generic safe audio helper
function playVoice(audio) {
  try {
    audio.currentTime = 0;
    audio.play();
  } catch (err) {
    console.error("Voice error:", err);
  }
}

function playCheckSound() {
  playVoice(checkSound);
}

function playIllegalMoveVoice() {
  playVoice(voiceIllegal);
}

// Expose illegal-move voice so chessboard_ui.js can call it
window.playIllegalMoveVoice = playIllegalMoveVoice;

document.addEventListener('DOMContentLoaded', () => {
  const game = new MiniChess();
  const board = new ChessboardUI('board', game);

  const startBtn   = document.getElementById('startBtn');
  const resetBtn   = document.getElementById('resetBtn');
  const flipBtn    = document.getElementById('flipBtn');
  const undoBtn    = document.getElementById('undoBtn');

  const statusEl   = document.getElementById('status-text');
  const evalEl     = document.getElementById('eval-text');
  const moveList   = document.getElementById('moveList');
  const lineBox    = document.getElementById('lineBox');

  const aiEnabled  = document.getElementById('aiEnabled');
  const onlineMode = document.getElementById('onlineMode');
  const localMode  = document.getElementById('localMode');
  const depthInput = document.getElementById('depthInput');

  const whiteCaptured = document.getElementById('whiteCaptured');
  const blackCaptured = document.getElementById('blackCaptured');

  // Best Move panel
  const bestMoveText = document.getElementById('bestMoveText');
  const bestMoveWhy  = document.getElementById('bestMoveWhy');

  let gameOver = false;
  let lastTurnSide = null;

  // ============================================
  // CLOCK
  // ============================================
  let whiteTime = 30 * 60;
  let blackTime = 30 * 60;
  let activePlayer = null;
  let timerInterval = null;
  let clockRunning = false;

  const whiteTimerEl = document.getElementById("whiteTimer");
  const blackTimerEl = document.getElementById("blackTimer");

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function updateClockDisplay() {
    if (whiteTimerEl) whiteTimerEl.textContent = formatTime(whiteTime);
    if (blackTimerEl) blackTimerEl.textContent = formatTime(blackTime);
  }

  function stopClock() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    clockRunning = false;
  }

  function startClock(player) {
    if (gameOver) return;
    stopClock();
    activePlayer = player;
    clockRunning = true;

    updateClockDisplay();

    timerInterval = setInterval(() => {
      if (!clockRunning || gameOver) {
        stopClock();
        return;
      }

      if (activePlayer === "white") {
        whiteTime--;
        if (whiteTime <= 0) {
          whiteTime = 0;
          updateClockDisplay();
          handleTimeout("White");
          return;
        }
      } else {
        blackTime--;
        if (blackTime <= 0) {
          blackTime = 0;
          updateClockDisplay();
          handleTimeout("Black");
          return;
        }
      }
      updateClockDisplay();
    }, 1000);
  }

  function handleTimeout(loser) {
    stopClock();
    gameOver = true;
    alert(`${(loser === "White") ? "Black" : "White"} wins on time!`);
  }

  function resetClock() {
    stopClock();
    whiteTime = 30 * 60;
    blackTime = 30 * 60;
    activePlayer = null;
    clockRunning = false;
    updateClockDisplay();
  }

  updateClockDisplay();

  // ============================================
  // STATUS + CAPTURES
  // ============================================
  function speakTurnIfChanged() {
    if (gameOver) return;
    const side = game.turn();
    if (side === lastTurnSide) return;
    lastTurnSide = side;
    playVoice(side === 'w' ? voiceWhiteMove : voiceBlackMove);
  }

  function updateStatus() {
    if (gameOver) return statusEl.textContent = 'Game Over';
    statusEl.textContent = (game.turn() === 'w') ? 'White to move' : 'Black to move';
    speakTurnIfChanged();
  }

  function pushMoveList() {
    moveList.innerHTML = '';
    game.history.forEach((mv, i) => {
      const from = MiniChess.toAlg(mv.from[0], mv.from[1]);
      const to   = MiniChess.toAlg(mv.to[0], mv.to[1]);
      const li = document.createElement('li');
      li.textContent = `${i + 1}. ${from} → ${to}`;
      moveList.appendChild(li);
    });
  }

  function updateCaptured() {
    const caps = game.history.map(h => h.captured).filter(Boolean);
    const whiteCaps = caps.filter(p => p === p.toUpperCase());
    const blackCaps = caps.filter(p => p === p.toLowerCase());

    const sym = {
      K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙',
      k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟︎'
    };

    whiteCaptured.textContent = blackCaps.map(p => sym[p]).join(' ');
    blackCaptured.textContent = whiteCaps.map(p => sym[p]).join(' ');
  }

  // ============================================
  // CHECKMATE + STALEMATE (unchanged)
  // ============================================
  function findKing(color) {
    const king = (color === 'w') ? 'K' : 'k';
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 8; j++)
        if (game.board[i][j] === king) return [i, j];
    return null;
  }

  function squareAttacked(x, y, attackerColor) {
    const boardArr = game.board;
    const upper = attackerColor === 'w';

    const pawnMoves = upper ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
    const pawnSymbol = upper ? 'P' : 'p';

    for (const [dx,dy] of pawnMoves) {
      const nx = x+dx, ny = y+dy;
      if (nx>=0 && nx<8 && ny>=0 && ny<8)
        if (boardArr[nx][ny] === pawnSymbol) return true;
    }

    const knightMoves = [
      [-2,-1],[-2,1],[-1,-2],[-1,2],
      [1,-2],[1,2],[2,-1],[2,1]
    ];
    const knightSymbol = upper ? 'N' : 'n';

    for (const [dx,dy] of knightMoves) {
      const nx = x+dx, ny = y+dy;
      if (nx>=0 && nx<8 && ny>=0 && ny<8)
        if (boardArr[nx][ny] === knightSymbol) return true;
    }

    const dirs = [
      [-1,-1],[-1,1],[1,-1],[1,1],
      [-1,0],[1,0],[0,-1],[0,1]
    ];

    const queen = upper ? 'Q' : 'q';
    const rook  = upper ? 'R' : 'r';
    const bish  = upper ? 'B' : 'b';

    for (const [dx,dy] of dirs) {
      let nx = x+dx, ny = y+dy;
      while (nx>=0 && nx<8 && ny>=0 && ny<8) {
        const p = boardArr[nx][ny];
        if (p) {
          if (p === queen) return true;
          if ((dx===0 || dy===0) && p === rook) return true;
          if ((dx!==0 && dy!==0) && p === bish) return true;
          break;
        }
        nx += dx; ny += dy;
      }
    }
    return false;
  }

  function kingInCheck(color) {
    const king = findKing(color);
    if (!king) return false;
    const [kx, ky] = king;
    return squareAttacked(kx, ky, color === 'w' ? 'b' : 'w');
  }

  function checkCheckmate() {
    const whiteKingAlive = game.board.some(r => r.includes('K'));
    const blackKingAlive = game.board.some(r => r.includes('k'));
    if (!whiteKingAlive || !blackKingAlive) {
      playVoice(voiceCheckmate);
      alert('Checkmate! Game Over.');
      gameOver = true;
      stopClock();
      return true;
    }
    return false;
  }

  function hasAnyLegalMove(color) {
    const originalTurn = game.turnColor;
    game.turnColor = color;

    let canMove = false;
    for (let r=0; r<8 && !canMove; r++)
      for (let c=0; c<8 && !canMove; c++) {
        const p = game.board[r][c];
        if (!p) continue;
        const isWhite = (p === p.toUpperCase());
        if ((color === 'w' && !isWhite) || (color === 'b' && isWhite)) continue;
        const moves = game.movesFrom(r,c);
        if (moves.length > 0) canMove = true;
      }

    game.turnColor = originalTurn;
    return canMove;
  }

  function checkStalemate() {
    if (gameOver) return false;
    const side = game.turn();
    if (kingInCheck(side)) return false;
    if (!hasAnyLegalMove(side)) {
      playVoice(voiceStalemate);
      alert('Stalemate! Game over.');
      gameOver = true;
      stopClock();
      return true;
    }
    return false;
  }

  // ============================================
  // BEST MOVE PANEL (unchanged)
  // ============================================
  async function updateBestMovePanel() {
    try {
      const fen = game.toFEN();
      const depth = parseInt(depthInput.value || '12', 10);

      const response = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen, depth })
      });

      const data = await response.json();
      if (data.error) {
        bestMoveText.textContent = 'Error';
        bestMoveWhy.textContent = '';
        return;
      }

      const best = data.bestmove || data.best_move || data.move || '—';
      const line = (data.continuation || []).join(' ');

      bestMoveText.textContent = best;
      bestMoveWhy.textContent =
        line ? `Good because it leads to: ${line}` :
               'AI suggests this move as strongest.';
    } catch (err) {
      bestMoveText.textContent = 'Network Error';
      bestMoveWhy.textContent = '';
    }
  }

  // ============================================
  // AI MOVE HELPERS — UPDATED PART HERE👇
  // ============================================
  async function aiMoveOnline() {
    if (gameOver) return;

    try {
      const fen = game.toFEN();
      const depth = parseInt(depthInput.value || '12', 10);

      const resp = await fetch('/predict', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ fen, depth })
      });

      const data = await resp.json();
      if (data.error) {
        evalEl.textContent = 'Eval: ' + data.error;
        return;
      }

      evalEl.textContent = 'Eval: ' + (data.evaluation ?? '—');
      lineBox.textContent = (data.continuation || []).join(' ');

      // 🔥 FIXED: online Stockfish field compatibility
      const best = data.bestmove || data.best_move || data.move;

      if (best && best.length === 4) {
        const fromAlg = best.slice(0,2);
        const toAlg   = best.slice(2,4);

        const ok = game.moveAlg(fromAlg, toAlg);
        if (ok) {
          const from = MiniChess.fromAlg(fromAlg);
          const to   = MiniChess.fromAlg(toAlg);

          board.lastMove = { from, to };
          board.render();

          playVoice(voiceAIMove);
          board.triggerMoveEvent(from, to);
        }
      }
    } catch (err) {
      evalEl.textContent = 'Eval: Network error';
    }
  }

  async function aiMoveLocal() {
    if (gameOver) return;

    try {
      const fen = game.toFEN();
      const resp = await fetch('/predict_local', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ fen })
      });

      const data = await resp.json();
      if (data.error) {
        evalEl.textContent = 'Eval: ' + data.error;
        return;
      }

      evalEl.textContent = 'Eval: ' + (data.evaluation ?? '—');
      const best = data.bestmove;

      if (best && best.length === 4) {
        const fromAlg = best.slice(0,2);
        const toAlg   = best.slice(2,4);
        const ok = game.moveAlg(fromAlg, toAlg);
        if (ok) {
          const from = MiniChess.fromAlg(fromAlg);
          const to   = MiniChess.fromAlg(toAlg);

          board.lastMove = { from, to };
          board.render();

          playVoice(voiceAIMove);
          board.triggerMoveEvent(from, to);
        }
      }
    } catch (err) {
      evalEl.textContent = 'Eval: Local ML error';
    }
  }

  async function aiMoveOffline() {
    if (gameOver) return;
    const ok = game.aiMoveGreedy();
    if (ok) {
      board.render();
      playVoice(voiceAIMove);
      board.triggerMoveEvent(null, null);
    }
  }

  // ============================================
  // AI as Black
  // ============================================
  async function maybeAIMove() {
    if (gameOver) return;
    if (game.turn() !== 'b') return;

    if (onlineMode.checked) return await aiMoveOnline();
    if (localMode.checked)  return await aiMoveLocal();
    if (aiEnabled.checked)  return await aiMoveOffline();
  }

  // ============================================
  // MAIN MOVE EVENT
  // ============================================
  document.addEventListener('move-made', async () => {
    if (gameOver) return;

    pushMoveList();
    updateCaptured();
    updateStatus();

    const nextSide = game.turn();
    startClock(nextSide === 'w' ? "white" : "black");

    const defendSide = game.turn();
    if (kingInCheck(defendSide)) {
      playCheckSound();
      alert("Check! Protect your King!");
    }

    if (checkCheckmate()) return updateStatus();
    if (checkStalemate()) return updateStatus();

    await updateBestMovePanel();
    await maybeAIMove();

    const last = game.history[game.history.length - 1];
    if (last) {
      try {
        const alg =
          `${MiniChess.toAlg(last.from[0],last.from[1])}` +
          `${MiniChess.toAlg(last.to[0],last.to[1])}`;

        await fetch('/log_move', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ move: alg })
        });
      } catch (_) {}
    }
  });

  // ============================================
  // BUTTONS
  // ============================================
  function resetAll() {
    game.reset();
    gameOver = false;
    lastTurnSide = null;
    board.lastMove = null;
    board.render();
    moveList.innerHTML = '';
    lineBox.textContent = '';
    evalEl.textContent = 'Eval: —';
    whiteCaptured.textContent = '';
    blackCaptured.textContent = '';
    bestMoveText.textContent = '—';
    bestMoveWhy.textContent = '';
    updateStatus();
    updateBestMovePanel();
  }

  startBtn.addEventListener('click', () => {
    resetAll();
    resetClock();
    activePlayer = "white";
    startClock("white");
    statusEl.textContent = "White to move";
  });

  resetBtn.addEventListener('click', () => {
    resetAll();
    resetClock();
  });

  undoBtn.addEventListener('click', () => {
    if (gameOver || game.history.length === 0) return;
    stopClock();
    const last = game.history.pop();
    const { from, to, piece, captured } = last;

    game.board[from[0]][from[1]] = piece;
    game.board[to[0]][to[1]] = captured || null;
    game.turnColor = (game.turnColor === 'w') ? 'b' : 'w';

    board.lastMove = null;
    board.render();
    pushMoveList();
    updateCaptured();
    updateStatus();
    updateBestMovePanel();
  });

  flipBtn.addEventListener('click', () => board.flip());

  aiEnabled.addEventListener('change', async () => {
    if (aiEnabled.checked) await maybeAIMove();
  });

  // ============================================
  // INITIAL
  // ============================================
  updateStatus();
  updateBestMovePanel();

  // ============================================
  // ⭐ STRATEGY PANEL SIMPLE LOGIC (unchanged)
  // ============================================
  function toAlg(row, col) { return MiniChess.toAlg(row, col); }
  function isWhitePiece(p) { return p && p === p.toUpperCase(); }
  function isBlackPiece(p) { return p && p === p.toLowerCase(); }

  function highlightSquare(squareAlg) {
    const el = document.querySelector(`.square-${squareAlg}`);
    if (el) el.classList.add("highlight-square");
  }
  function clearHighlights() {
    document.querySelectorAll(".highlight-square").forEach(el =>
      el.classList.remove("highlight-square")
    );
  }

  function findSimpleAttackMove() {
    const boardArr = game.board;
    const side = game.turn();
    for (let r=0; r<8; r++)
      for (let c=0; c<8; c++) {
        const p = boardArr[r][c];
        if (!p) continue;

        const isOwn =
          (side === 'w' && isWhitePiece(p)) ||
          (side === 'b' && isBlackPiece(p));
        if (!isOwn) continue;

        const moves = game.movesFrom(r,c) || [];
        for (const mv of moves) {
          const [nr,nc] = mv;
          const target = boardArr[nr][nc];
          if (!target) continue;

          const isEnemy =
            (side === 'w' && isBlackPiece(target)) ||
            (side === 'b' && isWhitePiece(target));
          if (isEnemy) {
            return { fromAlg: toAlg(r,c), toAlg: toAlg(nr,nc) };
          }
        }
      }
    return null;
  }

  function findSimpleThreatenedSquare() {
    const boardArr = game.board;
    const side = game.turn();
    const enemySide = side === 'w' ? 'b' : 'w';

    const isSidePiece = (p)=>
      p && ((side==='w' && isWhitePiece(p))||(side==='b'&&isBlackPiece(p)));
    const isEnemyPiece = (p)=>
      p && ((enemySide==='w' && isWhitePiece(p))||(enemySide==='b'&&isBlackPiece(p)));

    for (let r=0; r<8; r++)
      for (let c=0; c<8; c++) {
        const p = boardArr[r][c];
        if (!isEnemyPiece(p)) continue;

        const moves = game.movesFrom(r,c) || [];
        for (const mv of moves) {
          const [nr,nc] = mv;
          const target = boardArr[nr][nc];
          if (target && isSidePiece(target)) return toAlg(nr,nc);
        }
      }
    return null;
  }

  const attackBtn = document.getElementById("attackBtn");
  if (attackBtn) {
    attackBtn.addEventListener("click", () => {
      clearHighlights();
      const move = findSimpleAttackMove();
      if (move) {
        highlightSquare(move.toAlg);
        alert("Suggested Attack: " + move.fromAlg + " → " + move.toAlg);
      } else {
        alert("No simple attacking move available right now.");
      }
    });
  }

  const defendBtn = document.getElementById("defendBtn");
  if (defendBtn) {
    defendBtn.addEventListener("click", () => {
      clearHighlights();
      const threatenedSquare = findSimpleThreatenedSquare();
      if (threatenedSquare) {
        highlightSquare(threatenedSquare);
        alert("Piece under threat! Protect: " + threatenedSquare);
      } else {
        alert("No immediate threat detected.");
      }
    });
  }

}); // END DOMContentLoaded
