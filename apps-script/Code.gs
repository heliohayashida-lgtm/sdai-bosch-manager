/************************************************************
 * SDAI Bosch Manager — Apps Script API simplificada
 * Banco central Google Sheets para GitHub Pages
 * Estrutura: salva e carrega a base completa V4 em uma aba DB.
 ************************************************************/

const APP_NAME = 'SDAI Bosch Manager';
const PROP_DB_ID = 'SDAI_DB_SPREADSHEET_ID';

function doGet(e) {
  const p = (e && e.parameter) || {};

  if (p.callback) {
    const result = route_(p.action || 'ping', p);
    return ContentService
      .createTextOutput(String(p.callback) + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  if (!p.action) {
    return HtmlService.createHtmlOutput('<h2>SDAI Bosch Manager API</h2><p>Backend ativo.</p>');
  }

  return json_(route_(p.action, p));
}

function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || 'ping';
    const result = route_(action, p);
    return json_(result);
  } catch (err) {
    return json_({ ok:false, error:String(err && err.message ? err.message : err) });
  }
}

function route_(action, payload) {
  try {
    switch (action) {
      case 'ping':
        return { ok:true, app:APP_NAME, now:new Date().toISOString(), user:getUserEmail_() };
      case 'setupDatabase':
        return setupDatabase_(payload || {});
      case 'getDatabaseInfo':
        return getDatabaseInfo_();
      case 'getAll':
        return getAll_();
      case 'saveAll':
        return saveAll_(payload || {});
      case 'clearDatabase':
        return clearDatabase_();
      default:
        return { ok:false, error:'Ação não reconhecida: ' + action };
    }
  } catch (err) {
    return { ok:false, error:String(err && err.message ? err.message : err), stack:String(err && err.stack ? err.stack : '') };
  }
}

function setupDatabase_(payload) {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_DB_ID);
  let ss;

  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    const name = payload.name || 'Banco - SDAI Bosch Manager';
    ss = SpreadsheetApp.create(name);
    props.setProperty(PROP_DB_ID, ss.getId());
  }

  ensureDbSheet_(ss);
  return { ok:true, configured:true, spreadsheetId:ss.getId(), url:ss.getUrl() };
}

function getDatabaseInfo_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_DB_ID);
  if (!id) return { ok:true, configured:false };
  const ss = SpreadsheetApp.openById(id);
  return { ok:true, configured:true, spreadsheetId:id, url:ss.getUrl() };
}

function getAll_() {
  const ss = getDb_();
  const sh = ensureDbSheet_(ss);
  const values = sh.getDataRange().getValues();
  let json = '';
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === 'db') {
      json = values[i][1] || '';
      break;
    }
  }
  const data = json ? JSON.parse(json) : {};
  return { ok:true, data:data, hasData: hasContent_(data), spreadsheetId:ss.getId(), url:ss.getUrl(), now:new Date().toISOString() };
}

function saveAll_(payload) {
  const ss = getDb_();
  const sh = ensureDbSheet_(ss);
  let data = payload.data || payload.db || '';

  // data chega em base64 pelo formulário oculto para evitar limite/cors.
  if (data && /^[A-Za-z0-9+/=]+$/.test(String(data).slice(0,80))) {
    try {
      data = Utilities.newBlob(Utilities.base64Decode(String(data))).getDataAsString('UTF-8');
    } catch(e) {}
  }

  if (typeof data !== 'string') data = JSON.stringify(data || {});
  JSON.parse(data); // valida JSON

  sh.clear();
  sh.getRange(1,1,1,4).setValues([['chave','json','updatedAt','updatedBy']]);
  sh.getRange(2,1,1,4).setValues([['db', data, new Date(), getUserEmail_()]]);
  sh.setFrozenRows(1);

  return { ok:true, savedAt:new Date().toISOString(), user:getUserEmail_() };
}

function clearDatabase_() {
  const ss = getDb_();
  const sh = ensureDbSheet_(ss);
  sh.clear();
  sh.getRange(1,1,1,4).setValues([['chave','json','updatedAt','updatedBy']]);
  sh.setFrozenRows(1);
  return { ok:true, clearedAt:new Date().toISOString() };
}

function getDb_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_DB_ID);
  if (!id) throw new Error('Banco Google ainda não configurado. Execute setupDatabase.');
  return SpreadsheetApp.openById(id);
}

function ensureDbSheet_(ss) {
  let sh = ss.getSheetByName('DB');
  if (!sh) sh = ss.insertSheet('DB');
  if (sh.getLastRow() === 0 || sh.getRange(1,1).getValue() !== 'chave') {
    sh.clear();
    sh.getRange(1,1,1,4).setValues([['chave','json','updatedAt','updatedBy']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function hasContent_(data) {
  if (!data || typeof data !== 'object') return false;
  const keys = ['paineis','lacos','flms','portas','locais','equipamentos','falhas','planos','inconsistencias','imports'];
  return keys.some(function(k){ return Array.isArray(data[k]) && data[k].length > 0; });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getUserEmail_() {
  try { return Session.getActiveUser().getEmail() || 'usuario'; }
  catch(e) { return 'usuario'; }
}
