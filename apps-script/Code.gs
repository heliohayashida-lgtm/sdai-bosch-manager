/*******************************************************
 * SDAI Bosch Manager API v5.1.2
 * Backend Google Apps Script + Google Sheets estruturado
 * Compatível com GitHub Pages: POST + JSONP fallback
 *******************************************************/
const PROP_DB_ID = 'SDAI_DB_SPREADSHEET_ID';

const TABLES = {
  Configuracoes: ['chave','valor','updatedAt'],
  Paineis: ['id','nome','modelo','localizacao','obs'],
  Lacos: ['id','painelId','nome','piso','obs'],
  FLMs: ['id','painelId','lacoId','endereco','modelo','piso','status','ultimaAlteracao','obs'],
  Portas: ['id','flmId','numero','localId','ligacao','obs'],
  Locais: ['id','nome','tipo','painelId','lacoId','piso','flmId','portaId','status','ultimaAlteracao','obs'],
  Equipamentos: ['id','painelId','lacoId','piso','tipo','endereco','modelo','fabricante','localId','flmId','portaId','status','ultimaAlteracao','obs'],
  Falhas: ['id','data','painelId','lacoId','piso','tipo','itemId','itemNome','localId','status','statusAnterior','responsavel','origem','motivo','obs','resolvidaEm'],
  Plano_Acao: ['id','falhaId','criadoEm','atualizadoEm','concluidoEm','categoria','prioridade','responsavel','situacao','prazo','necessitaCompra','material','justificativa','providencia','painel','laco','piso','local','item','statusFalha'],
  Historico: ['id','dataHora','usuario','entidade','entidadeId','acao','descricao'],
  Importacoes: ['id','data','statsJson','errorsJson','romannelJson'],
  Usuarios: ['email','nome','perfil','ativo','updatedAt'],
  Relatorios: ['id','data','tipo','periodo','painel','metadadosJson']
};

function doGet(e){
  try{
    const p = e && e.parameter ? e.parameter : {};
    if(p.action){
      const payload = parsePayload_(p.payload);
      const result = route_(p.action, payload);
      const out = {ok:true, ...result};
      if(p.callback){
        return ContentService
          .createTextOutput(String(p.callback) + '(' + JSON.stringify(out) + ');')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return json_(out);
    }
    return HtmlService.createHtmlOutput('<h2>SDAI Bosch Manager API</h2><p>Backend ativo.</p><p>Versão 5.1.3</p>');
  }catch(err){
    const out = {ok:false,error:String(err && err.message ? err.message : err)};
    const cb = e && e.parameter && e.parameter.callback;
    if(cb){
      return ContentService.createTextOutput(String(cb) + '(' + JSON.stringify(out) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return json_(out);
  }
}

function doPost(e){
  try{
    let body = {};
    if(e && e.postData && e.postData.contents){
      body = JSON.parse(e.postData.contents || '{}');
    } else if(e && e.parameter){
      body = { action:e.parameter.action, payload:parsePayload_(e.parameter.payload) };
    }
    const result = route_(body.action, body.payload || {});
    return json_({ok:true, ...result});
  }catch(err){
    return json_({ok:false, error:String(err && err.message ? err.message : err)});
  }
}

function parsePayload_(s){
  if(!s) return {};
  if(typeof s === 'object') return s;
  try{return JSON.parse(s);}catch(e){return {};}
}

function route_(action, payload){
  if(action === 'setup' || action === 'setupDatabase' || action === 'configurarBanco' || action === 'configurarBancoGoogle') return setupDatabase(payload || {});
  if(action === 'getDb' || action === 'loadDb' || action === 'carregarBanco' || action === 'carregarGoogle') return getDb();
  if(action === 'saveDb' || action === 'saveDatabase' || action === 'salvarBanco' || action === 'salvarGoogle') return saveDb((payload && payload.db) || payload || {});
  if(action === 'ping') return {message:'pong', version:'5.1.3'};
  throw new Error('Ação não reconhecida: ' + action);
}

function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setupDatabase(payload){
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty(PROP_DB_ID);
  let ss;
  if(id){ try{ ss = SpreadsheetApp.openById(id); }catch(e){ ss = null; } }
  if(!ss){
    ss = SpreadsheetApp.create((payload && payload.name) || 'Banco SDAI Bosch Manager');
    props.setProperty(PROP_DB_ID, ss.getId());
  }
  ensureAllSheets(ss);
  writeConfig(ss, 'databaseId', ss.getId());
  writeConfig(ss, 'databaseUrl', ss.getUrl());
  writeConfig(ss, 'version', '5.1.3');
  writeConfig(ss, 'updatedAt', new Date().toISOString());
  return {spreadsheetId:ss.getId(), url:ss.getUrl(), tables:Object.keys(TABLES)};
}

function getDb(){
  const ss = getSpreadsheet();
  ensureAllSheets(ss);
  return {
    spreadsheetId:ss.getId(),
    url:ss.getUrl(),
    db:{
      empreendimento:{nome:'Empreendimento',cliente:'Cliente'},
      paineis: readSheet(ss,'Paineis'),
      lacos: readSheet(ss,'Lacos'),
      flms: readSheet(ss,'FLMs'),
      portas: readSheet(ss,'Portas'),
      locais: readSheet(ss,'Locais'),
      equipamentos: readSheet(ss,'Equipamentos'),
      falhas: readSheet(ss,'Falhas'),
      planos: readSheet(ss,'Plano_Acao'),
      inconsistencias: [],
      imports: readSheet(ss,'Importacoes')
    }
  };
}

function saveDb(db){
  const ss = getOrCreateSpreadsheet();
  ensureAllSheets(ss);
  writeSheet(ss,'Paineis', db.paineis || []);
  writeSheet(ss,'Lacos', db.lacos || []);
  writeSheet(ss,'FLMs', db.flms || []);
  writeSheet(ss,'Portas', db.portas || []);
  writeSheet(ss,'Locais', db.locais || []);
  writeSheet(ss,'Equipamentos', db.equipamentos || []);
  writeSheet(ss,'Falhas', db.falhas || []);
  writeSheet(ss,'Plano_Acao', db.planos || []);
  writeSheet(ss,'Importacoes', normalizeImports_(db.imports || []));
  appendHistorico(ss, 'sync', 'all', 'saveDb', 'Base sincronizada pelo frontend');
  writeConfig(ss, 'updatedAt', new Date().toISOString());
  return {spreadsheetId:ss.getId(), url:ss.getUrl(), savedAt:new Date().toISOString()};
}

function normalizeImports_(rows){
  return (rows || []).map(x => ({
    id: x.id || Utilities.getUuid(),
    data: x.data || new Date().toISOString(),
    statsJson: x.statsJson || JSON.stringify(x.stats || {}),
    errorsJson: x.errorsJson || JSON.stringify(x.errors || []),
    romannelJson: x.romannelJson || JSON.stringify(x.romannel || {})
  }));
}

function getSpreadsheet(){
  const id = PropertiesService.getScriptProperties().getProperty(PROP_DB_ID);
  if(!id) throw new Error('Banco Google ainda não configurado. Acesse Sistema > Banco de Dados > Configurar Banco Google.');
  return SpreadsheetApp.openById(id);
}
function getOrCreateSpreadsheet(){
  try{return getSpreadsheet();}catch(e){return SpreadsheetApp.openById(setupDatabase({}).spreadsheetId);}
}
function ensureAllSheets(ss){
  Object.keys(TABLES).forEach(name => {
    let sh = ss.getSheetByName(name);
    if(!sh) sh = ss.insertSheet(name);
    const headers = TABLES[name];
    const lastCol = Math.max(headers.length, sh.getLastColumn() || 1);
    const current = sh.getRange(1,1,1,lastCol).getValues()[0].slice(0,headers.length);
    if(current.join('|') !== headers.join('|')){
      sh.clear();
      sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#eaf1f9');
      sh.setFrozenRows(1);
    }
  });
}
function readSheet(ss,name){
  const sh = ss.getSheetByName(name); if(!sh) return [];
  const headers = TABLES[name];
  const last = sh.getLastRow(); if(last < 2) return [];
  const values = sh.getRange(2,1,last-1,headers.length).getValues();
  return values.filter(r => r.some(v => v !== '')).map(row => {
    const o = {};
    headers.forEach((h,i)=> o[h] = row[i]);
    return o;
  });
}
function writeSheet(ss,name,rows){
  const sh = ss.getSheetByName(name); const headers = TABLES[name];
  sh.clear();
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight('bold').setBackground('#eaf1f9');
  sh.setFrozenRows(1);
  if(rows && rows.length){
    const values = rows.map(o => headers.map(h => serializeCell(o[h])));
    sh.getRange(2,1,values.length,headers.length).setValues(values);
  }
  sh.autoResizeColumns(1, headers.length);
}
function serializeCell(v){
  if(v === undefined || v === null) return '';
  if(typeof v === 'object') return JSON.stringify(v);
  return v;
}
function writeConfig(ss,chave,valor){
  const sh = ss.getSheetByName('Configuracoes');
  const data = sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(data[i][0] === chave){ sh.getRange(i+1,2,1,2).setValues([[valor,new Date().toISOString()]]); return; }
  }
  sh.appendRow([chave,valor,new Date().toISOString()]);
}
function appendHistorico(ss, entidade, entidadeId, acao, descricao){
  const email = Session.getActiveUser().getEmail() || 'usuario';
  ss.getSheetByName('Historico').appendRow([Utilities.getUuid(), new Date().toISOString(), email, entidade, entidadeId, acao, descricao]);
}
