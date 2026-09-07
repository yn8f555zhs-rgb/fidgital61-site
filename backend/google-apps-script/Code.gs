const SPREADSHEET_ID = '1e5W0cqFYU4TZI1oN6TrRau3ndPlWEYwyK1LNk37F51k';

function ss_(){
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function digits_(v){
  return String(v || '').replace(/\D/g, '');
}

function norm_(v){
  return String(v || '').trim().toLowerCase();
}

function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function jsonp_(callback, obj){
  const cb = String(callback || '').trim();
  if(!/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(cb)) return json_(obj);
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function isAllowedCompetition_(name, discipline){
  const ref = ss_().getSheetByName('Справочник');
  if(!ref) return false;
  const lastRow = ref.getLastRow();
  if(lastRow < 2) return false;
  return ref.getRange(2,1,lastRow-1,4).getValues().some(row => {
    const matches = String(row[0]).trim() === String(name).trim() &&
      String(row[1]).trim() === 'Региональный' &&
      String(row[2]).trim() === 'Открыт';
    if(!matches) return false;
    const note = String(row[3] || '').trim().toLowerCase();
    if(note.indexOf('только ритм') !== -1 && String(discipline).trim() !== 'Ритм-симулятор') return false;
    return true;
  });
}

function getData_(){
  const ss = ss_();
  const apps = ss.getSheetByName('Заявки');
  const ath = ss.getSheetByName('Участники');
  if(!apps || !ath) throw new Error('В таблице отсутствуют листы Заявки/Участники');
  const appsRows = apps.getLastRow() > 1 ? apps.getRange(2,1,apps.getLastRow()-1,14).getValues() : [];
  const athRows = ath.getLastRow() > 1 ? ath.getRange(2,1,ath.getLastRow()-1,10).getValues() : [];
  return {appsRows, athRows};
}

function searchAthletes_(email, phone, query){
  const e = norm_(email), p = digits_(phone), q = norm_(query);
  if(!e || p.length < 6 || !q) return [];
  const data = getData_();
  const ids = {};
  data.appsRows.forEach(r => {
    if(norm_(r[9]) === e && digits_(r[8]) === p) ids[String(r[0])] = true;
  });
  const out = {}, list = [];
  data.athRows.slice().reverse().forEach(r => {
    if(!ids[String(r[0])]) return;
    const hay = norm_([r[2],r[3],r[4],r[6]].filter(Boolean).join(' '));
    if(hay.indexOf(q) === -1) return;
    const birth = r[5] instanceof Date ? Utilities.formatDate(r[5], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(r[5] || '');
    const key = [norm_(r[2]),norm_(r[3]),norm_(r[4]),birth].join('|');
    if(out[key]) return;
    const item = {lastName:String(r[2]||''),firstName:String(r[3]||''),middleName:String(r[4]||''),birthDate:birth,nickname:String(r[6]||''),lastTeamName:String(r[7]||'')};
    out[key] = true; list.push(item);
  });
  return list.slice(0,8);
}

function searchTeams_(email, phone, query){
  const e = norm_(email), p = digits_(phone), q = norm_(query);
  if(!e || p.length < 6 || !q) return [];
  const data = getData_();
  const byId = {};
  data.athRows.forEach(r => {
    const id = String(r[0]);
    (byId[id] = byId[id] || []).push(r);
  });
  const seen = {}, list = [];
  data.appsRows.slice().reverse().forEach(r => {
    if(norm_(r[9]) !== e || digits_(r[8]) !== p) return;
    if(String(r[3]) !== 'DTS') return;
    const teamName = String(r[4] || '').trim();
    if(!teamName || norm_(teamName).indexOf(q) === -1) return;
    const key = norm_(teamName);
    if(seen[key]) return;
    seen[key] = true;
    const athletes = (byId[String(r[0])] || []).map(a => ({
      role:String(a[1]||''),lastName:String(a[2]||''),firstName:String(a[3]||''),middleName:String(a[4]||''),
      birthDate:a[5] instanceof Date ? Utilities.formatDate(a[5], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(a[5]||''),
      nickname:String(a[6]||'')
    }));
    list.push({teamName,athletes,lastCompetition:String(r[2]||'')});
  });
  return list.slice(0,8);
}

function doGet(e){
  try{
    const p = (e && e.parameter) || {};
    const action = String(p.action || 'health');
    let result;
    if(action === 'athletes') result = {ok:true,results:searchAthletes_(p.email,p.phone,p.query)};
    else if(action === 'teams') result = {ok:true,results:searchTeams_(p.email,p.phone,p.query)};
    else result = {ok:true,service:'phygital61-applications',spreadsheetId:SPREADSHEET_ID};
    return p.callback ? jsonp_(p.callback, result) : json_(result);
  }catch(err){
    const result = {ok:false,error:String(err)};
    return e && e.parameter && e.parameter.callback ? jsonp_(e.parameter.callback, result) : json_(result);
  }
}

function doPost(e){
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try{
    let raw = '{}';
    if(e && e.parameter && e.parameter.payload) raw = e.parameter.payload;
    else if(e && e.postData && e.postData.contents) raw = e.postData.contents;
    const payload = JSON.parse(raw || '{}');

    if(!payload.submissionId || !payload.competition || !payload.discipline) throw new Error('Некорректная заявка');
    if(!isAllowedCompetition_(payload.competition, payload.discipline)) throw new Error('Приём заявок на это соревнование закрыт или дисциплина недоступна.');

    const c = payload.contact || {};
    if(!String(c.email || '').trim() || digits_(c.phone).length < 6) throw new Error('Не заполнены контактные данные');

    const ss = ss_();
    const apps = ss.getSheetByName('Заявки');
    const ath = ss.getSheetByName('Участники');
    if(!apps || !ath) throw new Error('В таблице отсутствуют листы Заявки/Участники');

    apps.appendRow([
      payload.submissionId,
      new Date(),
      payload.competition,
      payload.discipline,
      payload.teamName || '',
      c.lastName || '',
      c.firstName || '',
      c.middleName || '',
      c.phone || '',
      c.email || '',
      c.city || '',
      c.organization || '',
      payload.comment || '',
      'Новая'
    ]);

    (payload.athletes || []).forEach(a => {
      ath.appendRow([
        payload.submissionId,
        a.role || '',
        a.lastName || '',
        a.firstName || '',
        a.middleName || '',
        a.birthDate ? new Date(a.birthDate + 'T00:00:00') : '',
        a.nickname || '',
        a.teamName || payload.teamName || '',
        payload.discipline,
        payload.competition
      ]);
    });

    return json_({ok:true,id:payload.submissionId});
  }catch(err){
    return json_({ok:false,error:String(err)});
  }finally{
    lock.releaseLock();
  }
}
