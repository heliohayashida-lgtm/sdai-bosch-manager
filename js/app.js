const CATS = ['Falhas de Comunicação','Correção de Cadastros','Integração CO2','Retestes nos módulos SDAI','Lojas já regularizadas'];

let lojas = [], equipamentos = [], historico = [], plano = [], servicos = [], atas = [];
let editingLojaId = null, editingEquipId = null;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const norm = (s) => (s||'').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const nowStamp = () => new Date().toLocaleString('pt-BR');

// ---------- STORAGE ----------
let lastFailedSave = null;
function showSaveBanner(show, detail){
  document.getElementById('saveBanner').classList.toggle('show', show);
  const d = document.getElementById('saveBannerDetail'); if(d) d.textContent = detail || '';
}
async function storageGet(key){
  try{ const r = await window.storage.get(key,false); return r ? JSON.parse(r.value) : null; }catch(e){ return null; }
}
async function storageSet(key, val, attempt=0){
  try{ await window.storage.set(key, JSON.stringify(val), false); lastFailedSave=null; showSaveBanner(false); return true; }
  catch(e){
    console.error('storage error', key, e);
    if(attempt<2){ await new Promise(r=>setTimeout(r,500*(attempt+1))); return storageSet(key,val,attempt+1); }
    lastFailedSave = {key,val};
    showSaveBanner(true, (e&&(e.message||e.toString()))+' · '+key);
    return false;
  }
}
document.getElementById('retrySave').addEventListener('click', async ()=>{
  if(lastFailedSave){ await storageSet(lastFailedSave.key, lastFailedSave.val); } else { showSaveBanner(false); }
});

async function loadAll(){
  lojas = await storageGet('controle:lojas');
  if(lojas === null){
    const legacy = await storageGet('controle:cadastro') || [];
    lojas = legacy.map(l => ({ id: l.id || uid(), nome: l.loja, numero:'', piso:'', setor:'', laco: l.laco||'', modulo: l.endereco||'', responsavel:'', telefone:'', sistema:'SDAI', status:'Ativo', observacoes:'', criadoEm: nowStamp(), atualizadoEm: nowStamp() }));
  }
  equipamentos = await storageGet('controle:equipamentos') || [];
  historico = await storageGet('controle:historico') || [];
  plano = await storageGet('controle:plano') || [];
  servicos = await storageGet('controle:servicos') || [];
  atas = await storageGet('controle:atas') || [];
}
const saveLojas = () => storageSet('controle:lojas', lojas);
const saveEquip = () => storageSet('controle:equipamentos', equipamentos);
const saveHist = () => storageSet('controle:historico', historico);
const savePlano = () => storageSet('controle:plano', plano);
const saveServicos = () => storageSet('controle:servicos', servicos);
const saveAtas = () => storageSet('controle:atas', atas);

function logHist(entidade, entidadeId, acao, detalhes){
  historico.push({ id:uid(), entidade, entidadeId, acao, detalhes, dataHora: nowStamp() });
  if(historico.length > 500) historico = historico.slice(-500);
  saveHist();
}

// ---------- SORT ----------
function pisoKey(p){ const n = parseInt((p||'').toString().replace(/\D/g,'')); return isNaN(n) ? 9999 : n; }
function sortLojas(){
  lojas.sort((a,b)=> pisoKey(a.piso)-pisoKey(b.piso) || (a.nome||'').localeCompare(b.nome||'','pt-BR') || (a.laco||'').localeCompare(b.laco||'','pt-BR'));
}
function sortEquip(){
  const lojaMap = Object.fromEntries(lojas.map(l=>[l.id,l]));
  equipamentos.sort((a,b)=>{
    const la = lojaMap[a.lojaId] || {}, lb = lojaMap[b.lojaId] || {};
    return pisoKey(la.piso)-pisoKey(lb.piso) || (la.nome||'').localeCompare(lb.nome||'','pt-BR')
      || (a.laco||'').localeCompare(b.laco||'','pt-BR') || (parseInt(a.endereco)||0)-(parseInt(b.endereco)||0);
  });
}

// ---------- TABS ----------
document.querySelectorAll('footer.tabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('footer.tabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('section.panel').forEach(p=>p.classList.remove('active'));
    document.getElementById('tab-'+btn.dataset.tab).classList.add('active');
  });
});
function subToggle(btnOnId, btnOffIds, wrapOnId, wrapOffIds){
  document.getElementById(btnOnId).classList.add('active');
  btnOffIds.forEach(id=>document.getElementById(id).classList.remove('active'));
  document.getElementById(wrapOnId).style.display='block';
  wrapOffIds.forEach(id=>document.getElementById(id).style.display='none');
}
document.getElementById('btnLojas').addEventListener('click', ()=> subToggle('btnLojas',['btnEquip','btnHist'],'lojasWrap',['equipWrap','histWrap']));
document.getElementById('btnEquip').addEventListener('click', ()=>{ subToggle('btnEquip',['btnLojas','btnHist'],'equipWrap',['lojasWrap','histWrap']); populateLojaSelects(); });
document.getElementById('btnHist').addEventListener('click', ()=>{ subToggle('btnHist',['btnLojas','btnEquip'],'histWrap',['lojasWrap','equipWrap']); renderHistorico(); });
document.getElementById('btnServ').addEventListener('click', ()=> subToggle('btnServ',['btnAtas'],'servWrap',['ataWrap']));
document.getElementById('btnAtas').addEventListener('click', ()=> subToggle('btnAtas',['btnServ'],'ataWrap',['servWrap']));

// ---------- KPIs ----------
function renderKpis(){
  const abertos = plano.filter(p=>!p.confirmado).length;
  const grid = document.getElementById('kpiGrid');
  grid.innerHTML = `
    <div class="kpi"><div class="num">${lojas.length}</div><div class="lbl">Lojas cadastradas</div></div>
    <div class="kpi"><div class="num">${equipamentos.length}</div><div class="lbl">Equipamentos</div></div>
    <div class="kpi"><div class="num">${abertos}</div><div class="lbl">Itens pendentes</div></div>
    <div class="kpi"><div class="num">${servicos.length}</div><div class="lbl">Serviços registrados</div></div>`;
}

// ================= LOJAS =================
function populateFiltroSelects(){
  const pisos = [...new Set(lojas.map(l=>l.piso).filter(Boolean))].sort();
  const lacos = [...new Set(lojas.map(l=>l.laco).filter(Boolean))].sort();
  const fp = document.getElementById('filtroPiso'); const cur1 = fp.value;
  fp.innerHTML = '<option value="">Todos os pisos</option>' + pisos.map(p=>`<option ${p===cur1?'selected':''}>${p}</option>`).join('');
  const fl = document.getElementById('filtroLaco'); const cur2 = fl.value;
  fl.innerHTML = '<option value="">Todos os laços</option>' + lacos.map(l=>`<option ${l===cur2?'selected':''}>${l}</option>`).join('');
}
function populateLojaSelects(){
  const opts = lojas.map(l=>`<option value="${l.id}">${l.nome}${l.piso?' · '+l.piso:''}</option>`).join('');
  const sel = document.getElementById('fEquipLoja'); const cur = sel.value;
  sel.innerHTML = opts || '<option value="">Cadastre uma loja primeiro</option>';
  if(cur) sel.value = cur;
  const fsel = document.getElementById('filtroEquipLoja'); const curF = fsel.value;
  fsel.innerHTML = '<option value="">Todas as lojas</option>' + lojas.map(l=>`<option value="${l.id}">${l.nome}</option>`).join('');
  fsel.value = curF;
}

function renderLojas(){
  populateFiltroSelects();
  const busca = norm(document.getElementById('lojaBusca').value);
  const fPiso = document.getElementById('filtroPiso').value;
  const fLaco = document.getElementById('filtroLaco').value;
  const fStatus = document.getElementById('filtroStatus').value;
  sortLojas();
  const filtered = lojas.filter(l=>{
    if(fPiso && l.piso!==fPiso) return false;
    if(fLaco && l.laco!==fLaco) return false;
    if(fStatus && l.status!==fStatus) return false;
    if(busca && !norm(`${l.nome} ${l.numero} ${l.responsavel} ${l.setor}`).includes(busca)) return false;
    return true;
  });
  document.getElementById('lojasCount').textContent = `(${filtered.length}/${lojas.length})`;

  let html = '', lastPiso = null;
  filtered.forEach(l=>{
    if(l.piso !== lastPiso){ html += `<div class="piso-group"><h4>${l.piso || 'Sem piso definido'}</h4></div>`; lastPiso = l.piso; }
    const statusTag = l.status==='Ativo' ? 'on' : l.status==='Em obras' ? 'warn' : 'off';
    html += `<div class="list-item">
      <div class="actions"><button class="edit" data-id="${l.id}">Editar</button><button class="del" data-id="${l.id}">Excluir</button></div>
      <div class="title">${l.nome} ${l.numero?'· '+l.numero:''}</div>
      <div class="meta"><span class="tag ${statusTag}">${l.status}</span>${l.laco||'sem laço'} · Módulo ${l.modulo||'—'} ${l.setor?'· '+l.setor:''}</div>
      ${l.responsavel ? `<div class="meta">Resp: ${l.responsavel} ${l.telefone?'· '+l.telefone:''}</div>` : ''}
    </div>`;
  });
  document.getElementById('lojasList').innerHTML = html || '<div class="hint">Nenhuma loja encontrada.</div>';

  document.querySelectorAll('#lojasList .edit').forEach(b=>b.addEventListener('click', e=>startEditLoja(e.target.dataset.id)));
  document.querySelectorAll('#lojasList .del').forEach(b=>b.addEventListener('click', e=>deleteLoja(e.target.dataset.id)));
}
['lojaBusca'].forEach(id=>document.getElementById(id).addEventListener('input', renderLojas));
['filtroPiso','filtroLaco','filtroStatus'].forEach(id=>document.getElementById(id).addEventListener('change', renderLojas));

function lojaFormValues(){
  return {
    nome: document.getElementById('fLojaNome').value.trim(),
    numero: document.getElementById('fLojaNumero').value.trim(),
    piso: document.getElementById('fLojaPiso').value.trim(),
    setor: document.getElementById('fLojaSetor').value.trim(),
    laco: document.getElementById('fLojaLaco').value.trim(),
    modulo: document.getElementById('fLojaModulo').value.trim(),
    responsavel: document.getElementById('fLojaResponsavel').value.trim(),
    telefone: document.getElementById('fLojaTelefone').value.trim(),
    sistema: document.getElementById('fLojaSistema').value,
    status: document.getElementById('fLojaStatus').value,
    observacoes: document.getElementById('fLojaObs').value.trim(),
  };
}
function clearLojaForm(){
  ['fLojaNome','fLojaNumero','fLojaPiso','fLojaSetor','fLojaLaco','fLojaModulo','fLojaResponsavel','fLojaTelefone','fLojaObs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fLojaSistema').value='SDAI'; document.getElementById('fLojaStatus').value='Ativo';
  editingLojaId = null;
  document.getElementById('cancelEditLoja').style.display='none';
  document.getElementById('saveLoja').textContent = '+ Adicionar loja';
}
function startEditLoja(id){
  const l = lojas.find(x=>x.id===id); if(!l) return;
  document.getElementById('fLojaNome').value = l.nome;
  document.getElementById('fLojaNumero').value = l.numero;
  document.getElementById('fLojaPiso').value = l.piso;
  document.getElementById('fLojaSetor').value = l.setor;
  document.getElementById('fLojaLaco').value = l.laco;
  document.getElementById('fLojaModulo').value = l.modulo;
  document.getElementById('fLojaResponsavel').value = l.responsavel;
  document.getElementById('fLojaTelefone').value = l.telefone;
  document.getElementById('fLojaSistema').value = l.sistema;
  document.getElementById('fLojaStatus').value = l.status;
  document.getElementById('fLojaObs').value = l.observacoes;
  editingLojaId = id;
  document.getElementById('cancelEditLoja').style.display='inline-block';
  document.getElementById('saveLoja').textContent = 'Salvar alterações';
  window.scrollTo({top:0, behavior:'smooth'});
}
document.getElementById('cancelEditLoja').addEventListener('click', clearLojaForm);
document.getElementById('saveLoja').addEventListener('click', async ()=>{
  const v = lojaFormValues();
  if(!v.nome){ alert('Informe o nome da loja.'); return; }
  const dupe = lojas.find(l => norm(l.nome)===norm(v.nome) && l.id!==editingLojaId);
  if(dupe && !editingLojaId){ alert('Já existe uma loja com esse nome. Edite o registro existente ou use um nome diferente.'); return; }
  if(editingLojaId){
    const l = lojas.find(x=>x.id===editingLojaId);
    Object.assign(l, v, {atualizadoEm: nowStamp()});
    logHist('loja', l.id, 'editado', `Loja "${l.nome}" atualizada manualmente.`);
  }else{
    const l = { id:uid(), ...v, criadoEm: nowStamp(), atualizadoEm: nowStamp() };
    lojas.push(l);
    logHist('loja', l.id, 'criado', `Loja "${l.nome}" cadastrada.`);
  }
  await saveLojas();
  clearLojaForm(); renderLojas(); renderKpis(); populateLojaSelects();
});
async function deleteLoja(id){
  const l = lojas.find(x=>x.id===id); if(!l) return;
  if(!confirm(`Excluir a loja "${l.nome}"? Os equipamentos vinculados a ela ficarão sem loja.`)) return;
  lojas = lojas.filter(x=>x.id!==id);
  logHist('loja', id, 'excluido', `Loja "${l.nome}" excluída.`);
  await saveLojas(); renderLojas(); renderKpis(); populateLojaSelects();
}

// ---- Import Lojas ----
const LOJA_COLS = {
  nome: ['nome','loja'], numero: ['numero','núm','num'], piso: ['piso'], setor: ['setor'],
  laco: ['laco','laço'], modulo: ['modulo','módulo','endereco','endereço'],
  responsavel: ['responsavel','responsável'], telefone: ['telefone','fone','contato'],
  sistema: ['sistema'], status: ['status','situacao','situação'], observacoes: ['observacoes','observações','obs'],
};
function mapRow(row, colsMap){
  const normalizedRow = {}; Object.keys(row).forEach(k=> normalizedRow[norm(k)] = row[k]);
  const out = {};
  Object.entries(colsMap).forEach(([field, variants])=>{
    for(const v of variants){ if(normalizedRow[v] !== undefined && normalizedRow[v] !== ''){ out[field] = String(normalizedRow[v]).trim(); break; } }
  });
  return out;
}
function readSheet(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = (e)=>{
      try{
        const wb = XLSX.read(e.target.result, {type:'binary'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, {defval:''}));
      }catch(err){ reject(err); }
    };
    reader.onerror = reject;
    reader.readAsBinaryString(file);
  });
}
document.getElementById('importLojasBtn').addEventListener('click', async ()=>{
  const file = document.getElementById('importLojasFile').files[0];
  const log = document.getElementById('importLojasLog');
  log.style.display='block'; log.textContent = 'Lendo arquivo...';
  if(!file){ log.textContent = 'Escolha um arquivo primeiro.'; return; }
  try{
    const rows = await readSheet(file);
    const modo = document.getElementById('importModoLojas').value;
    let criadas=0, atualizadas=0, ignoradas=0, semNome=0;
    rows.forEach(row=>{
      const m = mapRow(row, LOJA_COLS);
      if(!m.nome){ semNome++; return; }
      const existente = lojas.find(l=>norm(l.nome)===norm(m.nome));
      if(existente){
        if(modo==='ignorar'){ ignoradas++; return; }
        if(modo==='sobrescrever'){
          Object.assign(existente, {
            nome:m.nome, numero:m.numero||'', piso:m.piso||'', setor:m.setor||'', laco:m.laco||'',
            modulo:m.modulo||'', responsavel:m.responsavel||'', telefone:m.telefone||'',
            sistema:m.sistema||'SDAI', status:m.status||'Ativo', observacoes:m.observacoes||'', atualizadoEm: nowStamp()
          });
        }else{
          Object.keys(m).forEach(k=>{ if(m[k]) existente[k]=m[k]; });
          existente.atualizadoEm = nowStamp();
        }
        atualizadas++;
      }else{
        lojas.push({ id:uid(), nome:m.nome, numero:m.numero||'', piso:m.piso||'', setor:m.setor||'', laco:m.laco||'',
          modulo:m.modulo||'', responsavel:m.responsavel||'', telefone:m.telefone||'', sistema:m.sistema||'SDAI',
          status:m.status||'Ativo', observacoes:m.observacoes||'', criadoEm: nowStamp(), atualizadoEm: nowStamp() });
        criadas++;
      }
    });
    await saveLojas();
    logHist('loja', null, 'importado', `Importação de planilha: ${criadas} criadas, ${atualizadas} atualizadas, ${ignoradas} ignoradas, ${semNome} sem nome (puladas).`);
    log.textContent = `✓ Importação concluída.\n${criadas} loja(s) criada(s)\n${atualizadas} loja(s) atualizada(s)\n${ignoradas} ignorada(s) (já existiam)\n${semNome} linha(s) sem nome de loja (puladas)`;
    renderLojas(); renderKpis(); populateLojaSelects();
  }catch(err){
    console.error(err);
    log.textContent = 'Não consegui ler esse arquivo. Confira se é .xlsx, .xls ou .csv válido.';
  }
});

// ================= EQUIPAMENTOS =================
function renderEquip(){
  populateLojaSelects();
  const lojaMap = Object.fromEntries(lojas.map(l=>[l.id,l]));
  const busca = norm(document.getElementById('equipBusca').value);
  const fLoja = document.getElementById('filtroEquipLoja').value;
  const fTipo = document.getElementById('filtroEquipTipo').value;
  const fStatus = document.getElementById('filtroEquipStatus').value;
  sortEquip();
  const filtered = equipamentos.filter(eq=>{
    if(fLoja && eq.lojaId!==fLoja) return false;
    if(fTipo && eq.tipo!==fTipo) return false;
    if(fStatus && eq.status!==fStatus) return false;
    const loja = lojaMap[eq.lojaId];
    if(busca && !norm(`${loja?loja.nome:''} ${eq.endereco} ${eq.modelo} ${eq.fabricante}`).includes(busca)) return false;
    return true;
  });
  document.getElementById('equipCount').textContent = `(${filtered.length}/${equipamentos.length})`;
  document.getElementById('equipList').innerHTML = filtered.map(eq=>{
    const loja = lojaMap[eq.lojaId];
    const statusTag = eq.status==='Ativo' ? 'on' : eq.status==='Em falha' ? 'warn' : 'off';
    return `<div class="list-item">
      <div class="actions"><button class="edit" data-id="${eq.id}">Editar</button><button class="del" data-id="${eq.id}">Excluir</button></div>
      <div class="title">${eq.tipo} — ${loja ? loja.nome : '(loja removida)'}</div>
      <div class="meta"><span class="tag ${statusTag}">${eq.status}</span>${eq.laco||'sem laço'} · Endereço ${eq.endereco||'—'}</div>
      ${eq.fabricante||eq.modelo ? `<div class="meta">${eq.fabricante||''} ${eq.modelo||''}</div>` : ''}
    </div>`;
  }).join('') || '<div class="hint">Nenhum equipamento encontrado.</div>';

  document.querySelectorAll('#equipList .edit').forEach(b=>b.addEventListener('click', e=>startEditEquip(e.target.dataset.id)));
  document.querySelectorAll('#equipList .del').forEach(b=>b.addEventListener('click', e=>deleteEquip(e.target.dataset.id)));
}
['equipBusca'].forEach(id=>document.getElementById(id).addEventListener('input', renderEquip));
['filtroEquipLoja','filtroEquipTipo','filtroEquipStatus'].forEach(id=>document.getElementById(id).addEventListener('change', renderEquip));

function equipFormValues(){
  return {
    lojaId: document.getElementById('fEquipLoja').value,
    tipo: document.getElementById('fEquipTipo').value,
    endereco: document.getElementById('fEquipEndereco').value.trim(),
    laco: document.getElementById('fEquipLaco').value.trim(),
    numero: document.getElementById('fEquipNumero').value.trim(),
    fabricante: document.getElementById('fEquipFabricante').value.trim(),
    modelo: document.getElementById('fEquipModelo').value.trim(),
    dataInstalacao: document.getElementById('fEquipDataInstalacao').value,
    ultimaManutencao: document.getElementById('fEquipUltimaManutencao').value,
    status: document.getElementById('fEquipStatus').value,
    observacoes: document.getElementById('fEquipObs').value.trim(),
  };
}
function clearEquipForm(){
  ['fEquipEndereco','fEquipLaco','fEquipNumero','fEquipFabricante','fEquipModelo','fEquipDataInstalacao','fEquipUltimaManutencao','fEquipObs'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fEquipTipo').value='Detector'; document.getElementById('fEquipStatus').value='Ativo';
  editingEquipId = null;
  document.getElementById('cancelEditEquip').style.display='none';
  document.getElementById('saveEquip').textContent = '+ Adicionar equipamento';
}
function startEditEquip(id){
  const eq = equipamentos.find(x=>x.id===id); if(!eq) return;
  document.getElementById('fEquipLoja').value = eq.lojaId;
  document.getElementById('fEquipTipo').value = eq.tipo;
  document.getElementById('fEquipEndereco').value = eq.endereco;
  document.getElementById('fEquipLaco').value = eq.laco;
  document.getElementById('fEquipNumero').value = eq.numero;
  document.getElementById('fEquipFabricante').value = eq.fabricante;
  document.getElementById('fEquipModelo').value = eq.modelo;
  document.getElementById('fEquipDataInstalacao').value = eq.dataInstalacao||'';
  document.getElementById('fEquipUltimaManutencao').value = eq.ultimaManutencao||'';
  document.getElementById('fEquipStatus').value = eq.status;
  document.getElementById('fEquipObs').value = eq.observacoes;
  editingEquipId = id;
  document.getElementById('cancelEditEquip').style.display='inline-block';
  document.getElementById('saveEquip').textContent = 'Salvar alterações';
}
document.getElementById('cancelEditEquip').addEventListener('click', clearEquipForm);
document.getElementById('saveEquip').addEventListener('click', async ()=>{
  const v = equipFormValues();
  if(!v.lojaId){ alert('Selecione a loja vinculada.'); return; }
  const dupe = equipamentos.find(e => e.lojaId===v.lojaId && e.tipo===v.tipo && norm(e.endereco)===norm(v.endereco) && e.id!==editingEquipId && v.endereco);
  if(dupe){ alert('Já existe um equipamento desse tipo com esse endereço nessa loja.'); return; }
  const lojaNome = (lojas.find(l=>l.id===v.lojaId)||{}).nome || '?';
  if(editingEquipId){
    const eq = equipamentos.find(x=>x.id===editingEquipId);
    Object.assign(eq, v, {atualizadoEm: nowStamp()});
    logHist('equipamento', eq.id, 'editado', `Equipamento (${v.tipo}) de "${lojaNome}" atualizado.`);
  }else{
    const eq = { id:uid(), ...v, criadoEm: nowStamp(), atualizadoEm: nowStamp() };
    equipamentos.push(eq);
    logHist('equipamento', eq.id, 'criado', `Equipamento (${v.tipo}) cadastrado para "${lojaNome}".`);
  }
  await saveEquip();
  clearEquipForm(); renderEquip(); renderKpis();
});
async function deleteEquip(id){
  const eq = equipamentos.find(x=>x.id===id); if(!eq) return;
  if(!confirm('Excluir este equipamento?')) return;
  equipamentos = equipamentos.filter(x=>x.id!==id);
  logHist('equipamento', id, 'excluido', `Equipamento (${eq.tipo}) excluído.`);
  await saveEquip(); renderEquip(); renderKpis();
}

// ---- Import Equipamentos ----
const EQUIP_COLS = {
  loja: ['loja','nome'], tipo: ['tipo'], endereco: ['endereco','endereço'], laco: ['laco','laço'],
  numero: ['numero','número'], fabricante: ['fabricante'], modelo: ['modelo'],
  dataInstalacao: ['data instalacao','data instalação','instalacao'],
  ultimaManutencao: ['ultima manutencao','última manutenção','manutencao'],
  status: ['status'], observacoes: ['observacoes','observações','obs'],
};
document.getElementById('importEquipBtn').addEventListener('click', async ()=>{
  const file = document.getElementById('importEquipFile').files[0];
  const log = document.getElementById('importEquipLog');
  log.style.display='block'; log.textContent = 'Lendo arquivo...';
  if(!file){ log.textContent = 'Escolha um arquivo primeiro.'; return; }
  try{
    const rows = await readSheet(file);
    const modo = document.getElementById('importModoEquip').value;
    let criados=0, atualizados=0, ignorados=0, semLoja=0;
    rows.forEach(row=>{
      const m = mapRow(row, EQUIP_COLS);
      if(!m.loja){ semLoja++; return; }
      const loja = lojas.find(l=>norm(l.nome)===norm(m.loja));
      if(!loja){ semLoja++; return; }
      const existente = equipamentos.find(e=>e.lojaId===loja.id && norm(e.tipo)===norm(m.tipo||'Detector') && norm(e.endereco)===norm(m.endereco||''));
      if(existente){
        if(modo==='ignorar'){ ignorados++; return; }
        if(modo==='sobrescrever'){
          Object.assign(existente, { tipo:m.tipo||'Detector', endereco:m.endereco||'', laco:m.laco||'', numero:m.numero||'',
            fabricante:m.fabricante||'', modelo:m.modelo||'', dataInstalacao:m.dataInstalacao||'', ultimaManutencao:m.ultimaManutencao||'',
            status:m.status||'Ativo', observacoes:m.observacoes||'', atualizadoEm: nowStamp() });
        }else{
          Object.keys(m).forEach(k=>{ if(k!=='loja' && m[k]) existente[k]=m[k]; });
          existente.atualizadoEm = nowStamp();
        }
        atualizados++;
      }else{
        equipamentos.push({ id:uid(), lojaId:loja.id, tipo:m.tipo||'Detector', endereco:m.endereco||'', laco:m.laco||'',
          numero:m.numero||'', fabricante:m.fabricante||'', modelo:m.modelo||'', dataInstalacao:m.dataInstalacao||'',
          ultimaManutencao:m.ultimaManutencao||'', status:m.status||'Ativo', observacoes:m.observacoes||'',
          criadoEm: nowStamp(), atualizadoEm: nowStamp() });
        criados++;
      }
    });
    await saveEquip();
    logHist('equipamento', null, 'importado', `Importação de planilha: ${criados} criados, ${atualizados} atualizados, ${ignorados} ignorados, ${semLoja} sem loja correspondente.`);
    log.textContent = `✓ Importação concluída.\n${criados} equipamento(s) criado(s)\n${atualizados} atualizado(s)\n${ignorados} ignorado(s)\n${semLoja} sem loja cadastrada correspondente (cadastre a loja primeiro)`;
    renderEquip(); renderKpis();
  }catch(err){
    console.error(err);
    log.textContent = 'Não consegui ler esse arquivo. Confira se é .xlsx, .xls ou .csv válido.';
  }
});

// ================= HISTÓRICO =================
function renderHistorico(){
  const wrap = document.getElementById('histList');
  const items = historico.slice().reverse().slice(0,200);
  wrap.innerHTML = items.map(h=>`
    <div class="list-item">
      <div class="title" style="padding-right:0;">${h.detalhes}</div>
      <div class="meta">${h.dataHora} · ${h.entidade} · ${h.acao}</div>
    </div>`).join('') || '<div class="hint">Nenhuma alteração registrada ainda.</div>';
}

// ================= SERVIÇOS & ATAS =================
function renderServicos(){
  document.getElementById('servList').innerHTML = servicos.slice().reverse().map(s=>`
    <div class="list-item">
      <button class="rm" data-id="${s.id}">Remover</button>
      <div class="title">${s.sistema} — ${s.data||'sem data'}</div>
      <div class="meta">${s.descricao}</div>
      <div class="meta">Técnico: ${s.tecnico||'—'}</div>
    </div>`).join('') || '<div class="hint">Nenhum serviço registrado ainda.</div>';
  document.getElementById('servList').querySelectorAll('.rm').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{ servicos = servicos.filter(s=>s.id!==e.target.dataset.id); await saveServicos(); renderServicos(); renderKpis(); });
  });
}
document.getElementById('addServico').addEventListener('click', async ()=>{
  const descricao = document.getElementById('servDesc').value.trim();
  if(!descricao){ return; }
  servicos.push({ id:uid(), data:document.getElementById('servData').value, sistema:document.getElementById('servSistema').value, descricao, tecnico:document.getElementById('servTecnico').value.trim() });
  await saveServicos();
  document.getElementById('servDesc').value=''; document.getElementById('servTecnico').value='';
  renderServicos(); renderKpis();
});

function renderAtas(){
  document.getElementById('ataList').innerHTML = atas.slice().reverse().map(a=>`
    <div class="list-item">
      <button class="rm" data-id="${a.id}">Remover</button>
      <div class="title">${a.titulo} — ${a.data||'sem data'}</div>
      <div class="meta">Participantes: ${a.participantes||'—'}</div>
      <div class="meta">${a.resumo}</div>
    </div>`).join('') || '<div class="hint">Nenhuma ata registrada ainda.</div>';
  document.getElementById('ataList').querySelectorAll('.rm').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{ atas = atas.filter(a=>a.id!==e.target.dataset.id); await saveAtas(); renderAtas(); renderKpis(); });
  });
}
document.getElementById('addAta').addEventListener('click', async ()=>{
  const titulo = document.getElementById('ataTitulo').value.trim();
  if(!titulo){ return; }
  atas.push({ id:uid(), data:document.getElementById('ataData').value, titulo, participantes:document.getElementById('ataParticipantes').value.trim(), resumo:document.getElementById('ataResumo').value.trim() });
  await saveAtas();
  document.getElementById('ataTitulo').value=''; document.getElementById('ataParticipantes').value=''; document.getElementById('ataResumo').value='';
  renderAtas(); renderKpis();
});

// ================= PLANO DE AÇÃO (IA) =================
function renderPlano(){
  const wrap = document.getElementById('planoAtual');
  wrap.innerHTML = CATS.map(cat=>{
    const items = plano.filter(p=>p.categoria===cat);
    if(items.length===0) return '';
    return `<div class="cat-block"><h4>${cat}</h4>${items.map(it=>`
      <div class="cat-item">
        <span>${it.loja}${it.confirmado ? ' ✅ ('+it.dataHora+')' : ''}</span>
        <button class="rm" data-id="${it.id}" style="position:static;">Remover</button>
      </div>`).join('')}</div>`;
  }).join('') || '<div class="hint">Nenhum item no plano de ação ainda. Analise um evento acima para começar.</div>';
  wrap.querySelectorAll('.rm').forEach(btn=>{
    btn.addEventListener('click', async (e)=>{ plano = plano.filter(p=>p.id!==e.target.dataset.id); await savePlano(); renderPlano(); renderKpis(); });
  });
}

function fileToBase64(file){
  return new Promise((res,rej)=>{
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

document.getElementById('analisarBtn').addEventListener('click', async ()=>{
  const statusEl = document.getElementById('analiseStatus');
  const btn = document.getElementById('analisarBtn');
  const texto = document.getElementById('planoTexto').value.trim();
  const files = document.getElementById('planoImgs').files;
  if(!texto && files.length===0){ statusEl.textContent = 'Cole o texto do evento ou escolha uma foto.'; statusEl.style.color = 'var(--danger)'; return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Analisando...';
  statusEl.textContent = ''; statusEl.style.color = 'var(--ok)';

  try{
    const content = [];
    for(const f of files){
      const b64 = await fileToBase64(f);
      content.push({ type:'image', source:{ type:'base64', media_type: f.type || 'image/jpeg', data: b64 } });
    }
    const enderecoContext = equipamentos.length
      ? 'Planilha de endereçamento (código do módulo → loja):\n' + equipamentos.map(eq=>{
          const loja = lojas.find(l=>l.id===eq.lojaId);
          return `${eq.endereco || '?'} → ${loja ? loja.nome : '?'} (${eq.laco||'?'}, ${eq.tipo})`;
        }).join('\n')
      : 'Nenhum equipamento cadastrado ainda para resolver endereços de Falha.';

    content.push({ type:'text', text:
      `Texto/observações do evento fornecido pelo técnico:\n${texto || '(nenhum texto, apenas a(s) imagem(ns) do painel)'}\n\n${enderecoContext}` });

    const systemPrompt = `Você é um assistente técnico da L3A que interpreta eventos de um painel Bosch (FPA-5000 / Avenar 2000) de detecção de incêndio do Shopping Pantanal, para montar o Plano de Ação.

Regras obrigatórias:
1. Nome da loja + "CO2" no evento → confirma teste de Integração CO2 (categoria "Integração CO2").
2. Nome da loja sozinho, sem "CO2" → confirma reteste do módulo SDAI (categoria "Retestes nos módulos SDAI").
3. O simples aparecimento do evento já é a comprovação — não escreva "pendente" nem comentários extras.
4. Eventos do tipo "Falha" = problema técnico real, não é teste. Categoria "Falhas de Comunicação". Use a planilha de endereçamento para identificar a loja pelo código do módulo, se disponível.
5. Toda loja identificada nos eventos deve virar um item confirmado (confirmado=true) com a data/hora do evento no formato DD.MM.AA HH:MM.
6. Se não for possível identificar a loja de uma Falha pela planilha, ainda assim crie o item mas deixe "loja" como o código do módulo, e "confirmado" como true (o evento existe), pedindo revisão no campo "obs".

Categorias válidas (use exatamente estes textos): "Falhas de Comunicação", "Correção de Cadastros", "Integração CO2", "Retestes nos módulos SDAI", "Lojas já regularizadas".

Responda SOMENTE com um JSON válido, sem markdown, no formato:
{"itens": [{"categoria": "...", "loja": "...", "dataHora": "DD.MM.AA HH:MM", "confirmado": true, "obs": ""}]}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content }]
      })
    });
    const data = await response.json();
    const textBlocks = (data.content || []).filter(b=>b.type==='text').map(b=>b.text).join('\n');
    const clean = textBlocks.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(clean);
    renderProposta(parsed.itens || []);
    statusEl.textContent = `✓ ${ (parsed.itens||[]).length } item(ns) identificado(s). Revise abaixo antes de salvar.`;
  }catch(e){
    console.error(e);
    statusEl.textContent = 'Não consegui analisar agora. Tente novamente em instantes.';
    statusEl.style.color = 'var(--danger)';
  }finally{
    btn.disabled = false; btn.textContent = 'Analisar com IA';
  }
});

function renderProposta(itens){
  const wrap = document.getElementById('propostaWrap');
  if(itens.length===0){ wrap.innerHTML=''; return; }
  wrap.innerHTML = `<div class="section-title">Itens propostos pela IA</div>` + itens.map((it,i)=>`
    <div class="check-row">
      <input type="checkbox" checked data-idx="${i}" class="propCheck">
      <div class="fields">
        <select class="cat-select" data-idx="${i}" data-f="categoria">
          ${CATS.map(c=>`<option ${c===it.categoria?'selected':''}>${c}</option>`).join('')}
        </select>
        <input type="text" data-idx="${i}" data-f="loja" value="${it.loja||''}" placeholder="Loja">
        <input type="text" data-idx="${i}" data-f="dataHora" value="${it.dataHora||''}" placeholder="DD.MM.AA HH:MM">
        ${it.obs ? `<div class="hint" style="margin:0;">⚠ ${it.obs}</div>` : ''}
      </div>
    </div>`).join('') + `<button class="btn" id="salvarProposta">Salvar itens marcados no Plano de Ação</button>`;

  wrap.querySelectorAll('input[data-f],select[data-f]').forEach(el=>{
    el.addEventListener('change', (e)=>{ itens[e.target.dataset.idx][e.target.dataset.f] = e.target.value; });
  });

  document.getElementById('salvarProposta').addEventListener('click', async ()=>{
    const checks = wrap.querySelectorAll('.propCheck');
    let added = 0;
    checks.forEach(chk=>{
      if(chk.checked){
        const it = itens[chk.dataset.idx];
        const dup = plano.some(p=>p.loja===it.loja && p.categoria===it.categoria && p.dataHora===it.dataHora);
        if(!dup){ plano.push({ id:uid(), categoria:it.categoria, loja:it.loja, dataHora:it.dataHora, confirmado:true }); added++; }
      }
    });
    await savePlano();
    renderPlano(); renderKpis();
    wrap.innerHTML = `<div class="status-msg">✓ ${added} item(ns) salvo(s) no Plano de Ação.</div>`;
    document.getElementById('planoTexto').value = '';
    document.getElementById('planoImgs').value = '';
  });
}

// ================= EXPORT =================
document.getElementById('buildExport').addEventListener('click', ()=>{
  let out = '';
  CATS.forEach(cat=>{
    const items = plano.filter(p=>p.categoria===cat);
    out += `*${cat}*\n`;
    if(items.length===0){ out += '(nenhum item)\n\n'; return; }
    items.forEach(it=>{ out += `* ${it.loja}${it.confirmado ? ' ✅ ('+it.dataHora+')' : ''}\n`; });
    out += '\n';
  });
  document.getElementById('exportArea').value = out.trim();
  document.getElementById('statusMsg').textContent = '';
});
document.getElementById('copyExport').addEventListener('click', async ()=>{
  const ta = document.getElementById('exportArea');
  if(!ta.value){ document.getElementById('statusMsg').textContent = 'Toque em "Gerar texto" primeiro.'; return; }
  try{ await navigator.clipboard.writeText(ta.value); document.getElementById('statusMsg').textContent = '✓ Copiado!'; }
  catch(e){ ta.select(); document.getElementById('statusMsg').textContent = 'Selecione o texto acima e copie manualmente.'; }
});

document.getElementById('buildBackup').addEventListener('click', ()=>{
  const backup = { geradoEm: new Date().toISOString(), lojas, equipamentos, historico, plano, servicos, atas };
  document.getElementById('backupArea').value = JSON.stringify(backup, null, 2);
  document.getElementById('backupStatus').textContent = '';
});
document.getElementById('copyBackup').addEventListener('click', async ()=>{
  const ta = document.getElementById('backupArea');
  if(!ta.value){ document.getElementById('backupStatus').textContent = 'Toque em "Gerar backup completo" primeiro.'; return; }
  try{ await navigator.clipboard.writeText(ta.value); document.getElementById('backupStatus').textContent = '✓ Copiado! Cole na conversa com o Claude.'; }
  catch(e){ ta.select(); document.getElementById('backupStatus').textContent = 'Selecione o texto acima e copie manualmente.'; }
});
document.getElementById('downloadBackup').addEventListener('click', ()=>{
  const ta = document.getElementById('backupArea');
  if(!ta.value){ document.getElementById('backupStatus').textContent = 'Toque em "Gerar backup completo" primeiro.'; return; }
  const blob = new Blob([ta.value], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href = url; a.download = `backup-sdai-pantanal-${stamp}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  document.getElementById('backupStatus').textContent = '✓ Arquivo baixado.';
});



// ---------- CLOUD SYNC BUTTONS ----------
function setCloudStatus(msg, ok=true){ const el=document.getElementById('cloudStatus'); if(el){ el.textContent=msg; el.style.color=ok?'var(--ok)':'var(--danger)'; } }
async function cloudSaveAll(){
  const data={lojas,equipamentos,historico,plano,servicos,atas,updatedAt:new Date().toISOString()};
  const r=await SdaiStorage.saveAll(data);
  setCloudStatus(r.remote?'Salvo no Google Sheets':'Salvo localmente', !!r.ok);
}
async function cloudLoadAll(){
  const r=await SdaiStorage.loadAll();
  if(r && r.data){
    lojas=r.data.lojas||[]; equipamentos=r.data.equipamentos||[]; historico=r.data.historico||[]; plano=r.data.plano||[]; servicos=r.data.servicos||[]; atas=r.data.atas||[];
    renderKpis(); renderLojas(); populateLojaSelects(); renderEquip(); renderServicos(); renderAtas(); renderPlano();
    setCloudStatus(r.remote?'Dados carregados do Google Sheets':'Dados carregados localmente', true);
  }else setCloudStatus('Nada encontrado para carregar', false);
}
function bindCloudButtons(){
  const a=document.getElementById('cloudSetup'), b=document.getElementById('cloudLoad'), c=document.getElementById('cloudSave');
  if(a) a.addEventListener('click', async()=>{ setCloudStatus('Configurando banco...'); const r=await SdaiApi.setupDatabase(); setCloudStatus(r&&r.ok?'Banco Google configurado':'Falha ao configurar banco', !!(r&&r.ok)); });
  if(b) b.addEventListener('click', cloudLoadAll);
  if(c) c.addEventListener('click', cloudSaveAll);
}

// ================= INIT =================
(async function init(){
  bindCloudButtons();
  await loadAll();
  renderKpis(); renderLojas(); populateLojaSelects(); renderEquip(); renderServicos(); renderAtas(); renderPlano();
})();