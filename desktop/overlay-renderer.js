const canvas=document.querySelector('#canvas'),ctx=canvas.getContext('2d');
let mode=null,color='#e5484d',drawing=null,strokes=[],texts=[],laser=[],editor=null,dragging=null,history=[],frame=null;
const model=window.AnnotationModel;
function checkpoint(){history.push({strokes:[...strokes],texts:texts.map(text=>({...text}))});if(history.length>40)history.shift();}
function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);schedule();}
function schedule(){if(frame===null)frame=requestAnimationFrame(paint);}
function path(points,strokeColor,width=3){if(!points.length)return;ctx.strokeStyle=strokeColor;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);if(points.length===1)ctx.lineTo(points[0][0]+.1,points[0][1]);ctx.stroke();}
function paint(){frame=null;ctx.clearRect(0,0,innerWidth,innerHeight);ctx.lineCap='round';ctx.lineJoin='round';
 for(const stroke of strokes)path(stroke.points,stroke.color);if(drawing)path(drawing.points,drawing.color);
 ctx.font='24px system-ui';ctx.textBaseline='top';for(const text of texts){if(editor?.dataset.id===text.id)continue;ctx.fillStyle=text.color;for(const [index,line] of text.value.split('\n').entries())ctx.fillText(line,text.x,text.y+29*index);}
 const now=performance.now();laser=laser.filter(p=>now-p.at<850);ctx.lineWidth=4;
 for(const segment of model.laserSegments(laser,now)){ctx.globalAlpha=segment.alpha;ctx.shadowColor=segment.to.color;ctx.shadowBlur=5;path([[segment.from.x,segment.from.y],[segment.to.x,segment.to.y]],segment.to.color,4);}
 const tip=laser.at(-1);if(tip){ctx.globalAlpha=Math.max(0,1-(now-tip.at)/850);ctx.fillStyle=tip.color;ctx.beginPath();ctx.arc(tip.x,tip.y,3,0,Math.PI*2);ctx.fill();}
 ctx.shadowBlur=0;ctx.globalAlpha=1;if(laser.length)schedule();
}
function hitText(x,y){ctx.font='24px system-ui';return [...texts].reverse().find(text=>{const lines=text.value.split('\n'),width=Math.max(12,...lines.map(line=>ctx.measureText(line).width));return x>=text.x-6&&x<=text.x+width+6&&y>=text.y-6&&y<=text.y+lines.length*29+6;});}
function commitText(cancel=false){if(!editor)return;const input=editor;editor=null;const value=input.value.slice(0,500).trim();if(!cancel&&value){checkpoint();const item={id:input.dataset.id||crypto.randomUUID(),x:parseFloat(input.style.left),y:parseFloat(input.style.top),value,color:input.dataset.color};const index=texts.findIndex(text=>text.id===item.id);if(index>=0)texts=texts.map(text=>text.id===item.id?item:text);else texts.push(item);}input.remove();schedule();}
function editText(text,x,y){commitText();editor=document.createElement('textarea');editor.setAttribute('aria-label','Texto da anotação');editor.dataset.id=text?.id||'';editor.dataset.color=text?.color||color;editor.style.left=Math.max(0,Math.min(text?.x??x,innerWidth-220))+'px';editor.style.top=Math.max(0,Math.min(text?.y??y,innerHeight-72))+'px';editor.style.color=editor.dataset.color;editor.style.borderColor=editor.dataset.color;editor.value=text?.value||'';editor.maxLength=500;document.body.append(editor);editor.focus();editor.select();editor.onblur=()=>commitText();editor.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();commitText();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();commitText(true);window.annotationOverlay.stop();}};schedule();}
function erase(x,y){texts=texts.filter(text=>hitText(x,y)?.id!==text.id);strokes=strokes.filter(stroke=>!model.hitStroke(stroke.points,x,y,12));schedule();}
function addLaser(event){for(const point of event.getCoalescedEvents?.()||[event])laser.push({x:point.clientX,y:point.clientY,at:performance.now(),color});if(laser.length>600)laser=laser.slice(-600);schedule();}
canvas.onpointerdown=e=>{if(!mode)return;e.preventDefault();commitText();const text=hitText(e.clientX,e.clientY);
 if(mode==='text'){editText(text,e.clientX,e.clientY);return;}
 canvas.setPointerCapture(e.pointerId);
 if(mode==='select'){if(text){checkpoint();dragging={id:text.id,dx:e.clientX-text.x,dy:e.clientY-text.y};}return;}
 if(mode==='eraser'){checkpoint();erase(e.clientX,e.clientY);return;}
 if(mode==='laser'){addLaser(e);return;}
 if(mode==='pen')drawing={points:[[e.clientX,e.clientY]],color};schedule();
};
canvas.onpointermove=e=>{if(mode==='laser'){addLaser(e);return;}if(mode==='eraser'&&e.buttons){erase(e.clientX,e.clientY);return;}if(dragging){texts=texts.map(text=>text.id===dragging.id?{...text,x:Math.max(0,Math.min(innerWidth-20,e.clientX-dragging.dx)),y:Math.max(0,Math.min(innerHeight-29,e.clientY-dragging.dy))}:text);schedule();return;}if(drawing){for(const point of e.getCoalescedEvents?.()||[e])if(drawing.points.length<2000)drawing.points.push([point.clientX,point.clientY]);schedule();}};
canvas.onpointerup=()=>{if(drawing){checkpoint();strokes.push(drawing);if(strokes.length>300)strokes.shift();drawing=null;}dragging=null;schedule();};
canvas.onpointercancel=()=>{drawing=null;dragging=null;schedule();};
canvas.ondblclick=e=>{if(mode==='select'||mode==='text'){e.preventDefault();const text=hitText(e.clientX,e.clientY);if(text)editText(text,text.x,text.y);}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){commitText(true);drawing=null;dragging=null;window.annotationOverlay.stop();}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!editor){e.preventDefault();undo();}});
function undo(){commitText(true);const previous=history.pop();if(previous){strokes=previous.strokes;texts=previous.texts;drawing=null;schedule();}}
window.annotationOverlay.onTool(value=>{commitText();mode=value;drawing=null;dragging=null;document.body.dataset.tool=value||'';});
window.annotationOverlay.onColor(value=>{color=value;});window.annotationOverlay.onUndo(undo);
window.annotationOverlay.onClear(()=>{commitText(true);checkpoint();strokes=[];texts=[];laser=[];drawing=null;schedule();});
resize();addEventListener('resize',resize);
