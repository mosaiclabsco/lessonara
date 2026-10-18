const tools=[
 ['select','Mover','M5 3l14 9-7 1-3 7z'],['pen','Caneta','M15 4l5 5 M4 20l4-1 12-12-4-4L4 15z'],['laser','Laser','M3 21l8-8 M12 4v3 M20 12h-3 M18 6l-3 3 M6 6l3 3 M16 17l2 2'],['text','Texto','M4 5h16 M12 5v15 M8 20h8'],['eraser','Borracha','M3 14l9-10 8 7-9 10H9z M8 10l8 7 M11 21h10'],
 ['undo','Desfazer','M9 5L4 10l5 5 M4 10h10a6 6 0 0 1 0 12'],['clear','Limpar','M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15'],['stop','Sair · Esc','M6 6l12 12 M6 18L18 6'],
];
const buttons=new Map();
for(const [tool,label,path] of tools){const button=document.createElement('button');button.type='button';button.dataset.tool=tool;button.title=label;button.setAttribute('aria-label',label);button.innerHTML=`<svg viewBox="0 0 24 24"><path d="${path}"/></svg><span>${label}</span>`;button.onclick=()=>{if(tool==='stop')window.annotationOverlay.stop();else if(tool==='clear')window.annotationOverlay.clear();else if(tool==='undo')window.annotationOverlay.undo();else window.annotationOverlay.select(button.getAttribute('aria-pressed')==='true'?null:tool);};document.querySelector('#tools').append(button);buttons.set(tool,button);}
let initialized=false;
function update(state){if(!state)return;for(const [tool,button] of buttons)if(!['undo','clear','stop'].includes(tool))button.setAttribute('aria-pressed',String(tool===state.tool));
 if(!initialized){initialized=true;for(const item of state.palette){const button=document.createElement('button');button.type='button';button.title=item.label;button.dataset.color=item.value;button.setAttribute('aria-label',item.label);button.style.background=item.value;button.onclick=()=>window.annotationOverlay.color(item.value);document.querySelector('#colors').insertBefore(button,document.querySelector('.hint'));}}
 for(const button of document.querySelectorAll('[data-color]'))button.setAttribute('aria-pressed',String(button.dataset.color===state.color));
}
window.annotationOverlay.onState(update);void window.annotationOverlay.settings().then(update);
document.addEventListener('keydown',event=>{if(event.key==='Escape')window.annotationOverlay.stop();});
