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

let rhythmCounter = 0;
let teamCounter = 0;
const lookupCache = new Map();

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
  root.querySelectorAll('input,select,textarea,button').forEach(el => {
    el.disabled = disabled;
  });
}

function showStep(el, show){
  el.classList.toggle('hidden', !show);
  setSubtreeDisabled(el, !show);
}

function athleteFields(role){
  return `
    <div class="person" data-role="${role}">
      <div class="person-head"><h4>${role}</h4></div>
      <div class="autocomplete-wrap">
        <div class="help athlete-lookup-help">Начните вводить фамилию или имя. Если спортсмен уже был в ваших заявках, его можно выбрать из списка.</div>
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

function contactCredentials(){
  return {
    email: ($('cEmail')?.value || '').trim().toLowerCase(),
    phone: ($('cPhone')?.value || '').replace(/\D/g, '')
  };
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
  if(box){
    box.innerHTML = '';
    box.classList.add('hidden');
  }
}

function renderSuggestions(card, results){
  const box = card.querySelector('.athlete-suggestions');
  if(!box) return;
  box.innerHTML = '';
  if(!results.length){
    box.classList.add('hidden');
    return;
  }
  results.slice(0, 8).forEach(athlete => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'athlete-option';
    const name = [athlete.lastName, athlete.firstName, athlete.middleName].filter(Boolean).join(' ');
    const meta = [athlete.nickname ? `ник: ${athlete.nickname}` : '', athlete.birthDate || ''].filter(Boolean).join(' • ');
    const strong = document.createElement('strong');
    strong.textContent = name;
    const small = document.createElement('span');
    small.textContent = meta;
    btn.append(strong, small);
    btn.addEventListener('click', () => fillAthlete(card, athlete));
    box.appendChild(btn);
  });
  box.classList.remove('hidden');
}

async function searchPreviousAthletes(card, query){
  const q = query.trim();
  if(q.length < 1){
    hideSuggestions(card);
    return;
  }
  const contact = contactCredentials();
  if(!contact.email || contact.phone.length < 6){
    hideSuggestions(card);
    return;
  }

  const cacheKey = `${contact.email}|${contact.phone}|${q.toLowerCase()}`;
  if(lookupCache.has(cacheKey)){
    renderSuggestions(card, lookupCache.get(cacheKey));
    return;
  }

  try{
    const res = await fetch('/api/athletes', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({email: contact.email, phone: contact.phone, query: q})
    });
    if(!res.ok) return hideSuggestions(card);
    const data = await res.json();
    const results = Array.isArray(data.results) ? data.results : [];
    lookupCache.set(cacheKey, results);
    renderSuggestions(card, results);
  }catch{
    hideSuggestions(card);
  }
}

function attachAutocomplete(card){
  let timer;
  ['lastName','firstName'].forEach(k => {
    const input = card.querySelector(`[data-k="${k}"]`);
    if(!input) return;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => searchPreviousAthletes(card, input.value), 220);
    });
    input.addEventListener('focus', () => {
      if(input.value.trim()) searchPreviousAthletes(card, input.value);
    });
  });
}

document.addEventListener('click', e => {
  document.querySelectorAll('.person').forEach(card => {
    if(!card.contains(e.target)) hideSuggestions(card);
  });
});

function renumberRhythm(){
  const cards = [...rhythmPeople.querySelectorAll('.rhythm-athlete')];
  cards.forEach((card, index) => {
    card.dataset.role = `Спортсмен ${index + 1}`;
    const h = card.querySelector('h4');
    if(h) h.textContent = `Спортсмен ${index + 1}`;
    const remove = card.querySelector('.remove-athlete');
    if(remove) remove.classList.toggle('hidden', cards.length === 1);
  });
}

function addRhythmAthlete(){
  rhythmCounter += 1;
  const wrap = document.createElement('div');
  wrap.className = 'person rhythm-athlete';
  wrap.dataset.role = `Спортсмен ${rhythmCounter}`;
  wrap.innerHTML = `
    <div class="person-head">
      <h4>Спортсмен ${rhythmCounter}</h4>
      <button type="button" class="mini-btn danger remove-athlete">Удалить</button>
    </div>
    <div class="autocomplete-wrap">
      <div class="help athlete-lookup-help">Начните вводить фамилию или имя. Если спортсмен уже был в ваших заявках, его можно выбрать из списка.</div>
      <div class="athlete-suggestions hidden"></div>
    </div>
    <div class="form-grid">
      <div class="field"><label>Фамилия *</label><input data-k="lastName" autocomplete="off" required></div>
      <div class="field"><label>Имя *</label><input data-k="firstName" autocomplete="off" required></div>
      <div class="field"><label>Отчество *</label><input data-k="middleName" required></div>
      <div class="field"><label>Дата рождения *</label><input data-k="birthDate" type="date" required></div>
      <div class="field full"><label>Никнейм *</label><input data-k="nickname" required></div>
    </div>`;
  wrap.querySelector('.remove-athlete').addEventListener('click', () => {
    if(rhythmPeople.children.length <= 1) return;
    wrap.remove();
    renumberRhythm();
  });
  rhythmPeople.appendChild(wrap);
  attachAutocomplete(wrap);
  renumberRhythm();
}

function addReserve(teamCard){
  const list = teamCard.querySelector('.reserve-list');
  const current = list.querySelectorAll('.reserve-athlete').length;
  if(current >= 2) return;

  const container = document.createElement('div');
  container.className = 'reserve-athlete';
  container.innerHTML = athleteFields(`Запасной спортсмен ${current + 1}`);
  const card = container.querySelector('.person');

  const head = card.querySelector('.person-head');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'mini-btn danger';
  remove.textContent = 'Удалить';
  head.appendChild(remove);
  remove.addEventListener('click', () => {
    container.remove();
    renumberReserves(teamCard);
  });

  list.appendChild(container);
  attachAutocomplete(card);
  renumberReserves(teamCard);
}

function renumberReserves(teamCard){
  const list = teamCard.querySelector('.reserve-list');
  const reserves = [...list.querySelectorAll('.reserve-athlete .person')];
  reserves.forEach((card, index) => {
    card.dataset.role = `Запасной спортсмен ${index + 1}`;
    const h = card.querySelector('h4');
    if(h) h.textContent = `Запасной спортсмен ${index + 1}`;
  });
  teamCard.querySelector('.add-reserve').disabled = reserves.length >= 2;
}

function renumberTeams(){
  const teams = [...dtsTeams.querySelectorAll('.team-card')];
  teams.forEach((team, index) => {
    team.dataset.teamNumber = String(index + 1);
    const title = team.querySelector('.team-title');
    if(title) title.textContent = `Команда ДТС №${index + 1}`;
    const remove = team.querySelector('.remove-team');
    if(remove) remove.classList.toggle('hidden', teams.length === 1);
  });
}

function addTeam(){
  teamCounter += 1;
  const team = document.createElement('div');
  team.className = 'team-card';
  team.dataset.teamNumber = String(teamCounter);

  let mains = '';
  for(let i = 1; i <= 5; i++) mains += athleteFields(`Основной спортсмен ${i}`);

  team.innerHTML = `
    <div class="team-head">
      <div><div class="tag">ДТС</div><h3 class="team-title">Команда ДТС №${teamCounter}</h3></div>
      <button type="button" class="mini-btn danger remove-team">Удалить команду</button>
    </div>
    <div class="field full"><label>Название команды *</label><input data-team-name required></div>
    <div class="roster-label">Основной состав — 5 спортсменов</div>
    <div class="main-list">${mains}</div>
    <div class="roster-label">Запасные — до 2 спортсменов</div>
    <div class="reserve-list"></div>
    <button type="button" class="mini-btn add-reserve">＋ Добавить запасного</button>`;

  team.querySelector('.remove-team').addEventListener('click', () => {
    if(dtsTeams.querySelectorAll('.team-card').length <= 1) return;
    team.remove();
    renumberTeams();
  });
  team.querySelector('.add-reserve').addEventListener('click', () => addReserve(team));
  team.querySelectorAll('.person').forEach(attachAutocomplete);
  dtsTeams.appendChild(team);
  renumberTeams();
}

function resetParticipants(mode){
  if(mode === 'Ритм-симулятор' && rhythmPeople.children.length === 0) addRhythmAthlete();
  if(mode === 'DTS' && dtsTeams.querySelectorAll('.team-card').length === 0) addTeam();
}

function setMode(){
  const mode = discipline.value;
  const selected = mode === 'DTS' || mode === 'Ритм-симулятор';

  showStep(contactStep, selected);
  showStep(participantsStep, selected);
  showStep(confirmStep, selected);

  rhythmBlock.classList.toggle('hidden', mode !== 'Ритм-симулятор');
  dtsBlock.classList.toggle('hidden', mode !== 'DTS');
  setSubtreeDisabled(rhythmBlock, mode !== 'Ритм-симулятор');
  setSubtreeDisabled(dtsBlock, mode !== 'DTS');

  if(mode === 'Ритм-симулятор'){
    $('participantsTitle').textContent = 'Спортсмены — ритм-симулятор';
    $('participantsHelp').textContent = 'Добавьте одного или сразу нескольких спортсменов в одну заявку.';
  }else if(mode === 'DTS'){
    $('participantsTitle').textContent = 'Команды ДТС';
    $('participantsHelp').textContent = 'Добавьте одну или несколько команд. В каждой команде — 5 основных спортсменов и до 2 запасных.';
  }

  resetParticipants(mode);
}

function collectCard(card){
  const obj = {role: card.dataset.role || ''};
  card.querySelectorAll('[data-k]').forEach(el => obj[el.dataset.k] = el.value.trim());
  return obj;
}

function collectRhythm(){
  return [...rhythmPeople.querySelectorAll('.rhythm-athlete')].map(collectCard);
}

function collectTeams(){
  return [...dtsTeams.querySelectorAll('.team-card')].map((team, index) => {
    const teamName = team.querySelector('[data-team-name]').value.trim();
    const athletes = [...team.querySelectorAll('.person')].map(card => {
      const athlete = collectCard(card);
      athlete.teamName = teamName;
      return athlete;
    });
    return {teamNumber: index + 1, teamName, athletes};
  });
}

function makeId(){
  return 'FFS-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function buildPayload(){
  const mode = discipline.value;
  const teams = mode === 'DTS' ? collectTeams() : [];
  const athletes = mode === 'DTS' ? teams.flatMap(t => t.athletes) : collectRhythm();

  return {
    submissionId: makeId(),
    competition: competition.value,
    discipline: mode,
    teamName: mode === 'DTS' ? teams.map(t => t.teamName).join(' / ') : '',
    teams,
    contact: {
      lastName: $('cLast').value.trim(),
      firstName: $('cFirst').value.trim(),
      middleName: $('cMiddle').value.trim(),
      phone: $('cPhone').value.trim(),
      email: $('cEmail').value.trim(),
      city: $('cCity').value.trim(),
      organization: $('cOrg').value.trim()
    },
    athletes,
    comment: $('comment').value.trim()
  };
}

function allowed(){
  const item = activeCompetitions().find(i => i.name === competition.value);
  return !!item && (item.disciplines || []).includes(discipline.value);
}

function validateRoster(payload){
  if(payload.discipline === 'Ритм-симулятор' && payload.athletes.length < 1){
    return 'Добавьте хотя бы одного спортсмена.';
  }

  if(payload.discipline === 'DTS'){
    if(payload.teams.length < 1) return 'Добавьте хотя бы одну команду ДТС.';
    for(const team of payload.teams){
      if(!team.teamName) return 'Укажите название каждой команды ДТС.';
      const mains = team.athletes.filter(a => a.role.startsWith('Основной'));
      if(mains.length !== 5) return `В команде «${team.teamName}» должно быть 5 основных спортсменов.`;
    }
  }
  return '';
}

function download(payload){
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = payload.submissionId + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

competition.addEventListener('change', loadDisciplines);
discipline.addEventListener('change', setMode);
$('addRhythmBtn').addEventListener('click', addRhythmAthlete);
$('addTeamBtn').addEventListener('click', addTeam);

$('downloadBtn').addEventListener('click', () => {
  if(!form.reportValidity() || !allowed()) return;
  const payload = buildPayload();
  const err = validateRoster(payload);
  if(err) return alert(err);
  download(payload);
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  if(!form.reportValidity()) return;
  if(!allowed()) return alert('Выберите доступное открытое региональное соревнование и формат участия.');

  const payload = buildPayload();
  const err = validateRoster(payload);
  if(err) return alert(err);

  statusBox.textContent = 'Отправляем заявку…';
  try{
    const res = await fetch('/api/apply', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok || !data.ok) throw new Error(data.error || 'Ошибка отправки');

    lookupCache.clear();
    let message = `Заявка <b>${data.id || payload.submissionId}</b> принята. Спортсмены сохранены для следующих заявок.`;
    if(data.googleSheetsSynced === false){
      message += ' Заявка сохранена в системе Федерации; синхронизация с Google-таблицей будет выполнена отдельно.';
    }
    statusBox.innerHTML = message;
  }catch(ex){
    statusBox.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с Федерацией.';
  }
});

loadCompetitions();
loadDisciplines();
