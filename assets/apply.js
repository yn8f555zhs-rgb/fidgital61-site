const $ = id => document.getElementById(id);
const cfg = window.FORM_CONFIG || {};
const competition = $('competition');
const discipline = $('discipline');
const details = $('applicationDetails');
const rhythmBlock = $('rhythmBlock');
const dtsBlock = $('dtsBlock');
const rhythmPeople = $('rhythmPeople');
const dtsTeams = $('dtsTeams');
const statusBox = $('status');
const form = $('appForm');

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

function athleteFields(role, required = true){
  const req = required ? ' required' : '';
  return `
    <div class="person" data-role="${role}">
      <div class="person-head"><h4>${role}</h4></div>
      <div class="form-grid">
        <div class="field"><label>Фамилия *</label><input data-k="lastName"${req}></div>
        <div class="field"><label>Имя *</label><input data-k="firstName"${req}></div>
        <div class="field"><label>Отчество *</label><input data-k="middleName"${req}></div>
        <div class="field"><label>Дата рождения *</label><input data-k="birthDate" type="date"${req}></div>
        <div class="field full"><label>Никнейм *</label><input data-k="nickname"${req}></div>
      </div>
    </div>`;
}

function renumberRhythm(){
  [...rhythmPeople.querySelectorAll('.rhythm-athlete')].forEach((card, index) => {
    card.dataset.role = `Спортсмен ${index + 1}`;
    const h = card.querySelector('h4');
    if(h) h.textContent = `Спортсмен ${index + 1}`;
    const remove = card.querySelector('.remove-athlete');
    if(remove) remove.classList.toggle('hidden', rhythmPeople.children.length === 1);
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
    <div class="form-grid">
      <div class="field"><label>Фамилия *</label><input data-k="lastName" required></div>
      <div class="field"><label>Имя *</label><input data-k="firstName" required></div>
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
  renumberRhythm();
}

function addReserve(teamCard){
  const list = teamCard.querySelector('.reserve-list');
  const current = list.querySelectorAll('.reserve-athlete').length;
  if(current >= 2) return;
  const reserve = document.createElement('div');
  reserve.className = 'reserve-athlete';
  reserve.innerHTML = athleteFields(`Запасной спортсмен ${current + 1}`, true);
  list.appendChild(reserve);
  const btn = teamCard.querySelector('.add-reserve');
  btn.disabled = list.querySelectorAll('.reserve-athlete').length >= 2;
}

function renumberTeams(){
  [...dtsTeams.querySelectorAll('.team-card')].forEach((team, index) => {
    team.dataset.teamNumber = String(index + 1);
    const title = team.querySelector('.team-title');
    if(title) title.textContent = `Команда ДТС №${index + 1}`;
    const remove = team.querySelector('.remove-team');
    if(remove) remove.classList.toggle('hidden', dtsTeams.querySelectorAll('.team-card').length === 1);
  });
}

function addTeam(){
  teamCounter += 1;
  const team = document.createElement('div');
  team.className = 'team-card';
  team.dataset.teamNumber = String(teamCounter);

  let mains = '';
  for(let i = 1; i <= 5; i++) mains += athleteFields(`Основной спортсмен ${i}`, true);

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
  details.classList.toggle('hidden', !selected);
  rhythmBlock.classList.toggle('hidden', mode !== 'Ритм-симулятор');
  dtsBlock.classList.toggle('hidden', mode !== 'DTS');

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
  if(payload.discipline === 'Ритм-симулятор'){
    if(payload.athletes.length < 1) return 'Добавьте хотя бы одного спортсмена.';
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
  const p = buildPayload();
  const err = validateRoster(p);
  if(err) return alert(err);
  download(p);
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  if(!form.reportValidity()) return;
  if(!allowed()) return alert('Выберите доступное открытое региональное соревнование и формат участия.');

  const p = buildPayload();
  const err = validateRoster(p);
  if(err) return alert(err);

  const endpoint = (cfg.endpoint || '').trim();
  if(!endpoint) return alert('Система приёма заявок пока не подключена.');

  statusBox.textContent = 'Отправляем заявку…';
  try{
    const body = new URLSearchParams();
    body.set('payload', JSON.stringify(p));
    await fetch(endpoint, {
      method:'POST',
      mode:'no-cors',
      headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
      body
    });
    statusBox.innerHTML = `Заявка <b>${p.submissionId}</b> отправлена в реестр Федерации. Сохраните номер заявки.`;
  }catch(ex){
    statusBox.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз или свяжитесь с Федерацией.';
  }
});

loadCompetitions();
loadDisciplines();
