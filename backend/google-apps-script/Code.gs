const SPREADSHEET_ID = 'PASTE_SPREADSHEET_ID_HERE';

function isAllowedCompetition_(name){
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const ref = ss.getSheetByName('Справочник');
  if(!ref) return false;
  const lastRow = ref.getLastRow();
  if(lastRow < 2) return false;
  return ref.getRange(2,1,lastRow-1,4).getValues().some(row =>
    String(row[0]).trim() === String(name).trim() &&
    String(row[1]).trim() === 'Региональный' &&
    String(row[2]).trim() === 'Открыт'
  );
}

function doGet(){
  return ContentService
    .createTextOutput(JSON.stringify({ok:true,service:'phygital61-applications'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try{
    const payload = JSON.parse((e && e.parameter && e.parameter.payload) || '{}');
    if(!payload.submissionId || !payload.competition || !payload.discipline){
      throw new Error('Некорректная заявка');
    }
    if(!isAllowedCompetition_(payload.competition)){
      throw new Error('Приём заявок на это соревнование закрыт или соревнование не является региональным.');
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const apps = ss.getSheetByName('Заявки');
    const ath = ss.getSheetByName('Участники');
    if(!apps || !ath) throw new Error('В таблице отсутствуют листы Заявки/Участники');

    const c = payload.contact || {};
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

    return ContentService
      .createTextOutput(JSON.stringify({ok:true,id:payload.submissionId}))
      .setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService
      .createTextOutput(JSON.stringify({ok:false,error:String(err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }finally{
    lock.releaseLock();
  }
}
