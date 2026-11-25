/* Protótipo independente. Cada desenho contém uma lacuna assimétrica. */
(()=>{
  const A=typeof module!=='undefined'?require('./logic.js'):window.AzulejoLogic;
  const rounds=[
    {shape:13,color:0,col:6,gaps:[3],left:2},
    {shape:2,color:4,col:5,gaps:[2,3],left:1},
    {shape:29,color:3,col:5,gaps:[4,5],left:3}
  ];
  function panel(round){
    const g=A.emptyGrid();
    for(let y=0;y<8;y++)if(!round.gaps.includes(y))g[y][round.col]=(y+1)%6;
    g[7][round.left]=2;return g;
  }
  function project(g,shape,x,y){
    const cells=A.SHAPE_DATA[shape].cells.flatMap(([r,c])=>[[x+c,y+r],[7-x-c,y+r]]);
    return {cells,valid:cells.every(([i,j])=>i>=0&&i<8&&j>=0&&j<8&&g[j][i]<0)&&new Set(cells.map(([i,j])=>i+8*j)).size===cells.length};
  }
  if(typeof module!=='undefined'){module.exports={rounds,panel,project};return}
  const $=id=>document.getElementById(id),board=$('mirrorBoard'),ctx=board.getContext('2d'),piece=$('mirrorPiece'),next=$('nextMirror'),msg=$('mirrorMsg');
  let n,g,preview,held=null,won,round;
  const colors=['#3169b9','#c77924','#258654','#bc3555','#168987','#784cb0'];
  // Primeiro encaixe: o L à esquerda leva a ponta do reflexo à lacuna dourada.
  function tutorial(){return project(g,round.shape,0,2)}
  function draw(){
    ctx.fillStyle='#274b64';ctx.fillRect(0,0,400,400);
    for(let j=0;j<8;j++)for(let i=0;i<8;i++){
      const x=i*50+2,y=j*50+2;ctx.fillStyle=i===round.col?'#677f7f':'#3d647b';ctx.fillRect(x,y,46,46);
      if(i===round.col){ctx.strokeStyle='#f1cd7e';ctx.strokeRect(x+1,y+1,44,44)}
      if(g[j][i]>=0)tile(i,j,g[j][i]);
    }
    ctx.save();ctx.strokeStyle='#ffedb6';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(200,0);ctx.lineTo(200,400);ctx.stroke();ctx.restore();
    if(n===0&&!won&&!preview){
      ctx.save();tutorial().cells.forEach(([i,j],k)=>{
        ctx.globalAlpha=k%2?.14:.36;tile(i,j,round.color);
        ctx.globalAlpha=1;ctx.lineWidth=k%2?1.5:3;ctx.strokeStyle=k%2?'#f1cd7e':'#fff9da';
        ctx.setLineDash(k%2?[3,5]:[7,3]);ctx.strokeRect(i*50+4,j*50+4,42,42);
      });ctx.restore();
    }
    if(preview)preview.cells.forEach(([i,j],k)=>{
      if(i<0||i>=8||j<0||j>=8)return;
      ctx.save();ctx.globalAlpha=.68;tile(i,j,round.color);ctx.restore();
      ctx.strokeStyle=preview.valid?'#fff5d8':'#ff745e';ctx.lineWidth=3;ctx.setLineDash(k%2?[4,3]:[]);ctx.strokeRect(i*50+4,j*50+4,42,42);ctx.setLineDash([]);
    });
  }
  function tile(i,j,c){const s=window.__azulejo.sprite(c,50);ctx.drawImage(s.cv,i*50-s.pad,j*50-s.pad,s.full,s.full)}
  function start(k){
    n=k;round=rounds[n];g=panel(round);held=null;won=false;preview=null;piece.hidden=false;next.hidden=true;
    $('mirrorRound').textContent=`Painel ${n+1} de 3`;
    msg.textContent=n===0?'Toque no L tracejado à esquerda. Veja o reflexo fechar a coluna dourada!':'Toque no painel para encaixar a peça ou arraste-a. Os dois lados devem caber.';
    const sd=A.SHAPE_DATA[round.shape],svg=piece.querySelector('svg');svg.setAttribute('viewBox',`0 0 ${sd.w*20} ${sd.h*20}`);
    svg.innerHTML=sd.cells.map(([r,c])=>`<rect x="${c*20+1}" y="${r*20+1}" width="18" height="18" rx="3" fill="${colors[round.color]}"/><circle cx="${c*20+10}" cy="${r*20+10}" r="3" fill="#fff0c5"/>`).join('');draw();
  }
  function aim(e){
    const b=board.getBoundingClientRect(),sd=A.SHAPE_DATA[round.shape],x=(e.clientX-b.left)*8/b.width,y=(e.clientY-b.top)*8/b.height;
    preview=project(g,round.shape,Math.round(x-sd.w/2),Math.round(y-sd.h/2));
    if(n===0){
      const guide=tutorial();
      if(guide.cells.some(([i,j],k)=>k%2===0&&i===Math.floor(x)&&j===Math.floor(y)))preview=guide;
    }
    const ready=preview.valid&&round.gaps.every(y=>preview.cells.some(([i,j])=>i===round.col&&j===y));
    const text=ready?'Solte agora: a coluna está completa!':preview.valid?'Cabe aqui. Deslize até preencher a lacuna dourada.':'Deslize: a peça e o reflexo precisam de espaço.';
    if(msg.textContent!==text)msg.textContent=text;
    draw();
  }
  function drop(){
    const p=preview;preview=null;
    if(!p?.valid){msg.textContent='Os dois lados precisam estar livres, sem sobreposição. Tente outra posição.';draw();return}
    const trial=g.map(row=>row.slice());p.cells.forEach(([x,y])=>trial[y][x]=round.color);
    if(!A.linesFor(trial).cols.includes(round.col)){msg.textContent='As duas peças cabem, mas ainda falta fechar a coluna dourada. Tente de novo.';draw();return}
    g=trial;won=true;draw();piece.hidden=true;next.hidden=false;
    msg.textContent=n===2?'Mosaico completo! Você resolveu os três painéis.':'Coluna completa! Uma peça, dois encaixes.';
    next.textContent=n===2?'Jogar novamente':'Próximo painel';
  }
  piece.onpointerdown=e=>{held=e.pointerId;piece.setPointerCapture(held)};
  piece.onpointermove=e=>{if(held===e.pointerId)aim(e)};
  piece.onpointerup=e=>{if(held!==e.pointerId)return;held=null;const b=piece.getBoundingClientRect();
    if(e.clientY>=b.top&&e.clientY<=b.bottom){preview=null;draw();msg.textContent=n===0?'Agora toque em qualquer casa do L tracejado à esquerda.':'Toque no painel para posicionar o centro da peça.';return}
    aim(e);drop()};
  piece.onpointercancel=()=>{held=null;preview=null;draw()};
  board.onpointerdown=e=>{if(won||held!==null)return;held=e.pointerId;board.setPointerCapture(held);aim(e)};
  board.onpointermove=e=>{if(held===e.pointerId)aim(e)};
  board.onpointerup=e=>{if(held!==e.pointerId)return;held=null;aim(e);drop()};
  board.onpointercancel=piece.onpointercancel;
  next.onclick=()=>start((n+1)%3);
  $('openMirror').onclick=()=>{$('mirror').hidden=false;start(0);$('closeMirror').focus()};
  $('closeMirror').onclick=()=>{$('mirror').hidden=true;$('openMirror').focus()};
})();
