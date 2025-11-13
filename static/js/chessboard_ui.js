// Renders the board, supports selection, last-move highlight, and flip.
class ChessboardUI {
  constructor(containerId, game) {
    this.container = document.getElementById(containerId);
    this.game = game;
    this.selected = null;
    this.flipped = false;
    this.lastMove = null; // {from:[r,c], to:[r,c]}
    this.render();
  }

  render() {
    const board = this.game.board;
    this.container.innerHTML = '';

    for (let vr = 0; vr < 8; vr++) {
      for (let vc = 0; vc < 8; vc++) {
        const r = this.flipped ? 7 - vr : vr;
        const c = this.flipped ? 7 - vc : vc;

        const sq = document.createElement('div');
        const light = (vr + vc) % 2 === 0;
        sq.className = 'square ' + (light ? 'light' : 'dark');
        sq.dataset.rc = `${r},${c}`;

        const p = board[r][c];
        if (p) {
          const symbols = {
            K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙',
            k:'♚', q:'♛', r:'♜', b:'♝', n:'♞', p:'♟︎'
          };
          sq.textContent = symbols[p] || '';
        }

        // highlight last move squares
        if (this.lastMove &&
           ((r === this.lastMove.from[0] && c === this.lastMove.from[1]) ||
            (r === this.lastMove.to[0] && c === this.lastMove.to[1]))) {
          sq.classList.add('highlight');
        }

        // highlight current selection
        if (this.selected && r === this.selected[0] && c === this.selected[1]) {
          sq.classList.add('selected');
        }

        sq.addEventListener('click', () => this.onClick(r, c));
        this.container.appendChild(sq);
      }
    }
  }

  onClick(r, c) {
    if (this.selected) {
      const [sr, sc] = this.selected;
      if (sr === r && sc === c) { this.selected = null; this.render(); return; }
      const moved = this.game.moveRC(sr, sc, r, c);
      if (moved) {
        this.lastMove = { from:[sr,sc], to:[r,c] };
        this.selected = null;
        this.render();
        document.dispatchEvent(new CustomEvent('move-made'));
      } else {
        this.selected = [r, c];
        this.render();
      }
    } else {
      this.selected = [r, c];
      this.render();
    }
  }

  flip() { this.flipped = !this.flipped; this.render(); }
}
