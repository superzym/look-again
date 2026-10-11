const $ = (id) => document.getElementById(id);
const themes = [
  {id:'leaves',label:'green leaves and plants',name:'Leaves & light',title:'Find the light in a leaf.',invitation:'Look for a leaf you can see without picking it. Change your angle until light passes through it, then trace one vein with your eyes.',question:'What changes when you look from the other side?',care:'Leave the leaf where it is. Observe from an accessible path.'},
  {id:'bark',label:'rough tree bark',name:'Bark & texture',title:'Read a tree’s quiet patterns.',invitation:'Find a patch of bark at eye level. Follow one groove, then step back and notice how the small lines become a larger pattern.',question:'If this texture were a landscape, where would the rivers run?',care:'No need to touch or remove bark. Give living things space.'},
  {id:'sky',label:'clouds and open sky',name:'Sky & clouds',title:'Give the sky sixty seconds.',invitation:'From a comfortable, safe place, choose a small patch of cloud or open sky. Watch its edge for one quiet minute.',question:'What moved while you were standing still?',care:'Keep your eyes away from the sun. Stop walking before looking up.'},
  {id:'water',label:'water and reflections',name:'Water & reflections',title:'Notice a world turned over.',invitation:'Find a reflection you can see from a safe, dry place: a puddle, a window, or water beyond a path. Notice the real object and its reflection together.',question:'Which detail survives the reflection, and which disappears?',care:'Stay behind barriers and away from water edges. A window reflection counts.'},
  {id:'flowers',label:'flowers in bloom',name:'Flowers & colour',title:'Look for a colour’s neighbour.',invitation:'Choose one flower you can see without disturbing it. Notice its colour, then look for a nearby colour that makes it stand out.',question:'What would you have missed if you only looked at the flower?',care:'Observe without picking flowers or approaching insects.'},
  {id:'stone',label:'stone pebbles and soil',name:'Stone & tiny details',title:'Find a tiny landscape.',invitation:'Look closely at a stone, a paved surface, or a patch of earth beside your path. Find one line, one small shadow, and one unexpected colour.',question:'How much variety fits inside a hand-sized patch?',care:'Leave stones and soil in place. You can do this from a seated position.'},
  {id:'path',label:'a path or an outdoor street',name:'Paths & shadows',title:'Follow a shadow with your eyes.',invitation:'Pause somewhere clear of traffic. Find the edge of a shadow across your path and follow the shape back toward the thing that made it.',question:'Does the shadow tell a different story from the object?',care:'Stay on familiar, accessible paths and be aware of people and traffic.'},
  {id:'wildlife',label:'birds or small animals',name:'Small living things',title:'Watch without moving closer.',invitation:'Stay at a respectful distance and notice one small movement: a bird turning, a branch shifting, or an insect passing by. Let it set the pace.',question:'What did you notice when you stopped trying to get closer?',care:'Do not approach, feed, handle, or identify wildlife with this tool.'}
];
let photo = null, photoURL = null, worker = null, requestId = 0, busy = false, currentCard = null;
let photoGeneration = 0, photoLoading = false;
let credits = [], modelReady = false;
const storageKey = 'look-again-notes-v1';
let notes = [];
try { const stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); if(Array.isArray(stored)) notes = stored.filter(n => typeof n.text === 'string' && typeof n.theme === 'string').slice(0,12); } catch {}

function message(text) { $('status').textContent = text; }
function setBusy(value) {
  busy=value;
  $('analyze').disabled=value || photoLoading || !photo;
  $('photo-input').disabled=value;
  for(const id of ['demo-leaf','demo-bark','clear-photo']) $(id).disabled=value;
  $('analyze').firstChild.textContent=value ? 'Finding a fresh perspective… ' : 'Find my field card ';
}
function showError(text) { $('error').textContent=text; $('error').hidden=false; }
function resetError() { $('error').hidden=true; $('error').textContent=''; }
function beginPhotoLoad(){ photoLoading=true; $('analyze').disabled=true; return ++photoGeneration; }
function finishPhotoLoad(generation){ if(generation===photoGeneration){ photoLoading=false; setBusy(busy); } }
function setPhoto(blob, caption, badge='Only on this device') {
  if(photoURL) URL.revokeObjectURL(photoURL);
  photo=blob; photoURL=URL.createObjectURL(blob);
  $('photo-preview').src=photoURL;
  $('photo-preview').alt=caption || 'Your selected photo';
  $('photo-preview').hidden=false; $('photo-empty').hidden=true;
  $('photo-badge').textContent=badge; $('photo-badge').hidden=false;
  $('photo-caption').textContent=caption;
  $('clear-photo').hidden=false; $('analyze').disabled=busy || photoLoading; resetError();
  currentCard=null; $('card-section').hidden=true;
}
$('photo-input').addEventListener('change', async (event) => {
  const file=event.target.files[0]; if(!file) return;
  if(!file.type.startsWith('image/')) { showError('Please choose an image file.'); return; }
  if(file.size>25*1024*1024) { showError('Please choose a photo smaller than 25 MB.'); return; }
  const generation=beginPhotoLoad();
  try { const image=await createImageBitmap(file); image.close(); if(generation===photoGeneration) setPhoto(file,'Your photo • processed on this device'); }
  catch { if(generation===photoGeneration) showError('This browser could not read that image. Try a JPEG, PNG, or WebP photo.'); }
  finally { finishPhotoLoad(generation); }
});
$('clear-photo').addEventListener('click',()=>{
  ++photoGeneration; photoLoading=false;
  if(photoURL) URL.revokeObjectURL(photoURL); photoURL=null; photo=null;
  $('photo-preview').removeAttribute('src'); $('photo-preview').hidden=true; $('photo-empty').hidden=false;
  $('photo-badge').hidden=true; $('clear-photo').hidden=true; $('photo-caption').textContent='';
  $('photo-input').value=''; $('analyze').disabled=true; resetError();
  currentCard=null; $('card-section').hidden=true;
});
async function loadDemo(kind) {
  resetError(); const generation=beginPhotoLoad();
  try {
    const credit=credits.find(x=>x.id===kind || (x.file || x.filename)?.includes(kind));
    const path=credit?.local_path || credit?.path || (credit?.file ? `assets/${credit.file}` : null) || `assets/demo-${kind}.jpg`;
    const response=await fetch(path); if(!response.ok) throw new Error('Photo unavailable');
    const blob=await response.blob(); const image=await createImageBitmap(blob); image.close();
    const author=credit?.author || 'credited photographer';
    if(generation===photoGeneration) setPhoto(blob,`Demo photo • ${author} • see credits below`,'Credited demo photo');
  } catch { if(generation===photoGeneration) showError('The demo photo could not load. You can choose your own photo or make a card by hand.'); }
  finally { finishPhotoLoad(generation); }
}
$('demo-leaf').addEventListener('click',()=>loadDemo('leaf'));
$('demo-bark').addEventListener('click',()=>loadDemo('bark'));

function getWorker() {
  if(worker) return worker;
  worker=new Worker('./model-worker.js',{type:'module'});
  worker.addEventListener('message',({data})=>{
    if(data.type==='progress') {
      const percent=Number(data.progress);
      if(data.status==='progress' && Number.isFinite(percent)) {
        $('model-progress').value=Math.max(0,Math.min(100,percent));
        message('Downloading the open model…');
        const mb=Number(data.loaded)>0 ? `${(data.loaded/1048576).toFixed(1)} MB received` : '';
        $('progress-detail').textContent=[data.file,mb].filter(Boolean).join(' · ');
      } else { $('model-progress').removeAttribute('value'); message(modelReady?'Looking at your photo…':'Preparing the local model…'); }
    }
    if(data.type==='ready') { modelReady=true; message('Looking at your photo on this device…'); $('model-progress').removeAttribute('value'); }
    if(data.type==='result' && data.id===requestId) {
      setBusy(false); $('progress-panel').hidden=true;
      const predictions=Array.isArray(data.predictions)?data.predictions:[];
      const theme=themes.find(t=>t.label===predictions[0]?.label);
      if(!theme) { showError('No usable theme was returned. You can choose a focus below.'); return; }
      renderCard(theme,{mode:'model',predictions,inferenceMs:data.inferenceMs,model:data.model});
    }
    if(data.type==='error' && (data.id===requestId || data.id==null)) {
      setBusy(false); $('progress-panel').hidden=true;
      showError('The local model could not finish. Check your connection for the first download, then try again. You can also choose a focus yourself.');
      console.warn('Local inference failed:',data.message);
    }
  });
  worker.addEventListener('error',()=>{
    setBusy(false); $('progress-panel').hidden=true;
    showError('The model runtime could not load in this browser. Try again, or choose a focus yourself.');
    worker?.terminate(); worker=null; modelReady=false;
  });
  return worker;
}
$('analyze').addEventListener('click',async()=>{
  if(!photo || busy || photoLoading) return;
  resetError(); setBusy(true); $('progress-panel').hidden=false;
  $('model-progress').removeAttribute('value'); $('progress-detail').textContent='Your photo is never uploaded. First load can take a few minutes.';
  message(modelReady?'Looking at your photo…':'Loading the open model…');
  try { getWorker().postMessage({type:'classify',id:++requestId,image:photo,labels:themes.map(t=>t.label)}); }
  catch { setBusy(false); $('progress-panel').hidden=true; showError('This browser could not start local inference. Choose a focus below to continue.'); }
});
function cancelInference(){
  ++requestId; worker?.terminate(); worker=null; modelReady=false; setBusy(false);
  $('progress-panel').hidden=true; resetError();
}
$('cancel').addEventListener('click',cancelInference);
$('manual-card').addEventListener('click',()=>{
  if(busy) cancelInference();
  if(photoLoading){ ++photoGeneration; photoLoading=false; setBusy(false); }
  renderCard(themes.find(t=>t.id===$('manual-theme').value),{mode:'manual'});
});
function renderCard(theme,info) {
  currentCard={theme,info};
  $('card-source').textContent=info.mode==='model'?'AI-CHOSEN • PREWRITTEN':'CHOSEN BY YOU • PREWRITTEN';
  $('card-theme').textContent=theme.name; $('card-title').textContent=theme.title;
  $('card-invitation').textContent=theme.invitation; $('card-question').textContent=theme.question; $('card-care').textContent=theme.care;
  $('manual-theme').value=theme.id; $('reason-intro').textContent=info.mode==='model'?'The local model ranked these visual themes highest. If the match feels wrong, choose a different focus above.':'You selected this theme yourself. No AI model was used for this card.';
  $('matches').replaceChildren();
  if(info.predictions) for(const match of info.predictions.slice(0,3)) { const li=document.createElement('li'); li.textContent=themes.find(t=>t.label===match.label)?.name || match.label; $('matches').append(li); }
  $('inference-stats').textContent=info.mode==='model'?`${info.model} · ${(info.inferenceMs/1000).toFixed(1)} s local inference (model download excluded).`:'';
  $('card-section').hidden=false; $('field-note').value=''; $('note-status').textContent='';
  $('card-section').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
$('go-outside').addEventListener('click',()=>{ if(!currentCard) return; $('outside-task').textContent=currentCard.theme.title+' '+currentCard.theme.question; $('outside-dialog').showModal(); });
$('return').addEventListener('click',()=>{ $('outside-dialog').close(); $('field-note').focus(); });
$('download-card').addEventListener('click',()=>{
  if(!currentCard) return;
  const t=currentCard.theme;
  const attribution=currentCard.info.mode==='model'?'AI selected the theme':'You selected the theme';
  const text=`LOOK AGAIN — YOUR POCKET FIELD CARD\n\n${t.name}\n${t.title}\n\n${t.invitation}\n\n${t.question}\n\n${t.care}\n\nWhen I came back, I noticed:\n\n\n${attribution}; the invitation is prewritten. No species identification.\n`;
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a'); link.href=url; link.download='look-again-field-card.txt'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$('save-note').addEventListener('click',()=>{
  const text=$('field-note').value.trim();
  if(!text) { $('note-status').textContent='Add a little observation first.'; $('field-note').focus(); return; }
  if(!currentCard) return;
  const updated=[{text,theme:currentCard.theme.name,date:new Date().toISOString()},...notes].slice(0,12);
  try { localStorage.setItem(storageKey,JSON.stringify(updated)); notes=updated; $('note-status').textContent='Kept on this device.'; renderNotes(); }
  catch { $('note-status').textContent='Browser storage is unavailable. Your text is still here to copy.'; }
});
function renderNotes(){
  $('notebook-section').hidden=notes.length===0; $('notes-list').replaceChildren();
  for(const note of notes) { const card=document.createElement('article'); card.className='saved-note'; const date=document.createElement('time'); const parsed=new Date(note.date); date.textContent=Number.isNaN(parsed.getTime())?'Field note':parsed.toLocaleDateString(undefined,{month:'short',day:'numeric'}); const p=document.createElement('p');p.textContent=note.text; const label=document.createElement('span');label.textContent=note.theme;card.append(date,p,label);$('notes-list').append(card); }
}
$('clear-notes').addEventListener('click',()=>{try {localStorage.removeItem(storageKey);notes=[];renderNotes();}catch{showError('Browser storage is unavailable.');}});
renderNotes();

fetch('./assets/credits.json').then(r=>{if(!r.ok)throw new Error();return r.json();}).then(data=>{
  credits=Array.isArray(data)?data:(data.photos || data.assets || []);
  $('photo-credits').replaceChildren();
  for(const credit of credits){const p=document.createElement('p'); const a=document.createElement('a'); a.textContent=credit.title || credit.filename || 'Demo photo'; a.href=credit.source_page || credit.source_url || credit.page_url || '#';a.target='_blank';a.rel='noreferrer';p.append(a,document.createTextNode(` — ${credit.author || ''}. ${credit.license || ''}.`));$('photo-credits').append(p);}
}).catch(()=>{ $('photo-credits').textContent='Photo credits could not load. Please reconnect to view the source information.'; });
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
