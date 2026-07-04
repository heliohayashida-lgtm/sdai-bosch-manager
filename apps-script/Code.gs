/************************************************************
 * SDAI Bosch Manager v5 - Google Apps Script Backend
 * Banco central: Google Sheets
 * Publicação: Apps Script Web App
 ************************************************************/

const APP_NAME = 'SDAI Bosch Manager';
const PROP_DB_ID = 'SDAI_DB_SPREADSHEET_ID';

const TABLES = {
  Configuracoes: ['id','chave','valor','createdAt','updatedAt','updatedBy'],
  Empreendimentos: ['id','nome','cliente','localizacao','observacao','createdAt','updatedAt','updatedBy'],
  Paineis: ['id','empreendimentoId','nome','modelo','localizacao','observacao','createdAt','updatedAt','updatedBy'],
  Lacos: ['id','painelId','painel','numero','piso','observacao','createdAt','updatedAt','updatedBy'],
  FLMs: ['id','painelId','painel','lacoId','laco','piso','endereco','modelo','observacao','createdAt','updatedAt','updatedBy'],
  Portas: ['id','flmId','painel','laco','piso','flmEndereco','porta','lojaAreaId','lojaAreaNome','tipoAmbiente','observacao','createdAt','updatedAt','updatedBy'],
  LojasAreas: ['id','nome','tipoAmbiente','painel','laco','piso','flmId','flmEndereco','porta','statusAtual','ultimaAlteracao','observacao','createdAt','updatedAt','updatedBy'],
  Equipamentos: ['id','painel','laco','piso','flmId','flmEndereco','porta','lojaAreaId','lojaAreaNome','tipo','modelo','fabricante','endereco','statusAtual','ultimaAlteracao','observacao','createdAt','updatedAt','updatedBy'],
  Falhas: ['id','itemTipo','itemId','nomeItem','painel','laco','piso','lojaAreaNome','statusAnterior','statusNovo','responsavel','origem','motivo','observacao','dataHora','createdAt','updatedBy'],
  PlanoAcao: ['id','falhaId','itemTipo','itemId','nomeItem','painel','laco','piso','lojaAreaNome','categoria','prioridade','responsavelGrupo','responsavelNome','situacao','dataPrevista','justificativa','providencia','necessitaCompra','material','quantidade','observacaoCompra','createdAt','concluidoAt','updatedAt','updatedBy'],
  Historico: ['id','entidade','entidadeId','acao','statusAnterior','statusNovo','descricao','responsavel','origem','dataHora','createdAt','updatedBy'],
  ImportLog: ['id','arquivo','modo','registrosLidos','importados','atualizados','ignorados','diagnosticoJson','createdAt','updatedBy']
};

function doGet() {
  return HtmlService
    .createTemplateFromFile('Index')
    .evaluate()
    .setTitle(APP_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function api(action, payload) {
  try {
    payload = payload || {};
    switch (action) {
      case 'setupDatabase': return setupDatabase(payload);
      case 'getDatabaseInfo': return getDatabaseInfo();
      case 'readAll': return readAll(payload.table);
      case 'readDatabase': return readDatabase();
      case 'upsert': return upsert(payload.table, payload.record);
      case 'append': return appendRecord(payload.table, payload.record);
      case 'delete': return deleteRecord(payload.table, payload.id);
      case 'bulkReplace': return bulkReplace(payload.table, payload.records || []);
      case 'logHistory': return appendRecord('Historico', payload.record);
      default: throw new Error('Ação inválida: ' + action);
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

function setupDatabase(payload) {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const existingId = props.getProperty(PROP_DB_ID);
  if (existingId) {
    ss = SpreadsheetApp.openById(existingId);
  } else {
    const name = (payload && payload.name) || 'Banco - SDAI Bosch Manager';
    ss = SpreadsheetApp.create(name);
    props.setProperty(PROP_DB_ID, ss.getId());
  }

  Object.keys(TABLES).forEach(table => ensureSheet(ss, table, TABLES[table]));
  return { ok: true, spreadsheetId: ss.getId(), url: ss.getUrl(), tables: Object.keys(TABLES) };
}

function getDatabaseInfo() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_DB_ID);
  if (!id) return { ok: true, configured: false };
  const ss = SpreadsheetApp.openById(id);
  return { ok: true, configured: true, spreadsheetId: id, url: ss.getUrl() };
}

function getDb_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROP_DB_ID);
  if (!id) throw new Error('Banco Google ainda não configurado. Execute setupDatabase.');
  return SpreadsheetApp.openById(id);
}

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const current = sh.getRange(1, 1, 1, Math.max(headers.length, sh.getLastColumn() || headers.length)).getValues()[0];
  const missingOrEmpty = headers.some((h, i) => current[i] !== h);
  if (missingOrEmpty) {
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, headers.length);
  }
  return sh;
}

function readAll(table) {
  if (!TABLES[table]) throw new Error('Tabela inexistente: ' + table);
  const ss = getDb_();
  const sh = ensureSheet(ss, table, TABLES[table]);
  const values = sh.getDataRange().getValues();
  const headers = values.shift() || [];
  const rows = values.filter(r => r.some(v => v !== '')).map(r => rowToObject_(headers, r));
  return { ok: true, table, rows };
}

function readDatabase() {
  const data = {};
  Object.keys(TABLES).forEach(t => data[t] = readAll(t).rows);
  return { ok: true, data };
}

function appendRecord(table, record) {
  if (!TABLES[table]) throw new Error('Tabela inexistente: ' + table);
  const ss = getDb_();
  const sh = ensureSheet(ss, table, TABLES[table]);
  const headers = TABLES[table];
  const now = new Date().toISOString();
  const email = getUserEmail_();
  const out = Object.assign({}, record || {});
  out.id = out.id || Utilities.getUuid();
  out.createdAt = out.createdAt || now;
  out.updatedAt = now;
  out.updatedBy = email;
  sh.appendRow(headers.map(h => out[h] !== undefined ? out[h] : ''));
  return { ok: true, table, record: out };
}

function upsert(table, record) {
  if (!record) throw new Error('Registro vazio.');
  if (!record.id) return appendRecord(table, record);
  if (!TABLES[table]) throw new Error('Tabela inexistente: ' + table);

  const ss = getDb_();
  const sh = ensureSheet(ss, table, TABLES[table]);
  const headers = TABLES[table];
  const values = sh.getDataRange().getValues();
  const idCol = headers.indexOf('id');
  const now = new Date().toISOString();
  const email = getUserEmail_();
  const out = Object.assign({}, record, { updatedAt: now, updatedBy: email });

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idCol]) === String(record.id)) {
      sh.getRange(i + 1, 1, 1, headers.length).setValues([headers.map(h => out[h] !== undefined ? out[h] : '')]);
      return { ok: true, table, record: out, updated: true };
    }
  }
  out.createdAt = out.createdAt || now;
  sh.appendRow(headers.map(h => out[h] !== undefined ? out[h] : ''));
  return { ok: true, table, record: out, inserted: true };
}

function deleteRecord(table, id) {
  if (!TABLES[table]) throw new Error('Tabela inexistente: ' + table);
  const ss = getDb_();
  const sh = ensureSheet(ss, table, TABLES[table]);
  const values = sh.getDataRange().getValues();
  const idCol = TABLES[table].indexOf('id');
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][idCol]) === String(id)) {
      sh.deleteRow(i + 1);
      return { ok: true, table, id, deleted: true };
    }
  }
  return { ok: true, table, id, deleted: false };
}

function bulkReplace(table, records) {
  if (!TABLES[table]) throw new Error('Tabela inexistente: ' + table);
  const ss = getDb_();
  const sh = ensureSheet(ss, table, TABLES[table]);
  const headers = TABLES[table];
  sh.clearContents();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (records.length) {
    sh.getRange(2, 1, records.length, headers.length).setValues(records.map(r => headers.map(h => r[h] !== undefined ? r[h] : '')));
  }
  return { ok: true, table, count: records.length };
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => obj[h] = row[i]);
  return obj;
}

function getUserEmail_() {
  try { return Session.getActiveUser().getEmail() || 'usuario'; }
  catch(e) { return 'usuario'; }
}
