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

  function updateStatus() {
    statusEl.textContent = (game.turn() === 'w') ? 'White to move' : 'Black to move';
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
    // mv.captured holds the piece present at destination before the move
    const caps = game.history.map(h => h.captured).filter(Boolean);
    const whiteCaps = caps.filter(p => p === p.toUpperCase());
    const blackCaps = caps.filter(p => p === p.toLowerCase());

    const sym = { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙',
                  k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟︎' };

    whiteCaptured.textContent = blackCaps.map(p => sym[p]).join(' ');
    blackCaptured.textContent = whiteCaps.map(p => sym[p]).join(' ');
  }

  async function aiMoveOnline() {
    try {
      const fen = game.toFEN();
      const depth = parseInt(depthInput.value || '12', 10);
      const resp = await fetch('/predict', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ fen, depth })
      });
      const data = await resp.json();
      if (data.error) { evalEl.textContent = 'Eval: ' + data.error; return; }
      evalEl.textContent = 'Eval: ' + (data.evaluation ?? '—');
      lineBox.textContent = (data.continuation || []).join(' ');
      const best = data.bestmove;
      if (best && best.length === 4) {
        const ok = game.moveAlg(best.slice(0,2), best.slice(2,4));
        if (ok) {
          board.lastMove = { from: MiniChess.fromAlg(best.slice(0,2)), to: MiniChess.fromAlg(best.slice(2,4)) };
          board.render(); pushMoveList(); updateCaptured(); updateStatus();
        }
      }
    } catch (err) {
      console.error(err);
      evalEl.textContent = 'Eval: Network error';
    }
  }

  async function aiMoveLocal() {
    try {
      const fen = game.toFEN();
      const resp = await fetch('/predict_local', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ fen })
      });
      const data = await resp.json();
      if (data.error) { evalEl.textContent = 'Eval: ' + data.error; return; }
      evalEl.textContent = 'Eval: ' + (data.evaluation ?? '—');
      const best = data.bestmove;
      if (best && best.length === 4) {
        const ok = game.moveAlg(best.slice(0,2), best.slice(2,4));
        if (ok) {
          board.lastMove = { from: MiniChess.fromAlg(best.slice(0,2)), to: MiniChess.fromAlg(best.slice(2,4)) };
          board.render(); pushMoveList(); updateCaptured(); updateStatus();
        }
      }
    } catch (err) {
      console.error(err);
      evalEl.textContent = 'Eval: Local model error';
    }
  }

  async function aiMoveOffline() {
    const ok = game.aiMoveGreedy();
    if (ok) { board.render(); pushMoveList(); updateCaptured(); updateStatus(); }
  }

  async function maybeAIMove() {
    if (!aiEnabled.checked) return;
    if (game.turn() === 'b') {
      if (localMode.checked) await aiMoveLocal();
      else if (onlineMode.checked) await aiMoveOnline();
      else await aiMoveOffline();
    }
  }

  document.addEventListener('move-made', async () => {
    pushMoveList();
    updateCaptured();
    updateStatus();
    await maybeAIMove();

    // log last move to backend (optional)
    const last = game.history[game.history.length - 1];
    if (last) {
      try {
        const moveAlg = `${MiniChess.toAlg(last.from[0],last.from[1])}${MiniChess.toAlg(last.to[0],last.to[1])}`;
        await fetch('/log_move', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ move: moveAlg })
        });
      } catch (_) {}
    }
  });

  startBtn.addEventListener('click', () => {
    game.reset();
    board.lastMove = null;
    board.render();
    moveList.innerHTML = '';
    lineBox.textContent = '';
    evalEl.textContent = 'Eval: —';
    whiteCaptured.textContent = '';
    blackCaptured.textContent = '';
    updateStatus();
  });

  resetBtn.addEventListener('click', () => {
    game.reset();
    board.lastMove = null;
    board.render();
    moveList.innerHTML = '';
    lineBox.textContent = '';
    evalEl.textContent = 'Eval: —';
    whiteCaptured.textContent = '';
    blackCaptured.textContent = '';
    updateStatus();
  });

  undoBtn.addEventListener('click', () => {
    if (game.history.length === 0) return;
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
  });

  flipBtn.addEventListener('click', () => board.flip());

  // initial UI
  updateStatus();
});
