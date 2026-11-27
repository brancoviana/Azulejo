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
  const glazes=[null,['#8ac9ff','#2e74bd','#163968'],['#ffe39b','#db962e','#85501a'],['#a2edc2','#31976a','#19573e'],['#ffadb9','#bc4664','#722540'],['#d3bbff','#845bc7','#48307b'],['#9cf3df','#219c9e','#115757'],['#ffc18b','#ce6741','#87371f']];
  // Motivos em marfim, como pintura sobre o esmalte. Um por cor.
  const motifs=['M0 -3 Q-5 -13 -8 -7 Q-12 -3 -3 0 Q-13 5 -7 8 Q-3 12 0 3 Q5 13 8 7 Q12 3 3 0 Q13 -5 7 -8 Q3 -12 0 -3Z','M0 -10L2 -5 7 -7 6 -2 10 0 6 2 7 7 2 6 0 10 -2 6 -7 7 -6 2 -10 0 -6 -2 -7 -7 -2 -5Z','M-8 8Q-12 -7 9 -9Q10 10 -8 8ZM-6 6Q1 3 6 -6Z','M0 -10L9 0 0 10 -9 0ZM0 -4L-4 0 0 4 4 0Z','M5 -9A9.5 9.5 0 1 0 8 6A8.5 8.5 0 0 1 5 -9Z','M-9 -4Q-5 -10 0 -6T9 -7V-3Q5 2 0 -2T-9 0ZM-9 3Q-5 -3 0 1T9 0V4Q5 9 0 5T-9 7Z','M0 -10Q1 -2 9 0Q2 2 0 10Q-2 2 -9 0Q-1 -2 0 -10Z'].map(d=>new Path2D(d));
  const scale=Math.min(3,Math.max(1,window.devicePixelRatio||1)),board=$('board');
  board.width=Math.round(320*scale);board.height=Math.round(560*scale);ctx.scale(scale,scale);
  function rounded(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
  const faces=glazes.map((colors,i)=>{
    const cv=document.createElement('canvas');cv.width=cv.height=Math.round(40*scale);
    const c=cv.getContext('2d');c.scale(cv.width/40,cv.height/40);
    if(!i){
      const grad=c.createLinearGradient(0,0,40,40);grad.addColorStop(0,'#24455d');grad.addColorStop(1,'#3b6174');
      rounded(c,1.5,1.5,37,37,5);c.fillStyle=grad;c.fill();c.strokeStyle='#91b3b42c';c.stroke();return cv;
    }
    rounded(c,1,2,38,37,6);c.fillStyle=colors[2];c.fill();
    const grad=c.createLinearGradient(5,1,27,37);colors.forEach((v,k)=>grad.addColorStop(k/2,v));
    rounded(c,1.5,1,37,34.5,5.5);c.fillStyle=grad;c.fill();c.strokeStyle=colors[0];c.stroke();
    rounded(c,4,4,32,28,4);c.strokeStyle='#fff0d388';c.stroke();
    c.translate(20,18);c.strokeStyle=colors[2];c.lineWidth=1.6;c.stroke(motifs[i-1]);c.fillStyle='#fff1cf';c.fill(motifs[i-1],'evenodd');return cv;
  });
  function draw(){
    ctx.clearRect(0,0,320,560);
    function tile(x,y,c){ctx.drawImage(faces[c],x*40,y*40,40,40)}
    s.grid.forEach((r,y)=>r.forEach((c,x)=>tile(x,y,c)));
    if(!s.over){
      let ghost={...s.p};while(fits(s,{...ghost,y:ghost.y+1}))ghost.y++;
      ctx.save();ctx.strokeStyle='#fff2c6';ctx.setLineDash([5,3]);ctx.lineWidth=1.6;
      ghost.cells.forEach(([x,y])=>{rounded(ctx,(ghost.x+x)*40+4,(ghost.y+y)*40+4,32,32,5);ctx.fillStyle='#fff1ce22';ctx.fill();ctx.stroke()});ctx.restore();
      s.p.cells.forEach(([x,y])=>tile(s.p.x+x,s.p.y+y,s.p.c))
    }
    $('score').textContent=s.score;$('best').textContent=best;$('lines').textContent=s.lines;
    $('play').textContent=s.over?'Jogar de novo':timer!==null?'Pausar':resumed?'Continuar':'Começar';
    $('msg').textContent=s.over?'O painel encheu. Tente superar seu recorde.':timer!==null?'Complete linhas horizontais. O tracejado mostra onde a peça cai.':'Mova com as setas, gire e solte para encaixar.';
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
