import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

const html=fs.readFileSync('apply.html','utf8');
const cfg=fs.readFileSync('assets/form-config.js','utf8');
const code=fs.readFileSync('assets/apply-pages.js','utf8');
const dom=new JSDOM(html,{url:'https://ffsro.ru/apply.html',runScripts:'outside-only'});
const {window:w}=dom;
const $=id=>w.document.getElementById(id);
const requests=[];
w.fetch=async (url,opts)=>{ requests.push({url,opts});return {ok:true};};
w.eval(cfg);
w.eval(code);
const change=(id,value)=>{
  $(id).value=value;
  $(id).dispatchEvent(new w.Event('change',{bubbles:true}));
};
const opts=[...$('competition').options];
assert.ok(opts.length>=2,'Competition list must be populated');
change('competition',opts[1].value);
const choices=[...$('discipline').options].map(x=>x.value);
assert.deepEqual(choices.slice(1),['DTS','Ритм-симулятор','Фиджитал-баскетбол','Фиджитал-футбол']);
change('discipline','DTS');
assert.equal($('dtsTeams').querySelectorAll('.team-card').length,1);
assert.equal($('dtsTeams').querySelectorAll('.main-list .person').length,5);
change('discipline','Ритм-симулятор');
assert.equal($('rhythmPeople').querySelectorAll('.person').length,1);

for (const sport of ['Фиджитал-баскетбол','Фиджитал-футбол']){
  change('discipline',sport);
  assert.equal($('sportsBlock').classList.contains('hidden'),false);
  assert.equal($('participantsStep').classList.contains('hidden'),false);
  assert.equal($('sportsTeams').querySelectorAll('.team-card').length,1);
  assert.equal($('sportsTeams').querySelectorAll('.main-list .person').length,1);
  $('addSportTeamBtn').click();
  assert.equal($('sportsTeams').querySelectorAll('.team-card').length,2);
  const teams=[...$('sportsTeams').querySelectorAll('.team-card')];
  teams[0].querySelector('[data-team-name]').value='Тестовая команда 1';
  teams[0].querySelector('[data-team-coach]').value='Тренер Тест';
  teams[0].querySelector('.add-sport-main').click();
  teams[0].querySelector('.add-sport-reserve').click();
  teams[1].querySelector('[data-team-name]').value='Тестовая команда 2';
  const athleteCards=[...$('sportsTeams').querySelectorAll('.person')];
  athleteCards.forEach((card,i)=>{
    for(const [key,val] of Object.entries({
      lastName:'Тестов'+i,firstName:'Алексей',middleName:'',birthDate:'2004-04-04',nickname:'user'+i
    })){ card.querySelector('[data-k="'+key+'"]').value=val; }
  });
  const payload=w.eval('buildPayload()');
  assert.equal(payload.discipline,sport);
  assert.equal(payload.teams.length,2);
  assert.equal(payload.teams[0].athletes.length,3);
  assert.equal(payload.teams[1].athletes.length,1);
  assert.equal(payload.athletes.length,4);
  assert.equal(w.eval('validateRoster(buildPayload())'),'');
  requests.length=0;
  await w.eval('sendPayload(buildPayload())');
  assert.equal(requests.length,2,'Each team should be sent separately');
  const sent=requests.map(r=>JSON.parse(r.opts.body.get('payload')));
  assert.deepEqual(sent.map(x=>x.teamName),['Тестовая команда 1','Тестовая команда 2']);
  assert.ok(sent.every(x=>x.discipline===sport && x.submissionId.endsWith('-T1') || x.discipline===sport && x.submissionId.endsWith('-T2')));
  assert.equal(sent[0].athletes.length,3);
  assert.equal(sent[1].athletes.length,1);
  assert.ok(sent[0].comment.includes('Тренер Тест'));
  assert.ok(requests.every(r=>r.opts.mode==='no-cors'));
}
console.log('PASS: all 4 disciplines, team editor, roster, payloads, separate team transport');
