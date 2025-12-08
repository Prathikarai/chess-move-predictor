/**
 * FINAL CHESS.COM STYLE BOARD UI — FIXED WITH AI MOVE EVENT + ILLEGAL MOVE VOICE
 */

const Files = "abcdefgh";

const GLYPHS = {
    K:"♔", Q:"♕", R:"♖", B:"♗", N:"♘", P:"♙",
    k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟︎"
};

class ChessboardUI {
    constructor(containerId, game) {
        this.container = document.getElementById(containerId);
        this.game = game;

        this.flipped = false;
        this.selected = null;
        this.lastMove = null;
        this._squareMap = new Map();

        this._buildBoard();
        this.render();
    }

    triggerMoveEvent(from, to) {
        document.dispatchEvent(new CustomEvent("move-made", {
            detail: { from, to }
        }));
    }

    _buildBoard() {
        this.container.innerHTML = "";
        this.container.classList.add("board");

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {

                let alg = Files[c] + (8 - r);   // ⭐ algebraic square name like "e4"

                const sq = document.createElement("div");
                sq.className =
                    "square " +
                    ((r + c) % 2 === 0 ? "light" : "dark") +
                    ` square-${alg}`;     // ⭐ ADD ALGEBRAIC CLASS

                sq.dataset.rc = `${r},${c}`;

                sq.addEventListener("click", () => {
                    const [ar, ac] = this._virtualToActual(r,c);
                    this.onClick(ar, ac);
                });

                this.container.appendChild(sq);
                this._squareMap.set(`${r},${c}`, sq);
            }
        }
    }

    _virtualToActual(vr, vc){
        return this.flipped ? [7-vr, 7-vc] : [vr, vc];
    }
    _actualToVirtual(r, c){
        return this.flipped ? [7-r, 7-c] : [r, c];
    }

    render() {
        this._squareMap.forEach((sq)=>sq.innerHTML="");

        for (let vr=0; vr<8; vr++){
            for (let vc=0; vc<8; vc++){
                const [r,c] = this._virtualToActual(vr, vc);
                const piece = this.game.board[r][c];
                if (!piece) continue;

                const el = document.createElement("span");
                el.className = "piece " + (piece === piece.toUpperCase() ? "white":"black");
                el.textContent = GLYPHS[piece];
                this._squareMap.get(`${vr},${vc}`).appendChild(el);
            }
        }

        this._applyHighlights();
    }

    _applyHighlights() {
        this._squareMap.forEach(sq => {
            sq.classList.remove("selected","last-move");
        });

        if (this.lastMove) {
            const a = this._actualToVirtual(...this.lastMove.from);
            const b = this._actualToVirtual(...this.lastMove.to);
            this._squareMap.get(`${a[0]},${a[1]}`).classList.add("last-move");
            this._squareMap.get(`${b[0]},${b[1]}`).classList.add("last-move");
        }

        if (this.selected) {
            const [vr,vc] = this._actualToVirtual(...this.selected);
            this._squareMap.get(`${vr},${vc}`).classList.add("selected");
        }
    }

    onClick(r, c) {
        const piece = this.game.board[r][c];

        if (this.selected) {
            const [sr, sc] = this.selected;

            if (sr === r && sc === c) {
                this.selected = null;
                this.render();
                return;
            }

            if (this.game.moveRC(sr, sc, r, c)) {
                this.lastMove = { from: [sr, sc], to: [r, c] };
                this.selected = null;
                this.render();

                this.triggerMoveEvent([sr, sc], [r, c]);
                return;
            }

            if (window.playIllegalMoveVoice) {
                window.playIllegalMoveVoice();
            }

            this.selected = [r, c];
            this.render();
            return;
        }

        if (piece) {
            this.selected = [r, c];
            this.render();
        }
    }

    flip(){
        this.flipped = !this.flipped;
        this.render();
    }
}

window.ChessboardUI = ChessboardUI;
