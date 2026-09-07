const $ = id => document.getElementById(id);
const cfg = window.FORM_CONFIG || {};
const competition = $('competition');
const discipline = $('discipline');
const contactStep = $('contactStep');
const participantsStep = $('participantsStep');
const confirmStep = $('confirmStep');
const rhythmBlock = $('rhythmBlock');
const dtsBlock = $('dtsBlock');
const rhythmPeople = $('rhythmPeople');
const dtsTeams = $('dtsTeams');
const statusBox = $('status');
const form = $('appForm');

const REGISTRY_KEY = 'ffs61-local-registry-v1';
let rhythmCounter = 0;
let teamCounter = 0;

function activeCompetitions(){
  return (cfg.competitions || []).filter(x =>
    x && x.level === 'regional' && x.region === 'Ростовская область' && x.status === 'open'
  );
}

function disciplineLabel(value){
  if(value === 'DTS') return 'Команда ДТС — двоеборье «тактическая стрельба»';
  if(value === 'Ритм-симулятор') return 'Ритм-симулятор — спортсмены';
  return value;
}

function loadCompetitions(){
  competition.innerHTML = '<option value="">— Выберите открытое соревнование —</option>';
  activeCompetitions().forEach(x => {
    const o = document.createElement('option');
    o.value = x.name;
    o.textContent = x.name;
    competition.appendChild(o);
  });
}

function loadDisciplines(){
  const item = activeCompetitions().find(i => i.name === competition.value);
  discipline.innerHTML = `<option value="">${item ? '— Выберите формат участия —' : '— Сначала выберите соревнование —'}</option>`;
  discipline.disabled = !item;
  if(item){
    (item.disciplines || []).forEach(value => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = disciplineLabel(value);
      discipline.appendChild(o);
    });
  }
  setMode();
}

function setSubtreeDisabled(root, disabled){
  root.querySelectorAll('input,select,textarea,button').forEach(el => { el.disabled = disabled; });
}

function showStep(el, show){
  el.classList.toggle('hidden', !show);
  setSubtreeDisabled(el, !show);
}

function contactCredentials(){
  return {
    email: ($('cEmail')?.value || '').trim().toLowerCase(),
    phone: ($('cPhone')?.value || '').replace(/\D/g, '')
  };
}

function ownerKey(){
  const {email, phone} = contactCredentials();
  if(!email || phone.length < 6) return '';
  return `${email}|${phone}`;
}

function normalizeText(v){
  return String(v || '').trim().toLocaleLowerCase('ru-RU');
}

function loadRegistry(){
  try{
    const parsed = JSON.parse(localStorage.getItem(REGISTRY_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  }catch{
    return {};
  }
}

function saveRegistry(registry){
  try{ localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry)); }catch{}
}

function athleteId(a){
  return [normalizeText(a.lastName), normalizeText(a.firstName), normalizeText(a.middleName), String(a.birthDate || '')].join('|');
}

function saveToLocalRegistry(payload){
  const key = ownerKey();
  if(!key) return;
  const registry = loadRegistry();
  const bucket = registry[key] || {athletes:{}, teams:{}};
  bucket.athletes = bucket.athletes || {};
  bucket.teams = bucket.teams || {};

  (payload.athletes || []).forEach(a => {
    const clean = {
      lastName:String(a.lastName || '').trim(), firstName:String(a.firstName || '').trim(),
      middleName:String(a.middleName || '').trim(), birthDate:String(a.birthDate || '').trim(),
      nickname:String(a.nickname || '').trim(), lastTeamName:String(a.teamName || '').trim(),
      updatedAt:new Date().toISOString()
    };
    bucket.athletes[athleteId(clean)] = clean;
  });

  if(payload.discipline === 'DTS'){
    (payload.teams || []).forEach(t => {
      const teamName = String(t.teamName || '').trim();
      if(!teamName) return;
      bucket.teams[normalizeText(teamName)] = {
        teamName,
        athletes:(t.athletes || []).map(a => ({
          role:String(a.role || '').trim(), lastName:String(a.lastName || '').trim(),
          firstName:String(a.firstName || '').trim(), middleName:String(a.middleName || '').trim(),
          birthDate:String(a.birthDate || '').trim(), nickname:String(a.nickname || '').trim()
        })),
        lastCompetition:String(payload.competition || '').trim(),
        updatedAt:new Date().toISOString()
      };
    });
  }
  registry[key] = bucket;
  saveRegistry(registry);
}

function localAthleteSearch(query){
  const key = ownerKey();
  if(!key) return [];
  const bucket = loadRegistry()[key];
  if(!bucket || !bucket.athletes) return [];
  const q = normalizeText(query);
  return Object.values(bucket.athletes).filter(a =>
    normalizeText([a.lastName,a.firstName,a.middleName,a.nickname].filter(Boolean).join(' ')).includes(q)
  ).sort((a,b) => normalizeText(`${a.lastName} ${a.firstName}`).localeCompare(normalizeText(`${b.lastName} ${b.firstName}`),'ru')).slice(0,8);
}

function localTeamSearch(query){
  const key = ownerKey();
  if(!key) return [];
  const bucket = loadRegistry()[key];
  if(!bucket || !bucket.teams) return [];
  const q = normalizeText(query);
  return Object.values(bucket.teams).filter(t => normalizeText(t.teamName).includes(q))
    .sort((a,b) => normalizeText(a.teamName).localeCompare(normalizeText(b.teamName),'ru')).slice(0,8);
}

function athleteFields(role){
  return `
    <div class="person" data-role="${role}">
      <div class="person-head"><h4>${role}</h4></div>
      <div class="autocomplete-wrap">
        <div class="help athlete-lookup-help">Начните вводить фамилию или имя. Ранее введённые в этом браузере спортсмены появятся в списке.</div>
        <div class="athlete-suggestions hidden"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Фамилия *</label><input data-k="lastName" autocomplete="off" required></div>
        <div class="field"><label>Имя *</label><input data-k="firstName" autocomplete="off" required></div>
        <div class="field"><label>Отчество *</label><input data-k="middleName" required></div>
        <div class="field"><label>Дата рождения *</label><input data-k="birthDate" type="date" required></div>
        <div class="field full"><label>Никнейм *</label><input data-k="nickname" required></div>
      </div>
    </div>`;
}

function fillAthlete(card, athlete){
  ['lastName','firstName','middleName','birthDate','nickname'].forEach(k => {
    const el = card.querySelector(`[data-k="${k}"]`);
    if(el && athlete[k] != null) el.value = athlete[k];
  });
  hideSuggestions(card);
}

function hideSuggestions(card){
  const box = card.querySelector('.athlete-suggestions');
  if(box){ box.innerHTML=''; box.classList.add('hidden'); }
}

function renderSuggestions(card, results){
  const box = card.querySelector('.athlete-suggestions');
  if(!box) return;
  box.innerHTML='';
  if(!results.length){ box.classList.add('hidden'); return; }
  results.forEach(athlete => {
    const btn=document.createElement('button');
    btn.type='button'; btn.className='athlete-option';
    const strong=document.createElement('strong');
    strong.textContent=[athlete.lastName,athlete.firstName,athlete.middleName].filter(Boolean).join(' ');
    const small=document.createElement('span');
    small.textContent=[athlete.nickname?`ник: ${athlete.nickname}`:'',athlete.birthDate||''].filter(Boolean).join(' • ');
    btn.append(strong,small);
    btn.addEventListener('click',()=>fillAthlete(card,athlete));
    box.appendChild(btn);
  });
  box.classList.remove('hidden');
}

function attachAutocomplete(card){
  let timer;
  ['lastName','firstName'].forEach(k => {
    const input=card.querySelector(`[data-k="${k}"]`);
    if(!input) return;
    const run=()=>renderSuggestions(card, input.value.trim()?localAthleteSearch(input.value):[]);
    input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(run,120);});
    input.addEventListener('focus',run);
  });
}

function hideTeamSuggestions(team){
  const box=team.querySelector('.team-suggestions');
  if(box){box.innerHTML='';box.classList.add('hidden');}
}

function renderTeamSuggestions(team, results){
  const box=team.querySelector('.team-suggestions');
  if(!box) return;
  box.innerHTML='';
  if(!results.length){box.classList.add('hidden');return;}
  results.forEach(saved=>{
    const btn=document.createElement('button');btn.type='button';btn.className='athlete-option';
    const strong=document.createElement('strong');strong.textContent=saved.teamName || 'Команда ДТС';
    const mains=(saved.athletes||[]).filter(a=>String(a.role||'').startsWith('Основной')).length;
    const reserves=(saved.athletes||[]).filter(a=>String(a.role||'').startsWith('Запасной')).length;
    const small=document.createElement('span');small.textContent=`${mains} основных${reserves?` • ${reserves} запасных`:''}${saved.lastCompetition?` • ${saved.lastCompetition}`:''}`;
    btn.append(strong,small);btn.addEventListener('click',()=>fillSavedTeam(team,saved));box.appendChild(btn);
  });
  box.classList.remove('hidden');
}

function attachTeamAutocomplete(team){
  const input=team.querySelector('[data-team-name]');
  if(!input) return;
  let timer;
  const run=()=>renderTeamSuggestions(team,input.value.trim()?localTeamSearch(input.value):[]);
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(run,120);});
  input.addEventListener('focus',run);
}

document.addEventListener('click',e=>{
  document.querySelectorAll('.person').forEach(card=>{if(!card.contains(e.target))hideSuggestions(card);});
  document.querySelectorAll('.team-card').forEach(team=>{if(!team.contains(e.target))hideTeamSuggestions(team);});
});

function renumberRhythm(){
  const cards=[...rhythmPeople.querySelectorAll('.rhythm-athlete')];
  cards.forEach((card,index)=>{
    card.dataset.role=`Спортсмен ${index+1}`;
    const h=card.querySelector('h4');if(h)h.textContent=`Спортсмен ${index+1}`;
    const remove=card.querySelector('.remove-athlete');if(remove)remove.classList.toggle('hidden',cards.length===1);
  });
}

function addRhythmAthlete(){
  rhythmCounter++;
  const wrap=document.createElement('div');
  wrap.className='person rhythm-athlete';wrap.dataset.role=`Спортсмен ${rhythmCounter}`;
  wrap.innerHTML=`<div class="person-head"><h4>Спортсмен ${rhythmCounter}</h4><button type="button" class="mini-btn danger remove-athlete">Удалить</button></div>
  <div class="autocomplete-wrap"><div class="help athlete-lookup-help">Начните вводить фамилию или имя. Ранее введённые в этом браузере спортсмены появятся в списке.</div><div class="athlete-suggestions hidden"></div></div>
  <div class="form-grid"><div class="field"><label>Фамилия *</label><input data-k="lastName" autocomplete="off" required></div><div class="field"><label>Имя *</label><input data-k="firstName" autocomplete="off" required></div><div class="field"><label>Отчество *</label><input data-k="middleName" required></div><div class="field"><label>Дата рождения *</label><input data-k="birthDate" type="date" required></div><div class="field full"><label>Никнейм *</label><input data-k="nickname" required></div></div>`;
  wrap.querySelector('.remove-athlete').addEventListener('click',()=>{if(rhythmPeople.children.length<=1)return;wrap.remove();renumberRhythm();});
  rhythmPeople.appendChild(wrap);attachAutocomplete(wrap);renumberRhythm();
}

function addReserve(team){
  const list=team.querySelector('.reserve-list');
  const current=list.querySelectorAll('.reserve-athlete').length;if(current>=2)return null;
  const container=document.createElement('div');container.className='reserve-athlete';container.innerHTML=athleteFields(`Запасной спортсмен ${current+1}`);
  const card=container.querySelector('.person');
  const remove=document.createElement('button');remove.type='button';remove.className='mini-btn danger';remove.textContent='Удалить';card.querySelector('.person-head').appendChild(remove);
  remove.addEventListener('click',()=>{container.remove();renumberReserves(team);});
  list.appendChild(container);attachAutocomplete(card);renumberReserves(team);return card;
}

function renumberReserves(team){
  const reserves=[...team.querySelectorAll('.reserve-list .person')];
  reserves.forEach((card,index)=>{card.dataset.role=`Запасной спортсмен ${index+1}`;const h=card.querySelector('h4');if(h)h.textContent=`Запасной спортсмен ${index+1}`;});
  team.querySelector('.add-reserve').disabled=reserves.length>=2;
}

function fillSavedTeam(team,saved){
  team.querySelector('[data-team-name]').value=saved.teamName||'';
  const athletes=Array.isArray(saved.athletes)?saved.athletes:[];
  const mains=athletes.filter(a=>String(a.role||'').startsWith('Основной')).slice(0,5);
  const reserves=athletes.filter(a=>String(a.role||'').startsWith('Запасной')).slice(0,2);
  [...team.querySelectorAll('.main-list .person')].forEach((card,index)=>{
    ['lastName','firstName','middleName','birthDate','nickname'].forEach(k=>{const el=card.querySelector(`[data-k="${k}"]`);if(el)el.value='';});
    if(mains[index])fillAthlete(card,mains[index]);
  });
  team.querySelector('.reserve-list').innerHTML='';
  reserves.forEach(r=>{const card=addReserve(team);if(card)fillAthlete(card,r);});
  renumberReserves(team);hideTeamSuggestions(team);
}

function renumberTeams(){
  const teams=[...dtsTeams.querySelectorAll('.team-card')];
  teams.forEach((team,index)=>{team.dataset.teamNumber=String(index+1);const title=team.querySelector('.team-title');if(title)title.textContent=`Команда ДТС №${index+1}`;const remove=team.querySelector('.remove-team');if(remove)remove.classList.toggle('hidden',teams.length===1);});
}

function addTeam(){
  teamCounter++;
  const team=document.createElement('div');team.className='team-card';team.dataset.teamNumber=String(teamCounter);
  let mains='';for(let i=1;i<=5;i++)mains+=athleteFields(`Основной спортсмен ${i}`);
  team.innerHTML=`<div class="team-head"><div><div class="tag">ДТС</div><h3 class="team-title">Команда ДТС №${teamCounter}</h3></div><button type="button" class="mini-btn danger remove-team">Удалить команду</button></div>
  <div class="field full"><label>Название команды *</label><div class="autocomplete-wrap"><div class="help athlete-lookup-help">Начните вводить название команды. Ранее введённая в этом браузере команда восстановит сохранённый состав.</div><input data-team-name autocomplete="off" required><div class="team-suggestions athlete-suggestions hidden"></div></div></div>
  <div class="roster-label">Основной состав — 5 спортсменов</div><div class="main-list">${mains}</div><div class="roster-label">Запасные — до 2 спортсменов</div><div class="reserve-list"></div><button type="button" class="mini-btn add-reserve">＋ Добавить запасного</button>`;
  team.querySelector('.remove-team').addEventListener('click',()=>{if(dtsTeams.querySelectorAll('.team-card').length<=1)return;team.remove();renumberTeams();});
  team.querySelector('.add-reserve').addEventListener('click',()=>addReserve(team));
  team.querySelectorAll('.person').forEach(attachAutocomplete);attachTeamAutocomplete(team);dtsTeams.appendChild(team);renumberTeams();
}

function resetParticipants(mode){
  if(mode==='Ритм-симулятор' && rhythmPeople.children.length===0)addRhythmAthlete();
  if(mode==='DTS' && dtsTeams.querySelectorAll('.team-card').length===0)addTeam();
}

function setMode(){
  const mode=discipline.value;const selected=mode==='DTS'||mode==='Ритм-симулятор';
  showStep(contactStep,selected);showStep(participantsStep,selected);showStep(confirmStep,selected);
  rhythmBlock.classList.toggle('hidden',mode!=='Ритм-симулятор');dtsBlock.classList.toggle('hidden',mode!=='DTS');
  setSubtreeDisabled(rhythmBlock,mode!=='Ритм-симулятор');setSubtreeDisabled(dtsBlock,mode!=='DTS');
  if(mode==='Ритм-симулятор'){$('participantsTitle').textContent='Спортсмены — ритм-симулятор';$('participantsHelp').textContent='Добавьте одного или сразу нескольких спортсменов в одну предварительную заявку.';}
  else if(mode==='DTS'){$('participantsTitle').textContent='Команды ДТС';$('participantsHelp').textContent='Добавьте одну или несколько команд. Можно выбрать сохранённую ранее команду и восстановить её состав.';}
  resetParticipants(mode);
}

function collectCard(card){const obj={role:card.dataset.role||''};card.querySelectorAll('[data-k]').forEach(el=>obj[el.dataset.k]=el.value.trim());return obj;}
function collectRhythm(){return [...rhythmPeople.querySelectorAll('.rhythm-athlete')].map(collectCard);}
function collectTeams(){return [...dtsTeams.querySelectorAll('.team-card')].map((team,index)=>{const teamName=team.querySelector('[data-team-name]').value.trim();const athletes=[...team.querySelectorAll('.person')].map(card=>{const a=collectCard(card);a.teamName=teamName;return a;});return {teamNumber:index+1,teamName,athletes};});}
function makeId(){return 'FFS-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();}

function buildPayload(){
  const mode=discipline.value;const teams=mode==='DTS'?collectTeams():[];const athletes=mode==='DTS'?teams.flatMap(t=>t.athletes):collectRhythm();
  return {submissionId:makeId(),competition:competition.value,discipline:mode,teamName:mode==='DTS'?teams.map(t=>t.teamName).join(' / '):'',teams,contact:{lastName:$('cLast').value.trim(),firstName:$('cFirst').value.trim(),middleName:$('cMiddle').value.trim(),phone:$('cPhone').value.trim(),email:$('cEmail').value.trim(),city:$('cCity').value.trim(),organization:$('cOrg').value.trim()},athletes,comment:$('comment').value.trim()};
}

function allowed(){const item=activeCompetitions().find(i=>i.name===competition.value);return !!item&&(item.disciplines||[]).includes(discipline.value);}
function validateRoster(payload){
  if(payload.discipline==='Ритм-симулятор'&&payload.athletes.length<1)return 'Добавьте хотя бы одного спортсмена.';
  if(payload.discipline==='DTS'){
    if(payload.teams.length<1)return 'Добавьте хотя бы одну команду ДТС.';
    for(const team of payload.teams){if(!team.teamName)return 'Укажите название каждой команды ДТС.';const mains=team.athletes.filter(a=>a.role.startsWith('Основной'));if(mains.length!==5)return `В команде «${team.teamName}» должно быть 5 основных спортсменов.`;}
  }
  return '';
}

function download(payload){const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=payload.submissionId+'.json';a.click();URL.revokeObjectURL(a.href);}

async function postLegacyPayload(payload){
  const endpoint=(cfg.endpoint||'').trim();
  if(!endpoint)throw new Error('endpoint');
  const body=new URLSearchParams();body.set('payload',JSON.stringify(payload));
  await fetch(endpoint,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body});
}

async function sendPayload(payload){
  if(payload.discipline==='DTS'){
    for(let i=0;i<payload.teams.length;i++){
      const team=payload.teams[i];
      await postLegacyPayload({...payload,submissionId:`${payload.submissionId}-T${i+1}`,teamName:team.teamName,teams:[],athletes:team.athletes});
    }
  }else{
    await postLegacyPayload({...payload,teams:[]});
  }
}

competition.addEventListener('change',loadDisciplines);discipline.addEventListener('change',setMode);$('addRhythmBtn').addEventListener('click',addRhythmAthlete);$('addTeamBtn').addEventListener('click',addTeam);
$('downloadBtn').addEventListener('click',()=>{if(!form.reportValidity()||!allowed())return;const payload=buildPayload();const err=validateRoster(payload);if(err)return alert(err);download(payload);});

form.addEventListener('submit',async e=>{
  e.preventDefault();if(!form.reportValidity())return;if(!allowed())return alert('Выберите доступное открытое региональное соревнование и формат участия.');
  const payload=buildPayload();const err=validateRoster(payload);if(err)return alert(err);
  statusBox.textContent='Отправляем предварительную заявку…';
  try{
    await sendPayload(payload);
    saveToLocalRegistry(payload);
    statusBox.innerHTML=`Предварительная заявка <b>${payload.submissionId}</b> отправлена на обработку. Данные спортсменов${payload.discipline==='DTS'?' и команд':''} сохранены в этом браузере для следующих соревнований.`;
  }catch{
    statusBox.textContent='Не удалось отправить предварительную заявку. Проверьте интернет-соединение и попробуйте ещё раз.';
  }
});

loadCompetitions();loadDisciplines();
