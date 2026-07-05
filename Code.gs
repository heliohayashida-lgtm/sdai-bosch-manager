
const APP_NAME = 'Contratos L3A';
const PROP_KEY = 'SDAI_MANAGER_SPREADSHEET_ID';

const SCHEMA = {
  Configuracoes: ['chave','valor','atualizadoEm'],
  Paineis: ['id','nome','modelo','localizacao','obs'],
  Lacos: ['id','painelId','nome','piso','obs'],
  FLMs: ['id','painelId','lacoId','endereco','modelo','piso','status','ultimaAlteracao','obs'],
  Portas: ['id','flmId','numero','localId','ligacao','obs'],
  // ADICIONADO: colunas novas do módulo LUC/Loja (nomeOficial, luc, associação, etc).
  // Colunas antigas mantidas nas mesmas posições iniciais para compatibilidade.
  Lojas_Areas: ['id','nome','nomeOficial','luc','lucAssociado','tipo','tipoLojaBaseLuc','painelId','lacoId','piso','flmId','portaId','status','statusAssociacao','origem','origemNome','baseLojaId','nomeOriginalCadastro','chaveLogica','areaContrato','lucEditadoManual','ultimaAlteracao','ultimaAtualizacao','obs'],
  Equipamentos: ['id','painelId','lacoId','piso','tipo','endereco','modelo','fabricante','localId','flmId','portaId','status','ultimaAlteracao','obs'],
  Falhas: ['id','data','painelId','lacoId','piso','tipo','itemId','itemNome','localId','status','statusAnterior','responsavel','origem','motivo','obs','resolvidaEm'],
  Plano_Acao: ['id','falhaId','criadoEm','atualizadoEm','concluidoEm','categoria','prioridade','responsavel','situacao','prazo','necessitaCompra','material','justificativa','providencia','painel','laco','piso','local','item','statusFalha'],
  Inconsistencias: ['linha','motivo','registro'],
  Importacoes: ['id','data','stats','errors','romannel'],
  Usuarios: ['id','nome','email','perfil','senha','ativo','criadoEm'],
  Historico: ['id','data','usuario','entidade','entidadeId','acao','descricao'],
  // ADICIONADO: cadastro puro importado da Base LUC (sem dados técnicos/dispositivos).
  Base_LUC: ['id','luc','nome','tipo','areaContrato','piso','origem','dataImportacao','ultimaAtualizacao','statusAssociacao','percentualSimilaridade','localId','observacoes'],
  // ADICIONADO: fila de conflitos de associação automática LUC x Loja técnica.
  Conflitos_Associacao: ['id','lojaCadastrada','lojaCadastradaAtual','lojaBaseLuc','motivo','percentualSimilaridade','data','localId','baseLojaId','pisoCadastro','pisoBaseLuc']
};

const MAP = {
  Paineis:'paineis', Lacos:'lacos', FLMs:'flms', Portas:'portas', Lojas_Areas:'locais', Equipamentos:'equipamentos', Falhas:'falhas', Plano_Acao:'planos', Inconsistencias:'inconsistencias', Importacoes:'imports', Usuarios:'usuarios',
  // ADICIONADO
  Base_LUC:'baseLojas', Conflitos_Associacao:'conflitosAssociacao'
};

function doGet(e){
  const p = e && e.parameter ? e.parameter : {};
  const callback = p.callback || '';
  let out;
  try{
    const action = p.action || 'ping';
    if(action === 'setup' || action === 'setupDatabase') out = setupDatabase_();
    else if(action === 'load') out = loadDatabase_();
    else if(action === 'ping') out = {ok:true, app:APP_NAME, time:new Date().toISOString()};
    else out = {ok:false, error:'Ação GET inválida: '+action};
  }catch(err){
    out = {ok:false, error:String(err && err.message ? err.message : err)};
  }
  const json = JSON.stringify(out);
  if(callback){
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  let out;
  try{
    let body = {};
    if(e && e.postData && e.postData.contents){
      try{ body = JSON.parse(e.postData.contents); }catch(_){ body = {}; }
    }
    const action = body.action || (e.parameter && e.parameter.action) || '';
    if(action === 'save') out = saveDatabase_(body.payload && body.payload.db ? body.payload.db : body.db || {});
    else if(action === 'setup' || action === 'setupDatabase') out = setupDatabase_();
    else out = {ok:false, error:'Ação POST inválida: '+action};
  }catch(err){
    out = {ok:false, error:String(err && err.message ? err.message : err)};
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function setupDatabase_(){
  const ss = getOrCreateSpreadsheet_();
  ensureSchema_(ss);
  PropertiesService.getScriptProperties().setProperty(PROP_KEY, ss.getId());
  return {ok:true, spreadsheetId:ss.getId(), sheetUrl:ss.getUrl(), sheets:Object.keys(SCHEMA)};
}

function getOrCreateSpreadsheet_(){
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(PROP_KEY);
  if(existing){
    try{return SpreadsheetApp.openById(existing)}catch(e){}
  }
  const ss = SpreadsheetApp.create('Banco SDAI Bosch Manager');
  props.setProperty(PROP_KEY, ss.getId());
  return ss;
}

function ensureSchema_(ss){
  // NÃO-DESTRUTIVO: nunca usa sh.clear(). Se a aba não existe, cria com o cabeçalho.
  // Se já existe mas faltam colunas novas do SCHEMA, apenas ACRESCENTA essas colunas
  // no final, sem apagar nem reordenar nada que já estava lá. Isso evita perda de
  // dados em qualquer futura evolução de schema (novos campos, novas abas).
  Object.keys(SCHEMA).forEach(name=>{
    const header = SCHEMA[name];
    let sh = ss.getSheetByName(name);
    if(!sh){
      sh = ss.insertSheet(name);
      sh.getRange(1,1,1,header.length).setValues([header]);
      sh.setFrozenRows(1);
      return;
    }
    const lastCol = Math.max(sh.getLastColumn(),1);
    const currentHeader = sh.getRange(1,1,1,lastCol).getValues()[0].map(String).filter(String);
    const faltantes = header.filter(h=>currentHeader.indexOf(h)===-1);
    if(faltantes.length){
      sh.getRange(1,currentHeader.length+1,1,faltantes.length).setValues([faltantes]);
    }
    if(sh.getFrozenRows()<1) sh.setFrozenRows(1);
  });
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1') || ss.getSheetByName('Planilha1');
  if(defaultSheet && Object.keys(SCHEMA).length > 1){
    try{ ss.deleteSheet(defaultSheet); }catch(e){}
  }
}

function loadDatabase_(){
  const ss = getOrCreateSpreadsheet_();
  ensureSchema_(ss);
  // ADICIONADO: baseLojas e conflitosAssociacao nos defaults
  const db = {empreendimento:{nome:'Empreendimento',cliente:'Cliente'},config:{appName:'Contratos L3A',subtitle:'SDAI • Contratos • Operação',logoData:''},usuarios:[],paineis:[],lacos:[],flms:[],portas:[],locais:[],equipamentos:[],falhas:[],planos:[],inconsistencias:[],imports:[],baseLojas:[],conflitosAssociacao:[]};
  Object.keys(MAP).forEach(sheetName=>{
    const key = MAP[sheetName];
    db[key] = readSheetObjects_(ss.getSheetByName(sheetName));
  });
  const cfgRows = readSheetObjects_(ss.getSheetByName('Configuracoes'));
  cfgRows.forEach(r=>{
    if(r.chave === 'empreendimento'){ try{ db.empreendimento = JSON.parse(r.valor); }catch(e){} }
    if(r.chave === 'config'){ try{ db.config = JSON.parse(r.valor); }catch(e){} }
  });
  return {ok:true, db:db, sheetUrl:ss.getUrl(), spreadsheetId:ss.getId(), loadedAt:new Date().toISOString()};
}

function saveDatabase_(db){
  const ss = getOrCreateSpreadsheet_();
  ensureSchema_(ss);
  writeSheetObjects_(ss.getSheetByName('Paineis'), SCHEMA.Paineis, db.paineis || []);
  writeSheetObjects_(ss.getSheetByName('Lacos'), SCHEMA.Lacos, db.lacos || []);
  writeSheetObjects_(ss.getSheetByName('FLMs'), SCHEMA.FLMs, db.flms || []);
  writeSheetObjects_(ss.getSheetByName('Portas'), SCHEMA.Portas, db.portas || []);
  writeSheetObjects_(ss.getSheetByName('Lojas_Areas'), SCHEMA.Lojas_Areas, db.locais || []);
  writeSheetObjects_(ss.getSheetByName('Equipamentos'), SCHEMA.Equipamentos, db.equipamentos || []);
  writeSheetObjects_(ss.getSheetByName('Falhas'), SCHEMA.Falhas, db.falhas || []);
  writeSheetObjects_(ss.getSheetByName('Plano_Acao'), SCHEMA.Plano_Acao, db.planos || []);
  writeSheetObjects_(ss.getSheetByName('Inconsistencias'), SCHEMA.Inconsistencias, db.inconsistencias || []);
  writeSheetObjects_(ss.getSheetByName('Importacoes'), SCHEMA.Importacoes, db.imports || []);
  writeSheetObjects_(ss.getSheetByName('Usuarios'), SCHEMA.Usuarios, db.usuarios || []);
  // ADICIONADO: persistência de Base_LUC e Conflitos_Associacao
  writeSheetObjects_(ss.getSheetByName('Base_LUC'), SCHEMA.Base_LUC, db.baseLojas || []);
  writeSheetObjects_(ss.getSheetByName('Conflitos_Associacao'), SCHEMA.Conflitos_Associacao, db.conflitosAssociacao || []);
  writeConfig_(ss, db);
  appendHistorico_(ss, 'Sistema', '', 'sync', 'Base sincronizada pelo SDAI Manager');
  return {ok:true, savedAt:new Date().toISOString(), sheetUrl:ss.getUrl()};
}

function readSheetObjects_(sh){
  if(!sh) return [];
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return [];
  const header = values[0].map(String);
  return values.slice(1).filter(row=>row.some(v=>v !== '')).map(row=>{
    const o = {};
    header.forEach((h,i)=>{
      let v = row[i];
      if(typeof v === 'string' && (v.startsWith('{') || v.startsWith('['))){
        try{ v = JSON.parse(v); }catch(e){}
      }
      o[h] = v;
    });
    return o;
  });
}

function writeSheetObjects_(sh, header, rows){
  sh.clear();
  sh.getRange(1,1,1,header.length).setValues([header]);
  sh.setFrozenRows(1);
  if(!rows || !rows.length) return;
  const values = rows.map(o=>header.map(h=>{
    const v = o && o[h] !== undefined ? o[h] : '';
    if(v && typeof v === 'object') return JSON.stringify(v);
    return v;
  }));
  sh.getRange(2,1,values.length,header.length).setValues(values);
  try{ sh.autoResizeColumns(1, header.length); }catch(e){}
}

function writeConfig_(ss, db){
  const sh = ss.getSheetByName('Configuracoes');
  const rows = [
    ['versao','6.0.0',new Date().toISOString()],
    ['atualizadoEm',new Date().toISOString(),new Date().toISOString()],
    ['empreendimento',JSON.stringify(db.empreendimento || {}),new Date().toISOString()],
    ['config',JSON.stringify(db.config || {}),new Date().toISOString()]
  ];
  sh.clear();
  sh.getRange(1,1,1,SCHEMA.Configuracoes.length).setValues([SCHEMA.Configuracoes]);
  sh.getRange(2,1,rows.length,SCHEMA.Configuracoes.length).setValues(rows);
}

function appendHistorico_(ss, entidade, entidadeId, acao, descricao){
  const sh = ss.getSheetByName('Historico');
  if(!sh) return;
  const email = Session.getActiveUser().getEmail() || 'usuario';
  sh.appendRow([Utilities.getUuid(), new Date().toISOString(), email, entidade, entidadeId, acao, descricao]);
}
