/************************************************************
 * SDAI Bosch Manager V5 - Apps Script Backend
 * Banco central em Google Sheets
 ************************************************************/
const APP_NAME = 'SDAI Bosch Manager';
const PROP_DB_ID = 'SDAI_DB_SPREADSHEET_ID';
const TABLES = {
  Configuracoes:['chave','valor','updatedAt'],
  Storage:['chave','json','updatedAt'],
  Log:['dataHora','usuario','acao','detalhe']
};
function doGet(e){ return handle_(e); }
function doPost(e){ return handle_(e); }
function handle_(e){
  const action = (e && e.parameter && e.parameter.action) || 'status';
  let payload = {};
  try{ payload = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {}; }catch(err){}
  let out;
  try{
    if(action==='setupDatabase') out = setupDatabase_();
    else if(action==='saveAll') out = saveAll_(payload.data||{});
    else if(action==='loadAll') out = loadAll_();
    else out = {ok:true, app:APP_NAME, action};
  }catch(err){ out = {ok:false, error:err.message || String(err)}; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function setupDatabase_(){
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_DB_ID);
  let ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Banco - SDAI Bosch Manager');
  props.setProperty(PROP_DB_ID, ss.getId());
  Object.keys(TABLES).forEach(name=>ensureSheet_(ss,name,TABLES[name]));
  log_('setupDatabase','Banco configurado');
  return {ok:true, spreadsheetId:ss.getId(), url:ss.getUrl()};
}
function getDb_(){
  const id = PropertiesService.getScriptProperties().getProperty(PROP_DB_ID);
  if(!id) return SpreadsheetApp.openById(setupDatabase_().spreadsheetId);
  return SpreadsheetApp.openById(id);
}
function ensureSheet_(ss,name,headers){
  let sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if(sh.getLastRow()===0) sh.appendRow(headers);
  return sh;
}
function saveAll_(data){
  const ss = getDb_(); const sh = ensureSheet_(ss,'Storage',TABLES.Storage);
  const values = sh.getDataRange().getValues();
  const json = JSON.stringify(data); const now = new Date();
  let row = -1;
  for(let i=1;i<values.length;i++){ if(values[i][0]==='main') row=i+1; }
  if(row>0) sh.getRange(row,1,1,3).setValues([['main',json,now]]);
  else sh.appendRow(['main',json,now]);
  log_('saveAll','Base salva pelo frontend');
  return {ok:true, updatedAt:now};
}
function loadAll_(){
  const ss = getDb_(); const sh = ensureSheet_(ss,'Storage',TABLES.Storage);
  const values = sh.getDataRange().getValues();
  for(let i=1;i<values.length;i++){
    if(values[i][0]==='main') return {ok:true, data: JSON.parse(values[i][1]||'{}'), updatedAt: values[i][2]};
  }
  return {ok:true, data:null};
}
function log_(acao, detalhe){
  try{
    const ss=getDb_(); const sh=ensureSheet_(ss,'Log',TABLES.Log);
    sh.appendRow([new Date(), Session.getActiveUser().getEmail() || 'usuario', acao, detalhe]);
  }catch(e){}
}
