'use strict';
(()=>{
  const W=8,H=14,shapes=[[[0,0],[1,0],[2,0]],[[0,0],[0,1],[1,1]],[[0,0],[1,0],[1,1],[2,1]],[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]],[[0,0],[0,1],[0,2],[1,2]],[[0,0],[1,0]]];
  const row=()=>Array(W).fill(0);
  function spawn(){const i=Math.floor(Math.random()*shapes.length);return {x:3,y:0,c:1+i,cells:shapes[i]}}
  function fresh(){return {grid:Array.from({length:H},row),p:spawn(),score:0,lines:0,over:false}}
  function fits(s,p){return p.cells.every(([dx,dy])=>{const x=p.x+dx,y=p.y+dy;return x>=0&&x<W&&y>=0&&y<H&&!s.grid[y][x]})}
  function move(s,dx,dy){const p={...s.p,x:s.p.x+dx,y:s.p.y+dy};if(!fits(s,p))return false;s.p=p;return true}
  function rotate(s){
    const h=Math.max(...s.p.cells.map(c=>c[1]));
    const cells=s.p.cells.map(([x,y])=>[h-y,x]);
    for(const kick of [0,-1,1,-2,2]){const p={...s.p,x:s.p.x+kick,cells};if(fits(s,p)){s.p=p;return true}}
    return false;
  }
  function step(s){
    if(s.over||move(s,0,1))return;
    const p=s.p;for(const [x,y] of p.cells)s.grid[p.y+y][p.x+x]=p.c;
    const kept=s.grid.filter(r=>r.includes(0)),n=H-kept.length;
    s.grid=[...Array.from({length:n},row),...kept];s.lines+=n;s.score+=p.cells.length+25*n*n;
    s.p=spawn();s.over=!fits(s,s.p);
  }
  if(typeof module!=='undefined'){module.exports={fresh,step,move,fits,rotate};return}
  const key='azulejo-queda-v1',bestKey='azulejo-queda-best',$=id=>document.getElementById(id),ctx=$('board').getContext('2d');
  let s=fresh(),best=0,resumed=false,timer=null;
  try{
    best=Number(localStorage.getItem(bestKey))||0;
    const t=JSON.parse(localStorage.getItem(key));
    if(t&&Number.isInteger(t.score)&&Number.isInteger(t.lines)&&typeof t.over==='boolean'&&t.grid.length===H&&t.grid.every(r=>r.length===W&&r.every(v=>Number.isInteger(v)&&v>=0&&v<=7))&&t.p.cells.length&&Number.isInteger(t.p.x)&&Number.isInteger(t.p.y)&&(t.over||fits(t,t.p))){s=t;resumed=true}
  }catch{}
  const palette=['#35596e','#287cba','#c67c20','#33956a','#a64164','#8352ac','#238f96','#cb5d37'];
  function draw(){
    ctx.clearRect(0,0,320,560);
    function tile(x,y,c){ctx.fillStyle=palette[c];ctx.fillRect(x*40+1,y*40+1,38,38);if(c){ctx.strokeStyle='#fff2cf';ctx.strokeRect(x*40+5,y*40+5,30,30);ctx.fillStyle='#fff2cf';ctx.fillRect(x*40+17,y*40+17,6,6)}}
    s.grid.forEach((r,y)=>r.forEach((c,x)=>tile(x,y,c)));
    if(!s.over){
      let ghost={...s.p};while(fits(s,{...ghost,y:ghost.y+1}))ghost.y++;
      ctx.globalAlpha=.24;ghost.cells.forEach(([x,y])=>tile(ghost.x+x,ghost.y+y,ghost.c));ctx.globalAlpha=1;
      s.p.cells.forEach(([x,y])=>tile(s.p.x+x,s.p.y+y,s.p.c))
    }
    $('score').textContent=s.score;$('best').textContent=best;$('lines').textContent=s.lines;
    $('play').textContent=s.over?'Jogar de novo':timer!==null?'Pausar':resumed?'Continuar':'Começar';
    $('msg').textContent=s.over?'O painel encheu. Tente superar seu recorde.':timer!==null?'Complete linhas horizontais. A sombra mostra onde a peça cai.':'Mova com as setas, gire e solte para encaixar.';
    document.querySelectorAll('[data-act]').forEach(b=>b.disabled=timer===null)
  }
  function save(){best=Math.max(best,s.score);try{localStorage.setItem(key,JSON.stringify(s));localStorage.setItem(bestKey,String(best))}catch{}}
  function pause(){clearTimeout(timer);timer=null;draw()}
  function schedule(){timer=setTimeout(()=>{step(s);save();if(s.over)pause();else{schedule();draw()}},Math.max(230,950-45*Math.floor(s.lines/3)))}
  $('play').onclick=()=>{if(timer!==null){pause();return}if(s.over)s=fresh();resumed=true;save();schedule();draw()};
  function act(a){if(timer===null||s.over)return;
    if(a==='left'||a==='right')move(s,a==='left'?-1:1,0);
    if(a==='turn')rotate(s);
    if(a==='drop'){while(move(s,0,1)){}step(s);clearTimeout(timer);timer=null;if(!s.over)schedule()}
    save();draw();
  }
  document.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>act(b.dataset.act));
  document.addEventListener('keydown',e=>{const a={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'turn',ArrowDown:'drop'}[e.key];if(a&&timer!==null){e.preventDefault();act(a)}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});window.addEventListener('pagehide',pause);draw();
})();
