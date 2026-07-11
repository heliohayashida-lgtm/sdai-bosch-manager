
// ============================================================================
// Contratos L3A — SDAI Manager  |  Code.gs  v6.33
// Multi-cliente: Sheet Master (Clientes + Usuarios globais) +
//                Sheet por cliente (dados operacionais + CFTV/Acesso/Ambiente)
// ============================================================================

const APP_NAME  = 'Contratos L3A';
const PROP_KEY  = 'SDAI_MANAGER_SPREADSHEET_ID';   // sheet master (global)

// Chave de propriedade para a planilha de um cliente específico
function propKeyCliente_(cid){ return 'SDAI_CLI_' + String(cid).replace(/[^a-zA-Z0-9_]/g,'_'); }

// ── SCHEMA MASTER (Clientes + Usuarios compartilhados) ──────────────────────
const SCHEMA_MASTER = {
  Configuracoes:         ['chave','valor','atualizadoEm'],
  Clientes:              ['id','nome','cnpj','email','tel','endereco','modulos','obs','criadoEm','atualizadoEm'],
  Usuarios:              ['id','nome','email','perfil','senha','ativo','criadoEm'],
  Historico_Global:      ['id','data','usuario','clienteId','entidade','entidadeId','acao','descricao']
};

// ── SCHEMA POR CLIENTE (dados operacionais + novos subsistemas) ───────────────
const SCHEMA_CLIENTE = {
  Configuracoes:         ['chave','valor','atualizadoEm'],
  Paineis:               ['id','nome','modelo','localizacao','obs'],
  Lacos:                 ['id','painelId','nome','piso','sistema','obs'],
  FLMs:                  ['id','painelId','lacoId','endereco','modelo','piso','status','ultimaAlteracao','obs'],
  Portas:                ['id','flmId','numero','localId','ligacao','status','obs'],
  Lojas_Areas:           ['id','nome','nomeOficial','luc','lucAssociado','tipo','tipoLojaBaseLuc',
                          'painelId','lacoId','piso','flmId','portaId','status','statusAssociacao',
                          'origem','origemNome','baseLojaId','nomeOriginalCadastro','chaveLogica',
                          'areaContrato','lucEditadoManual','ultimaAlteracao','ultimaAtualizacao','obs'],
  Equipamentos:          ['id','painelId','lacoId','piso','tipo','endereco','modelo','fabricante',
                          'localId','flmId','portaId','status','ultimaAlteracao','obs'],
  Falhas:                ['id','data','painelId','lacoId','piso','tipo','itemId','itemNome',
                          'localId','status','statusAnterior','responsavel','origem','motivo','obs','resolvidaEm'],
  Plano_Acao:            ['id','falhaId','criadoEm','atualizadoEm','concluidoEm','categoria',
                          'prioridade','responsavel','situacao','prazo','necessitaCompra','material',
                          'justificativa','direcionamento','providencia','painel','laco','piso',
                          'local','item','statusFalha','fotos'],
  Plantas:               ['id','nome','piso','obs','imagemUrl','imagemW','imagemH','criadoEm'],
  Inconsistencias:       ['linha','motivo','registro'],
  Importacoes:           ['id','data','stats','errors','romannel'],
  Historico:             ['id','data','usuario','entidade','entidadeId','acao','descricao'],
  Base_LUC:              ['id','luc','nome','tipo','areaContrato','piso','origem','dataImportacao',
                          'ultimaAtualizacao','statusAssociacao','percentualSimilaridade','localId','observacoes'],
  Conflitos_Associacao:  ['id','lojaCadastrada','lojaCadastradaAtual','lojaBaseLuc','motivo',
                          'percentualSimilaridade','data','localId','baseLojaId','pisoCadastro','pisoBaseLuc'],
  // ── NOVOS SUBSISTEMAS ──────────────────────────────────────────────────────
  CFTV:                  ['id','nome','tipo','local','piso','modelo','ip','status','obs','criadoEm'],
  Acesso_Pontos:         ['id','nome','tipo','local','piso','modelo','status','obs','criadoEm'],
  Ambiente_Equip:        ['id','nome','tipo','local','piso','modelo','status','obs','criadoEm'],
  Notificacoes:          ['id','paraUserId','texto','refView','criadoEm','lidaEm']
};

// Mapeamento sheet → chave no db (cliente)
const MAP_CLIENTE = {
  Paineis:'paineis', Lacos:'lacos', FLMs:'flms', Portas:'portas',
  Lojas_Areas:'locais', Equipamentos:'equipamentos', Falhas:'falhas',
  Plano_Acao:'planos', Plantas:'plantas', Inconsistencias:'inconsistencias',
  Importacoes:'imports', Historico:'historico',
  Base_LUC:'baseLojas', Conflitos_Associacao:'conflitosAssociacao',
  CFTV:'cftv', Acesso_Pontos:'acessoPontos', Ambiente_Equip:'ambienteEquip',
  Notificacoes:'notificacoes'
};

// ── TOKEN DE SEGURANÇA ───────────────────────────────────────────────────────
function getStoredToken_(){
  return PropertiesService.getScriptProperties().getProperty('API_TOKEN') || '';
}
function tokenValido_(t){
  const atual = getStoredToken_();
  if(!atual) return true;
  return String(t||'') === atual;
}

// ── ROTEAMENTO ───────────────────────────────────────────────────────────────
function doGet(e){
  const p = e && e.parameter ? e.parameter : {};
  const callback = p.callback || '';
  console.log('doGet action=%s', p.action||'ping');
  let out;
  try{
    const action = p.action || 'ping';
    if(!tokenValido_(p.token||'')){
      out = {ok:false, error:'Token inválido ou não informado.'};
    }
    else if(action === 'ping')          out = {ok:true, app:APP_NAME, time:new Date().toISOString(), tokenConfigurado:!!getStoredToken_()};
    else if(action === 'setup')         out = setupMaster_();
    else if(action === 'setupDatabase') out = setupMaster_();
    else if(action === 'load')          out = loadDatabase_();           // legado: carrega master sem cliente
    else if(action === 'loadClientes')  out = loadClientes_();
    else if(action === 'loadClienteDb') out = loadClienteDb_(p.clienteId || '');
    else if(action === 'uploadFoto'){
      console.log('uploadFoto via GET. planoId=%s', p.planoId||'');
      return handleUploadFoto_(p);
    }
    else if(action === 'debugFoto')     out = getDiagUpload_();
    else out = {ok:false, error:'Ação GET inválida: '+action};
  }catch(err){
    out = {ok:false, error:String(err && err.message ? err.message : err)};
  }
  const json = JSON.stringify(out);
  if(callback){
    return ContentService.createTextOutput(callback+'('+json+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  let body = {};
  if(e && e.postData && e.postData.contents){
    try{ body = JSON.parse(e.postData.contents); }catch(_){ body = {}; }
  }
  const tokenRecebido = body.token || (e.parameter && e.parameter.token) || '';
  const acaoRecebida  = body.action || (e.parameter && e.parameter.action) || '';

  if(!tokenValido_(tokenRecebido)){
    if(acaoRecebida === 'uploadFoto'){
      const payloadErro = JSON.stringify({type:'fotoUploadResult', ok:false,
        reqId:(e.parameter&&e.parameter.reqId)||'', error:'Token inválido.'});
      return HtmlService.createHtmlOutput('<script>parent.postMessage('+payloadErro+',"*");</script>');
    }
    return ContentService.createTextOutput(
      JSON.stringify({ok:false, error:'Token inválido ou não informado.'})
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if(acaoRecebida === 'uploadFoto'){
    console.log('doPost uploadFoto. planoId=%s', body.planoId||(e.parameter&&e.parameter.planoId)||'');
    return handleUploadFoto_(e.parameter);
  }

  let out;
  try{
    const action = acaoRecebida;
    const db     = body.payload && body.payload.db ? body.payload.db : body.db || {};
    const cid    = body.clienteId || '';

    if(action === 'save'){
      // legado sem clienteId → salva no master como antes
      out = cid ? saveClienteDb_(cid, db) : saveDatabase_(db);
    }
    else if(action === 'saveClientes')    out = saveClientes_(body.clientes || []);
    else if(action === 'saveClienteDb')   out = saveClienteDb_(cid, db);
    else if(action === 'setupClienteDb')  out = setupClienteDb_(cid, body.nomeCliente || 'Cliente');
    else if(action === 'setup' || action === 'setupDatabase') out = setupMaster_();
    else if(action === 'setToken'){
      const novo = String(body.newToken || (e.parameter&&e.parameter.newToken) || '');
      if(novo.length < 8) out = {ok:false, error:'Token precisa ter pelo menos 8 caracteres.'};
      else { PropertiesService.getScriptProperties().setProperty('API_TOKEN', novo); out = {ok:true}; }
    }
    else if(action === 'revokeToken'){
      PropertiesService.getScriptProperties().deleteProperty('API_TOKEN');
      out = {ok:true};
    }
    else out = {ok:false, error:'Ação POST inválida: '+action};
  }catch(err){
    out = {ok:false, error:String(err && err.message ? err.message : err)};
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// ── MASTER (Clientes + Usuarios globais) ─────────────────────────────────────

function setupMaster_(){
  const ss = getOrCreateMaster_();
  ensureSchemaGeneric_(ss, SCHEMA_MASTER);
  PropertiesService.getScriptProperties().setProperty(PROP_KEY, ss.getId());
  return {ok:true, spreadsheetId:ss.getId(), sheetUrl:ss.getUrl(), sheets:Object.keys(SCHEMA_MASTER)};
}

function getOrCreateMaster_(){
  const props = PropertiesService.getScriptProperties();
  const existing = props.getProperty(PROP_KEY);
  if(existing){ try{ return SpreadsheetApp.openById(existing); }catch(e){} }
  const ss = SpreadsheetApp.create('L3A Master — Clientes e Usuários');
  props.setProperty(PROP_KEY, ss.getId());
  return ss;
}

function loadClientes_(){
  const ss = getOrCreateMaster_();
  ensureSchemaGeneric_(ss, SCHEMA_MASTER);
  const clientes = readSheetObjects_(ss.getSheetByName('Clientes'));
  const usuarios = readSheetObjects_(ss.getSheetByName('Usuarios'));
  // Deserializa o campo 'modulos' que foi armazenado como JSON string
  clientes.forEach(c=>{
    if(typeof c.modulos === 'string' && c.modulos){
      try{ c.modulos = JSON.parse(c.modulos); }catch(e){ c.modulos = []; }
    }
    if(!Array.isArray(c.modulos)) c.modulos = [];
  });
  return {ok:true, clientes, usuarios, loadedAt:new Date().toISOString(), masterUrl:ss.getUrl()};
}

function saveClientes_(clientes){
  const ss = getOrCreateMaster_();
  ensureSchemaGeneric_(ss, SCHEMA_MASTER);
  // Serializa modulos[] para JSON string antes de gravar
  const rows = clientes.map(c => Object.assign({}, c, {modulos: JSON.stringify(c.modulos||[])}));
  writeSheetObjects_(ss.getSheetByName('Clientes'), SCHEMA_MASTER.Clientes, rows);
  appendHistoricoGlobal_(ss, '', 'Clientes', '', 'saveClientes', clientes.length+' clientes salvos');
  return {ok:true, savedAt:new Date().toISOString()};
}

// Salva apenas a lista de usuários globais (chamado quando usuário edita perfis)
function saveUsuariosGlobais_(usuarios){
  const ss = getOrCreateMaster_();
  ensureSchemaGeneric_(ss, SCHEMA_MASTER);
  writeSheetObjects_(ss.getSheetByName('Usuarios'), SCHEMA_MASTER.Usuarios, usuarios || []);
  return {ok:true};
}

function appendHistoricoGlobal_(ss, cid, entidade, entidadeId, acao, descricao){
  const sh = ss.getSheetByName('Historico_Global'); if(!sh) return;
  const email = Session.getActiveUser().getEmail() || 'sistema';
  sh.appendRow([Utilities.getUuid(), new Date().toISOString(), email, cid||'', entidade, entidadeId||'', acao, descricao]);
}

// ── POR CLIENTE ──────────────────────────────────────────────────────────────

function getOrCreateClienteSS_(cid, nomeCliente){
  if(!cid) throw new Error('clienteId é obrigatório');
  const props = PropertiesService.getScriptProperties();
  const propKey = propKeyCliente_(cid);
  const existing = props.getProperty(propKey);
  if(existing){ try{ return SpreadsheetApp.openById(existing); }catch(e){} }
  const nome = nomeCliente ? 'L3A — '+nomeCliente : 'L3A Cliente '+cid;
  const ss = SpreadsheetApp.create(nome);
  props.setProperty(propKey, ss.getId());
  return ss;
}

// Cria/garante a planilha do cliente e retorna URL
function setupClienteDb_(cid, nomeCliente){
  if(!cid) return {ok:false, error:'clienteId obrigatório'};
  const ss = getOrCreateClienteSS_(cid, nomeCliente);
  ensureSchemaGeneric_(ss, SCHEMA_CLIENTE);
  PropertiesService.getScriptProperties().setProperty(propKeyCliente_(cid), ss.getId());
  return {ok:true, clienteId:cid, spreadsheetId:ss.getId(), sheetUrl:ss.getUrl(), sheets:Object.keys(SCHEMA_CLIENTE)};
}

function loadClienteDb_(cid){
  if(!cid) return {ok:false, error:'clienteId obrigatório'};
  const ss = getOrCreateClienteSS_(cid);
  ensureSchemaGeneric_(ss, SCHEMA_CLIENTE);
  const db = {
    empreendimento:{nome:'Empreendimento',cliente:'Cliente'},
    config:{appName:'Contratos L3A',subtitle:'SDAI • Contratos • Operação',logoData:''},
    paineis:[],lacos:[],flms:[],portas:[],locais:[],equipamentos:[],falhas:[],planos:[],
    plantas:[],inconsistencias:[],imports:[],historico:[],baseLojas:[],conflitosAssociacao:[],
    cftv:[],acessoPontos:[],ambienteEquip:[],notificacoes:[]
  };
  Object.keys(MAP_CLIENTE).forEach(shName=>{
    const key = MAP_CLIENTE[shName];
    db[key] = readSheetObjects_(ss.getSheetByName(shName));
  });
  const cfgRows = readSheetObjects_(ss.getSheetByName('Configuracoes'));
  cfgRows.forEach(r=>{
    if(r.chave === 'empreendimento'){ try{ db.empreendimento = JSON.parse(r.valor); }catch(e){} }
    if(r.chave === 'config'){         try{ db.config = JSON.parse(r.valor); }catch(e){} }
  });
  return {ok:true, db, clienteId:cid, sheetUrl:ss.getUrl(), spreadsheetId:ss.getId(), loadedAt:new Date().toISOString()};
}

// ── ITEM 9 (controle de concorrência) ────────────────────────────────────────
// Comparação de revisão do lado do SERVIDOR antes de gravar — proteção real contra
// sobrescrita silenciosa entre dois usuários/abas gravando ao mesmo tempo (um check
// só no cliente não adianta, porque os dois clientes calculariam "sem conflito"
// independentemente um do outro). A última revisão conhecida de cada cliente fica em
// ScriptProperties, sob a chave propKeyCliente_(cid)+'_REV'.
//
// LIMITAÇÃO CONHECIDA E ACEITA: o front-end (apiPost, em index.html) envia esta
// gravação com fetch(...,{mode:'no-cors',...}) — o que torna a RESPOSTA desta função
// opaca para o navegador (o JS do cliente não consegue ler o corpo/erro retornado
// aqui). Ou seja: a rejeição abaixo protege os DADOS de verdade (a gravação é
// recusada), mas a mensagem amigável "Outro usuário alterou..." não chega em tempo
// real à tela de quem tentou salvar — quem detecta a divergência, hoje, é a
// conferência pós-sync (verificarSyncSalvou/checksumColecoes) já existente no
// front-end, que compara o que foi enviado com o que ficou gravado e mostra o aviso
// genérico de "checksum divergente". Resolver isso por completo exigiria trocar esse
// endpoint para um fetch com CORS habilitado (fora do escopo desta estabilização —
// risco alto de quebrar o sync que já funciona).
function revisaoConflita_(cid, db){
  const revEnviada = db && db._revision;
  if(revEnviada === undefined || revEnviada === null || revEnviada === '') return null; // cliente antigo: sem _revision, não bloqueia
  const props = PropertiesService.getScriptProperties();
  const chave = propKeyCliente_(cid) + '_REV';
  const revConhecida = props.getProperty(chave);
  if(!revConhecida) return null; // nenhuma revisão registrada ainda: primeira gravação, aceita
  if(String(revConhecida) !== String(revEnviada)){
    return {ok:false, error:'Outro usuário alterou esta base. Atualize os dados antes de salvar.', conflict:true};
  }
  return null;
}
function registrarRevisao_(cid, db){
  try{
    const props = PropertiesService.getScriptProperties();
    const chave = propKeyCliente_(cid) + '_REV';
    const nova = (db && (db._revision !== undefined && db._revision !== null && db._revision !== '')) ? db._revision : '';
    if(nova !== '') props.setProperty(chave, String(nova));
  }catch(e){}
}

function saveClienteDb_(cid, db){
  if(!cid) return {ok:false, error:'clienteId obrigatório'};
  const lock = LockService.getScriptLock();
  try{
    lock.waitLock(10000); // aguarda até 10s por outra gravação em andamento
  }catch(e){
    return {ok:false, error:'Sistema ocupado processando outra gravação simultânea. Tente novamente em alguns segundos.'};
  }
  try{
    // Homologação (FASE 1/9): a checagem de revisão precisa acontecer DEPOIS de adquirir o lock, não
    // antes. Se checasse antes, duas gravações quase simultâneas poderiam ambas passar na checagem
    // (nenhuma das duas ainda registrou a revisão nova) e a segunda, ao finalmente conseguir o lock,
    // sobrescreveria com dados obsoletos mesmo tendo sido "aprovada" — a checagem de conflito perderia
    // sua função sob concorrência real. Com o lock serializando as gravações e a checagem repetida
    // aqui dentro, a segunda chamada só entra na seção crítica depois que a primeira já registrou sua
    // nova revisão (registrarRevisao_, no fim desta função) — então ela corretamente detecta o
    // conflito na sua vez, em vez de sobrescrever silenciosamente.
    const conflito = revisaoConflita_(cid, db);
    if(conflito) return conflito;
    const ss = getOrCreateClienteSS_(cid);
    ensureSchemaGeneric_(ss, SCHEMA_CLIENTE);

    writeSheetObjects_(ss.getSheetByName('Paineis'),             SCHEMA_CLIENTE.Paineis,            db.paineis             || []);
    writeSheetObjects_(ss.getSheetByName('Lacos'),               SCHEMA_CLIENTE.Lacos,              db.lacos               || []);
    writeSheetObjects_(ss.getSheetByName('FLMs'),                SCHEMA_CLIENTE.FLMs,               db.flms                || []);
    writeSheetObjects_(ss.getSheetByName('Portas'),              SCHEMA_CLIENTE.Portas,             db.portas              || []);
    writeSheetObjects_(ss.getSheetByName('Lojas_Areas'),         SCHEMA_CLIENTE.Lojas_Areas,        db.locais              || []);
    writeSheetObjects_(ss.getSheetByName('Equipamentos'),        SCHEMA_CLIENTE.Equipamentos,       db.equipamentos        || []);
    writeSheetObjects_(ss.getSheetByName('Falhas'),              SCHEMA_CLIENTE.Falhas,             db.falhas              || []);
    writeSheetObjects_(ss.getSheetByName('Plano_Acao'),          SCHEMA_CLIENTE.Plano_Acao,         db.planos              || []);
    writeSheetObjects_(ss.getSheetByName('Plantas'),             SCHEMA_CLIENTE.Plantas,            db.plantas             || []);
    writeSheetObjects_(ss.getSheetByName('Inconsistencias'),     SCHEMA_CLIENTE.Inconsistencias,    db.inconsistencias     || []);
    writeSheetObjects_(ss.getSheetByName('Importacoes'),         SCHEMA_CLIENTE.Importacoes,        db.imports             || []);
    writeSheetObjects_(ss.getSheetByName('Base_LUC'),            SCHEMA_CLIENTE.Base_LUC,           db.baseLojas           || []);
    writeSheetObjects_(ss.getSheetByName('Conflitos_Associacao'),SCHEMA_CLIENTE.Conflitos_Associacao,db.conflitosAssociacao|| []);
    writeSheetObjects_(ss.getSheetByName('CFTV'),                SCHEMA_CLIENTE.CFTV,               db.cftv                || []);
    writeSheetObjects_(ss.getSheetByName('Acesso_Pontos'),       SCHEMA_CLIENTE.Acesso_Pontos,      db.acessoPontos        || []);
    writeSheetObjects_(ss.getSheetByName('Ambiente_Equip'),      SCHEMA_CLIENTE.Ambiente_Equip,     db.ambienteEquip       || []);
    writeSheetObjects_(ss.getSheetByName('Notificacoes'),        SCHEMA_CLIENTE.Notificacoes,       db.notificacoes        || []);

    // Historico: apenas append (não sobrescreve — preserva auditoria)
    appendHistoricoCliente_(ss, 'Sistema', '', 'sync', 'Base sincronizada pelo SDAI Manager');

    writeConfigCliente_(ss, db);
    registrarRevisao_(cid, db);
    return {ok:true, clienteId:cid, savedAt:new Date().toISOString(), sheetUrl:ss.getUrl()};
  } finally {
    lock.releaseLock();
  }
}

function appendHistoricoCliente_(ss, entidade, entidadeId, acao, descricao){
  const sh = ss.getSheetByName('Historico'); if(!sh) return;
  const email = Session.getActiveUser().getEmail() || 'sistema';
  sh.appendRow([Utilities.getUuid(), new Date().toISOString(), email, entidade, entidadeId||'', acao, descricao]);
}

function writeConfigCliente_(ss, db){
  const sh = ss.getSheetByName('Configuracoes'); if(!sh) return;
  const now = new Date().toISOString();
  const rows = [
    ['versao','6.33',now],
    ['atualizadoEm',now,now],
    ['empreendimento',JSON.stringify(db.empreendimento || {}),now],
    ['config',JSON.stringify(db.config || {}),now]
  ];
  sh.clear();
  sh.getRange(1,1,1,SCHEMA_CLIENTE.Configuracoes.length).setValues([SCHEMA_CLIENTE.Configuracoes]);
  sh.getRange(2,1,rows.length,SCHEMA_CLIENTE.Configuracoes.length).setValues(rows);
}

// ── LEGADO (sem cliente — mantido para compatibilidade) ──────────────────────
// Usado quando nenhum cliente está selecionado (modo single-tenant antigo).

const SCHEMA_LEGADO = Object.assign({}, SCHEMA_CLIENTE, {
  // Adiciona abas que o master precisa mas o cliente não tem
});
const MAP_LEGADO = Object.assign({}, MAP_CLIENTE, { Usuarios:'usuarios' });

function loadDatabase_(){
  const ss = getOrCreateMaster_();
  ensureSchemaGeneric_(ss, SCHEMA_MASTER);
  // Tenta carregar do master como legado (mantém compatibilidade com implantações antigas)
  const db = {
    empreendimento:{nome:'Empreendimento',cliente:'Cliente'},
    config:{appName:'Contratos L3A',subtitle:'SDAI • Contratos • Operação',logoData:''},
    usuarios:[], paineis:[], lacos:[], flms:[], portas:[], locais:[], equipamentos:[],
    falhas:[], planos:[], plantas:[], inconsistencias:[], imports:[],
    baseLojas:[], conflitosAssociacao:[], cftv:[], acessoPontos:[], ambienteEquip:[], notificacoes:[]
  };
  // Usuários sempre vêm do master
  db.usuarios = readSheetObjects_(ss.getSheetByName('Usuarios'));
  // Clientes
  const cliRows = readSheetObjects_(ss.getSheetByName('Clientes'));
  cliRows.forEach(c=>{ if(typeof c.modulos==='string'){ try{c.modulos=JSON.parse(c.modulos)}catch(e){c.modulos=[]} } });
  const cfgRows = readSheetObjects_(ss.getSheetByName('Configuracoes'));
  cfgRows.forEach(r=>{
    if(r.chave==='config'){try{db.config=JSON.parse(r.valor)}catch(e){}}
  });
  return {ok:true, db, clientes:cliRows, sheetUrl:ss.getUrl(), spreadsheetId:ss.getId(), loadedAt:new Date().toISOString()};
}

function saveDatabase_(db){
  // Legado: salva apenas usuários e configuração no master
  // Item 9: mesma proteção de revisão do saveClienteDb_, chave própria (base legada sem clienteId).
  const revEnviada = db && db._revision;
  const lock = LockService.getScriptLock();
  try{
    lock.waitLock(10000); // aguarda até 10s por outra gravação em andamento
  }catch(e){
    return {ok:false, error:'Sistema ocupado processando outra gravação simultânea. Tente novamente em alguns segundos.'};
  }
  try{
    // Homologação (FASE 1/9): checagem de revisão movida para DENTRO do lock (mesmo motivo
    // documentado em saveClienteDb_) — checar antes do lock permitiria que duas gravações quase
    // simultâneas passassem ambas na checagem antes de qualquer uma registrar sua revisão nova.
    if(revEnviada !== undefined && revEnviada !== null && revEnviada !== ''){
      const props = PropertiesService.getScriptProperties();
      const revConhecida = props.getProperty('LEGADO_MASTER_REV');
      if(revConhecida && String(revConhecida) !== String(revEnviada)){
        return {ok:false, error:'Outro usuário alterou esta base. Atualize os dados antes de salvar.', conflict:true};
      }
    }
    const ss = getOrCreateMaster_();
    ensureSchemaGeneric_(ss, SCHEMA_MASTER);
    if(db.usuarios && db.usuarios.length){
      writeSheetObjects_(ss.getSheetByName('Usuarios'), SCHEMA_MASTER.Usuarios, db.usuarios);
    }
    appendHistoricoGlobal_(ss, '', 'Sistema', '', 'sync', 'Sync legado (sem cliente)');
    try{
      if(revEnviada !== undefined && revEnviada !== null && revEnviada !== ''){
        PropertiesService.getScriptProperties().setProperty('LEGADO_MASTER_REV', String(revEnviada));
      }
    }catch(e){}
    return {ok:true, savedAt:new Date().toISOString(), sheetUrl:ss.getUrl()};
  } finally {
    lock.releaseLock();
  }
}

// ── UPLOAD DE FOTOS (Google Drive) ───────────────────────────────────────────

function registrarDiagUpload_(linha){
  try{
    const props = PropertiesService.getScriptProperties();
    let log = props.getProperty('ULTIMO_UPLOAD_LOG') || '';
    const hora = Utilities.formatDate(new Date(), Session.getScriptTimeZone()||'GMT', 'HH:mm:ss');
    log = (hora+' — '+linha+'\n'+log).split('\n').slice(0,40).join('\n');
    props.setProperty('ULTIMO_UPLOAD_LOG', log);
  }catch(_e){}
}

function handleUploadFoto_(p){
  const reqId = p.reqId || '';
  const planoId = p.planoId || '';
  let contaExecutando = '';
  try{ contaExecutando = Session.getEffectiveUser().getEmail() || ''; }catch(_e){}
  console.log('handleUploadFoto_ iniciado. reqId=%s, planoId=%s, filename=%s, conta=%s',
    reqId, planoId, p.filename||'(sem nome)', contaExecutando);
  registrarDiagUpload_('Iniciado. planoId='+planoId+', filename='+(p.filename||'(sem nome)')+', conta='+contaExecutando);
  try{
    const filename = p.filename || ('foto_'+new Date().getTime()+'.jpg');
    const dataUrl  = p.imageData || '';
    if(!dataUrl){
      registrarDiagUpload_('ERRO: imageData VAZIO.');
      throw new Error('imageData vazio — nenhum dado de imagem foi recebido pelo servidor.');
    }
    registrarDiagUpload_('imageData recebido, tamanho='+dataUrl.length);
    const base64 = dataUrl.indexOf(',') > -1 ? dataUrl.split(',')[1] : dataUrl;
    const bytes  = Utilities.base64Decode(base64);
    registrarDiagUpload_('Imagem decodificada: '+bytes.length+' bytes.');
    const blob   = Utilities.newBlob(bytes, 'image/jpeg', filename);
    const folder = getOrCreateFotosFolder_();
    registrarDiagUpload_('Pasta OK: "'+folder.getName()+'" (id='+folder.getId()+').');
    const file   = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    registrarDiagUpload_('SUCESSO: id='+fileId+', nome='+filename);
    const url = 'https://drive.google.com/thumbnail?id='+fileId+'&sz=w800';
    const payload = JSON.stringify({type:'fotoUploadResult',ok:true,reqId,planoId,fileId,url,conta:contaExecutando,pastaUrl:folder.getUrl()});
    return HtmlService.createHtmlOutput('<script>parent.postMessage('+payload+',"*");</script>');
  }catch(err){
    const msg = String(err && err.message ? err.message : err);
    registrarDiagUpload_('ERRO: '+msg);
    const payload = JSON.stringify({type:'fotoUploadResult',ok:false,reqId,planoId,error:msg,conta:contaExecutando});
    return HtmlService.createHtmlOutput('<script>parent.postMessage('+payload+',"*");</script>');
  }
}

function getDiagUpload_(){
  return {ok:true, log: PropertiesService.getScriptProperties().getProperty('ULTIMO_UPLOAD_LOG') || '(nenhum registro ainda)'};
}

function autorizarDrive(){
  const folder = getOrCreateFotosFolder_();
  console.log('Autorização OK. Pasta: %s (%s)', folder.getName(), folder.getUrl());
  return folder.getUrl();
}

function getOrCreateFotosFolder_(){
  const name = 'SDAI Manager - Fotos Plano de Acao';
  const it = DriveApp.getFoldersByName(name);
  if(it.hasNext()) return it.next();
  return DriveApp.createFolder(name);
}

// ── HELPERS DE SCHEMA ────────────────────────────────────────────────────────

// Não-destrutivo: cria aba se não existe; acrescenta colunas que faltam.
function ensureSchemaGeneric_(ss, schema){
  Object.keys(schema).forEach(name=>{
    const header = schema[name];
    let sh = ss.getSheetByName(name);
    if(!sh){
      sh = ss.insertSheet(name);
      sh.getRange(1,1,1,header.length).setValues([header]);
      sh.setFrozenRows(1);
      return;
    }
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const atual   = sh.getRange(1,1,1,lastCol).getValues()[0].map(String).filter(String);
    const falt    = header.filter(h => atual.indexOf(h) === -1);
    if(falt.length) sh.getRange(1, atual.length+1, 1, falt.length).setValues([falt]);
    if(sh.getFrozenRows() < 1) sh.setFrozenRows(1);
  });
  // Remove aba padrão vazia se existir
  const def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1') || ss.getSheetByName('Planilha1');
  if(def && ss.getSheets().length > 1){ try{ ss.deleteSheet(def); }catch(e){} }
}

// Alias legado usado por setupMaster_
function setupDatabase_() { return setupMaster_(); }
function getOrCreateSpreadsheet_() { return getOrCreateMaster_(); }
function ensureSchema_(ss){ ensureSchemaGeneric_(ss, SCHEMA_MASTER); }

// ── LEITURA / ESCRITA GENÉRICA ────────────────────────────────────────────────

function readSheetObjects_(sh){
  if(!sh) return [];
  const values = sh.getDataRange().getValues();
  if(values.length < 2) return [];
  const header = values[0].map(String);
  return values.slice(1).filter(row => row.some(v => v !== '')).map(row=>{
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
  if(!sh) return;
  sh.clear();
  sh.getRange(1,1,1,header.length).setValues([header]);
  sh.setFrozenRows(1);
  if(!rows || !rows.length) return;
  const values = rows.map(o => header.map(h=>{
    const v = o && o[h] !== undefined ? o[h] : '';
    if(v && typeof v === 'object') return JSON.stringify(v);
    return v;
  }));
  sh.getRange(2, 1, values.length, header.length).setValues(values);
  try{ sh.autoResizeColumns(1, header.length); }catch(e){}
}

// ── FUNÇÃO DE TESTE MANUAL ────────────────────────────────────────────────────
// Execute no editor do Apps Script para testar setup sem precisar do front-end.
function testarSetup(){
  const res = setupMaster_();
  console.log('Setup master:', JSON.stringify(res));
}

function testarSetupCliente(){
  // Substitua pelo ID real de um cliente cadastrado no front-end
  const res = setupClienteDb_('cliente-teste-001', 'Shopping Pantanal');
  console.log('Setup cliente:', JSON.stringify(res));
}
