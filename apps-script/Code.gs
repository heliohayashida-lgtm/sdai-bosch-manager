/************************************************************
 * SDAI Bosch Manager v5 - Apps Script API
 * Frontend: GitHub Pages
 * Banco: Google Sheets centralizado
 ************************************************************/

const APP_NAME = 'SDAI Bosch Manager';
const PROP_DB_ID = 'SDAI_MANAGER_DB_ID';
const DB_SHEET = 'DB_JSON';
const AUDIT_SHEET = 'AUDITORIA';

function doGet(e) {
  return jsonOutput({ ok: true, app: APP_NAME, message: 'API online' });
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    const action = body.action || '';
    const payload = body.payload || {};

    if (action === 'setupDB') return jsonOutput(setupDB());
    if (action === 'getDB') return jsonOutput(getDB());
    if (action === 'saveDB') return jsonOutput(saveDB(payload.db || {}));
    if (action === 'resetDB') return jsonOutput(resetDB());

    return jsonOutput({ ok: false, error: 'Ação inválida: ' + action });
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function setupDB() {
  let ss = getSpreadsheet(false);
  if (!ss) {
    ss = SpreadsheetApp.create('SDAI Manager - Banco de Dados');
    PropertiesService.getScriptProperties().setProperty(PROP_DB_ID, ss.getId());
  }
  ensureStructure(ss);
  audit('setupDB', 'Banco configurado');
  return { ok: true, spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() };
}

function getDB() {
  const ss = getSpreadsheet(true);
  ensureStructure(ss);
  const sh = ss.getSheetByName(DB_SHEET);
  const raw = sh.getRange('A2').getValue();
  let db = {};
  if (raw) {
    try { db = JSON.parse(raw); } catch (e) { db = {}; }
  }
  return { ok: true, db, spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() };
}

function saveDB(db) {
  const ss = getSpreadsheet(true);
  ensureStructure(ss);
  const sh = ss.getSheetByName(DB_SHEET);
  sh.getRange('A1').setValue('json');
  sh.getRange('A2').setValue(JSON.stringify(db || {}));
  sh.getRange('B1').setValue('updatedAt');
  sh.getRange('B2').setValue(new Date());
  sh.getRange('C1').setValue('updatedBy');
  sh.getRange('C2').setValue(Session.getActiveUser().getEmail() || 'usuário não identificado');
  audit('saveDB', 'Base salva pelo frontend');
  return { ok: true, updatedAt: new Date().toISOString() };
}

function resetDB() {
  const ss = getSpreadsheet(true);
  ensureStructure(ss);
  ss.getSheetByName(DB_SHEET).getRange('A2:C2').clearContent();
  audit('resetDB', 'Base limpa');
  return { ok: true };
}

function getSpreadsheet(required) {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_DB_ID);
  if (!id) {
    if (required) throw new Error('Banco ainda não configurado. Clique em Configurar Banco Google no sistema.');
    return null;
  }
  return SpreadsheetApp.openById(id);
}

function ensureStructure(ss) {
  let db = ss.getSheetByName(DB_SHEET);
  if (!db) db = ss.insertSheet(DB_SHEET);
  db.getRange('A1').setValue('json');
  db.getRange('B1').setValue('updatedAt');
  db.getRange('C1').setValue('updatedBy');

  let auditSheet = ss.getSheetByName(AUDIT_SHEET);
  if (!auditSheet) auditSheet = ss.insertSheet(AUDIT_SHEET);
  if (auditSheet.getLastRow() === 0) {
    auditSheet.appendRow(['dataHora', 'usuario', 'acao', 'descricao']);
  }
}

function audit(action, description) {
  try {
    const ss = getSpreadsheet(false);
    if (!ss) return;
    ensureStructure(ss);
    ss.getSheetByName(AUDIT_SHEET).appendRow([
      new Date(),
      Session.getActiveUser().getEmail() || 'usuário não identificado',
      action,
      description
    ]);
  } catch (e) {}
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
