// ================================================
// Smart Chess Predictor - Core Chess Logic (improved)
// ================================================

class MiniChess {
  constructor() { this.reset(); }

  reset() {
    this.board = [
      ['r','n','b','q','k','b','n','r'], // 8
      ['p','p','p','p','p','p','p','p'], // 7
      [null,null,null,null,null,null,null,null], // 6
      [null,null,null,null,null,null,null,null], // 5
      [null,null,null,null,null,null,null,null], // 4
      [null,null,null,null,null,null,null,null], // 3
      ['P','P','P','P','P','P','P','P'], // 2
      ['R','N','B','Q','K','B','N','R']  // 1
    ];
    this.turnColor = 'w';
    this.history = []; // {from:[r,c], to:[r,c], piece:'P', captured:'p'|null}
  }

  inBounds(r,c){ return r>=0 && r<8 && c>=0 && c<8; }
  pieceAt(r,c){ return this.board[r][c]; }
  turn(){ return this.turnColor; }

  static fromAlg(sq){
    const files = 'abcdefgh';
    const file = files.indexOf(sq[0]);
    const rank = parseInt(sq[1],10);
    const row = 8 - rank; // 8->0 (top)
    return [row, file];
  }
  static toAlg(r,c){
    const files = 'abcdefgh';
    const rank = 8 - r;
    return files[c] + String(rank);
  }

  movesFrom(r,c){
    const piece = this.pieceAt(r,c);
    if(!piece) return [];
    const isWhite = (piece === piece.toUpperCase());
    if( (isWhite && this.turnColor!=='w') || (!isWhite && this.turnColor!=='b') ) return [];

    const targetMoves = [];
    const add = (rr,cc) => { if(this.inBounds(rr,cc)) targetMoves.push([rr,cc]); };
    const ray = (dr,dc)=>{
      let rr=r+dr, cc=c+dc;
      while(this.inBounds(rr,cc)){
        const t = this.pieceAt(rr,cc);
        if(!t){ targetMoves.push([rr,cc]); }
        else{
          if( (isWhite && t===t.toLowerCase()) || (!isWhite && t===t.toUpperCase()) ){
            targetMoves.push([rr,cc]);
          }
          break;
        }
        rr+=dr; cc+=dc;
      }
    };

    switch(piece.toLowerCase()){
      case 'p': {
        const dir = isWhite ? -1 : 1;     // white up (row--)
        const startRow = isWhite ? 6 : 1; // white row 6, black row 1

        if(this.inBounds(r+dir,c) && !this.pieceAt(r+dir,c)) add(r+dir,c);
        if(r===startRow && !this.pieceAt(r+dir,c) && !this.pieceAt(r+2*dir,c)) add(r+2*dir,c);

        for(const dc of [-1,1]){
          const rr=r+dir, cc=c+dc;
          if(!this.inBounds(rr,cc)) continue;
          const t=this.pieceAt(rr,cc);
          if(t && ((isWhite && t===t.toLowerCase()) || (!isWhite && t===t.toUpperCase()))){
            add(rr,cc);
          }
        }
        break;
      }
      case 'n': {
        const deltas = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
        for(const [dr,dc] of deltas){
          const rr=r+dr, cc=c+dc;
          if(!this.inBounds(rr,cc)) continue;
          const t = this.pieceAt(rr,cc);
          if(!t || (isWhite && t===t.toLowerCase()) || (!isWhite && t===t.toUpperCase())) add(rr,cc);
        }
        break;
      }
      case 'b': ray(1,1); ray(1,-1); ray(-1,1); ray(-1,-1); break;
      case 'r': ray(1,0); ray(-1,0); ray(0,1); ray(0,-1); break;
      case 'q': ray(1,1); ray(1,-1); ray(-1,1); ray(-1,-1); ray(1,0); ray(-1,0); ray(0,1); ray(0,-1); break;
      case 'k': {
        for(let dr=-1; dr<=1; dr++){
          for(let dc=-1; dc<=1; dc++){
            if(dr===0 && dc===0) continue;
            const rr=r+dr, cc=c+dc;
            if(!this.inBounds(rr,cc)) continue;
            const t=this.pieceAt(rr,cc);
            if(!t || (isWhite && t===t.toLowerCase()) || (!isWhite && t===t.toUpperCase())) add(rr,cc);
          }
        }
        break;
      }
    }
    return targetMoves;
  }

  moveRC(fr,fc,tr,tc){
    const piece = this.pieceAt(fr,fc);
    if(!piece) return false;
    const legal = this.movesFrom(fr,fc).some(([rr,cc])=> rr===tr && cc===tc);
    if(!legal) return false;

    const isWhite = (piece===piece.toUpperCase());
    let newPiece = piece;

    const captured = this.pieceAt(tr,tc) || null;

    // simple auto-promotion to queen
    if(piece.toLowerCase()==='p' && (tr===0 || tr===7)){
      newPiece = isWhite ? 'Q' : 'q';
    }

    this.board[tr][tc] = newPiece;
    this.board[fr][fc] = null;
    this.history.push({from:[fr,fc], to:[tr,tc], piece:newPiece, captured});
    this.turnColor = (this.turnColor==='w') ? 'b' : 'w';
    return true;
  }

  moveAlg(fromAlg, toAlg){
    const [fr,fc] = MiniChess.fromAlg(fromAlg);
    const [tr,tc] = MiniChess.fromAlg(toAlg);
    return this.moveRC(fr,fc,tr,tc);
  }

  static pieceValue(p){ return ({p:1,n:3,b:3,r:5,q:9,k:0})[p.toLowerCase()] ?? 0; }

  aiMoveGreedy(){
    let best = null; let bestScore = -9999;
    const myColor = this.turnColor;
    for(let r=0;r<8;r++){
      for(let c=0;c<8;c++){
        const p=this.pieceAt(r,c); if(!p) continue;
        const isWhite = (p===p.toUpperCase());
        if( (myColor==='w' && !isWhite) || (myColor==='b' && isWhite) ) continue;
        const moves=this.movesFrom(r,c);
        for(const [rr,cc] of moves){
          const captured = this.pieceAt(rr,cc);
          const gain = captured ? MiniChess.pieceValue(captured) : 0;
          if(gain>bestScore){
            bestScore = gain;
            best = {fr:r,fc:c,tr:rr,tc:cc};
          }
        }
      }
    }
    if(!best){
      const all=[];
      for(let r=0;r<8;r++){
        for(let c=0;c<8;c++){
          const p=this.pieceAt(r,c); if(!p) continue;
          const isWhite = (p===p.toUpperCase());
          if( (myColor==='w' && !isWhite) || (myColor==='b' && isWhite) ) continue;
          const moves=this.movesFrom(r,c);
          for(const m of moves){ all.push({fr:r,fc:c,tr:m[0],tc:m[1]}); }
        }
      }
      if(all.length===0) return false;
      best = all[Math.floor(Math.random()*all.length)];
    }
    return this.moveRC(best.fr,best.fc,best.tr,best.tc);
  }

  toFEN(){
    let fen = '';
    for(let r=0;r<8;r++){
      let empty=0;
      for(let c=0;c<8;c++){
        const p=this.board[r][c];
        if(!p){ empty++; }
        else {
          if(empty>0){ fen += empty; empty=0; }
          fen += p;
        }
      }
      if(empty>0) fen += empty;
      if(r<7) fen += '/';
    }
    fen += ' ' + (this.turnColor==='w' ? 'w' : 'b') + ' - - 0 1';
    return fen;
  }
}
