
const KEY='sdai_bosch_manager_v4_flm_portas';
const API_URL='https://script.google.com/macros/s/AKfycby45dTdw4g-pkcvY9sys3_gmvVcmnSyf6PZzJbRsbSFjhtuWbV1D5XSBEc-J1UtOBYftA/exec';
const SYNC_KEY=KEY+':syncConfig';
const emptyDB=()=>({empreendimento:{nome:'Empreendimento',cliente:'Cliente'},config:{appName:'Contratos L3A',subtitle:'SDAI • Contratos • Operação',logoData:''},usuarios:[{id:'admin-default',nome:'Administrador',email:'admin@local',perfil:'Administrador',ativo:'Sim'}],paineis:[],lacos:[],flms:[],portas:[],locais:[],equipamentos:[],falhas:[],planos:[],inconsistencias:[],imports:[]});
let db=load(); let currentView='dashboard'; let filters={};
let searchRenderTimer=null;
let lastSearchFocus=null;
function onSearchInput(el){
  const val=el.value;
  const group=el.dataset.filterGroup;
  const key=el.dataset.filterKey;
  const path=el.dataset.filterPath;
  if(group && key){ filters[group]={...(filters[group]||{}),[key]:val}; }
  else if(path){ filters[path]=val; }
  lastSearchFocus={key:el.dataset.focusKey||path||((group||'')+'.'+(key||'')),start:el.selectionStart??val.length,end:el.selectionEnd??val.length};
  clearTimeout(searchRenderTimer);
  searchRenderTimer=setTimeout(()=>render(),120);
}
function attachSearchInputs(){
  document.querySelectorAll('[data-filter-input="1"]').forEach(el=>{
    if(el.dataset.boundSearch==='1')return;
    el.dataset.boundSearch='1';
    el.addEventListener('input',()=>onSearchInput(el));
  });
}
function restoreSearchFocus(){
  if(!lastSearchFocus)return;
  const f=lastSearchFocus;
  setTimeout(()=>{
    const el=document.querySelector(`[data-focus-key="${CSS.escape(f.key)}"]`);
    if(el){el.focus();try{el.setSelectionRange(f.start,f.end)}catch(e){}}
  },0);
}

function load(){try{return normalizeAllStatuses(Object.assign(emptyDB(),JSON.parse(localStorage.getItem(KEY))||{}))}catch(e){return emptyDB()}}
function syncCfg(){try{return Object.assign({configured:false,auto:true,intervalSec:30,lastSync:'',sheetUrl:'',dirty:false},JSON.parse(localStorage.getItem(SYNC_KEY)||'{}'))}catch(e){return {configured:false,auto:true,intervalSec:30,lastSync:'',sheetUrl:'',dirty:false}}}
function setSyncCfg(o){localStorage.setItem(SYNC_KEY,JSON.stringify(Object.assign(syncCfg(),o))); updateSyncFooter()}
function persistLocal(){localStorage.setItem(KEY,JSON.stringify(db))}
function markDirty(reason='alteração'){persistLocal(); setSyncCfg({dirty:true,lastReason:reason}); scheduleAutoSync(1500)}
function save(){markDirty('salvamento');render()}
function updateSyncFooter(status){const c=syncCfg(); const dot=document.getElementById('syncDot'), txt=document.getElementById('syncText'); if(!dot||!txt)return; dot.className='syncDot '+(status==='saving'?'warn':status==='error'?'bad':(!c.configured?'warn':c.dirty?'warn':'ok')); txt.textContent=status==='saving'?'Sincronizando...':status==='error'?'Falha ao sincronizar':(!c.configured?'Banco Google não configurado':c.dirty?'Alterações pendentes':'Sincronizado '+(c.lastSync||''));}
let autoSyncTimer=null; function scheduleAutoSync(ms){const c=syncCfg(); if(!c.configured||!c.auto)return; clearTimeout(autoSyncTimer); autoSyncTimer=setTimeout(()=>syncNow(false),ms||((c.intervalSec||30)*1000));}
function jsonp(action, params={}){return new Promise((resolve,reject)=>{const cb='cb_'+Date.now()+'_'+Math.random().toString(36).slice(2); window[cb]=(data)=>{delete window[cb]; s.remove(); resolve(data)}; const q=new URLSearchParams({action,callback:cb,...params}); const s=document.createElement('script'); s.src=API_URL+'?'+q.toString(); s.onerror=()=>{delete window[cb]; s.remove(); reject(new Error('Falha de comunicação com Apps Script'))}; document.body.appendChild(s); setTimeout(()=>{if(window[cb]){delete window[cb]; try{s.remove()}catch(e){} reject(new Error('Tempo esgotado na API'))}},30000)})}
async function apiPost(action,payload){return fetch(API_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,payload})})}
async function setupGoogle(){try{updateSyncFooter('saving'); const r=await jsonp('setup'); if(!r.ok)throw new Error(r.error||'Erro ao configurar banco'); setSyncCfg({configured:true,sheetUrl:r.sheetUrl||'',dirty:true}); renderSistema(); updateSyncFooter(); alert('Banco Google configurado/validado.');}catch(e){updateSyncFooter('error'); alert('Falha ao configurar banco: '+e.message)}}
async function loadGoogle(){try{updateSyncFooter('saving'); const r=await jsonp('load'); if(!r.ok)throw new Error(r.error||'Erro ao carregar'); if(r.db && Object.keys(r.db).length){ db=normalizeAllStatuses(Object.assign(emptyDB(),r.db)); persistLocal(); setSyncCfg({configured:true,dirty:false,lastSync:new Date().toLocaleTimeString('pt-BR')}); render(); } else { alert('Banco Google vazio. Dados locais preservados. Use Sincronizar agora para enviar sua base.'); setSyncCfg({configured:true}); renderSistema(); }}catch(e){updateSyncFooter('error'); alert('Falha ao carregar Google: '+e.message)}}
async function syncNow(showAlert=true){const c=syncCfg(); if(!c.configured){ if(showAlert) alert('Configure/valide o banco Google primeiro.'); return; } try{updateSyncFooter('saving'); persistLocal(); await apiPost('save',{db}); setSyncCfg({dirty:false,lastSync:new Date().toLocaleTimeString('pt-BR')}); if(showAlert) alert('Sincronização enviada ao Google.'); renderSistema();}catch(e){updateSyncFooter('error'); if(showAlert) alert('Falha ao sincronizar: '+e.message)}}
function setAutoInterval(sec){setSyncCfg({intervalSec:Number(sec)||30,dirty:syncCfg().dirty}); scheduleAutoSync((Number(sec)||30)*1000); renderSistema()}
function setAutoEnabled(v){setSyncCfg({auto:!!v}); if(v) scheduleAutoSync(1000); renderSistema()}

const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const n=s=>String(s??'').trim(); const up=s=>n(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
function normalizeStatus(st){const raw=n(st); const x=up(raw); if(!x||x==='ATIVO'||x==='OK'||x==='NORMAL'||x.includes('OPERACAO')||x.includes('FUNCION'))return 'Em operação'; if(x.includes('LOGISTA'))return 'Falha logista'; if(x.includes('SISTEMA'))return 'Falha sistema'; if(x.includes('FALHA'))return raw||'Falha sistema'; if(x.includes('DESATIV')||x==='INATIVO')return 'Desativada'; if(x.includes('TESTE'))return 'Em teste'; return raw||'Em operação'}
function normalizeAllStatuses(base){['equipamentos','flms','locais','falhas'].forEach(k=>(base[k]||[]).forEach(o=>{if(o.status)o.status=normalizeStatus(o.status)}));return base}
function now(){return new Date().toLocaleString('pt-BR')}
function isoNow(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function esc(s){return n(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function csvEscape(s){s=n(s);return /[;,"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function normKey(k){return up(k).replace(/^\uFEFF/,'').replace(/[^A-Z0-9]/g,'')}
function get(row,names){const keys=Object.keys(row); for(const name of names){const nk=normKey(name); const k=keys.find(x=>normKey(x)===nk); if(k!==undefined)return n(row[k])} return ''}
function classifyDevice(model,tipo,local){const m=up(model+' '+tipo); if(/FLM4204CONS|FLM420I2WE|FLM/.test(m))return 'Módulo'; if(/FAP|DFO/.test(m))return 'Detector de Fumaça'; if(/FAH/.test(m))return 'Detector Térmico'; if(/ACM|DM210|SM210|FMC210|FMC420RW|ACIONADOR/.test(m))return 'Acionador Manual'; if(/FNM|FNS|SIRENE|SINALIZ/.test(m))return 'Sirene / Sinalizador'; if(/DETECTOR/.test(m))return 'Detector'; return n(tipo)||'Não classificado'}
function localClass(name){const x=up(name); if(!x)return ''; if(/AREA COMUM|MALL|CORREDOR|HALL|PRACA|CIRCULACAO|ACESSO/.test(x))return 'Área Comum'; if(/TECNIC|CASA|SALA|BARRILETE|SUBEST|SHAFT|DML|DOCAS|DEPOSITO|SEGURANCA|ADMIN|CPD|TI|BOMBA|GERADOR/.test(x))return 'Área Técnica'; return 'Loja'}
function isEquipAreaLabel(name,model,tipo){const x=up((name||'')+' '+(model||'')+' '+(tipo||'')); return /(^|\s)(DFO|FAP|ACM|DM210|SM210|FMC210|FMC420RW)(\s|$)/.test(x)}
function equipAreaClass(name,model,tipo){const cls=localClass(name); if(cls==='Área Técnica'||cls==='Área Comum')return cls; return isEquipAreaLabel(name,model,tipo)?'Área Comum':''}
function statusClass(s){s=up(normalizeStatus(s)); if(/OPER/.test(s))return 'ok'; if(/LOGISTA|SISTEMA|FALHA/.test(s))return 'bad'; if(/TESTE/.test(s))return 'warn'; if(/DESATIV/.test(s))return 'off'; return ''}
function unique(arr){return [...new Set(arr.filter(Boolean).map(n))].sort((a,b)=>a.localeCompare(b,'pt-BR'))}
function findOrCreate(arr,match,obj){let x=arr.find(match); if(x)return {obj:x,created:false}; x={id:id(),...obj}; arr.push(x); return {obj:x,created:true}}
function painelById(v){return db.paineis.find(x=>x.id===v)||db.paineis.find(x=>x.nome===v)}
function lacoById(v){return db.lacos.find(x=>x.id===v)||db.lacos.find(x=>x.nome===v)}
function localById(v){return db.locais.find(x=>x.id===v)}
function flmById(v){return db.flms.find(x=>x.id===v)}
function locName(v){return localById(v)?.nome||''}
function paiName(v){return painelById(v)?.nome||''}
function lacName(v){return lacoById(v)?.nome||''}
function ensurePanel(nome,modelo='',localizacao='',obs='Importado'){return findOrCreate(db.paineis,x=>up(x.nome)===up(nome),{nome:nome||'Painel não informado',modelo,localizacao,obs}).obj}
function ensureLaco(painelId,nome,piso=''){return findOrCreate(db.lacos,x=>x.painelId===painelId&&up(x.nome)===up(nome),{painelId,nome:nome||'Laço não informado',piso,obs:'Importado'}).obj}
function ensureFlm(painelId,lacoId,endereco,modelo,piso){return findOrCreate(db.flms,x=>x.painelId===painelId&&x.lacoId===lacoId&&up(x.endereco)===up(endereco),{painelId,lacoId,endereco:endereco||'S/E',modelo:modelo||'FLM',piso,obs:'Importado'}).obj}
function ensurePorta(flmId,numero,localId='',ligacao=''){return findOrCreate(db.portas,x=>x.flmId===flmId&&String(x.numero)===String(numero||'1'),{flmId,numero:numero||'1',localId,ligacao,obs:'Importado'}).obj}
function ensureLocal(nome,tipo,painelId,lacoId,piso,flmId,portaId){let r=findOrCreate(db.locais,x=>up(x.nome)===up(nome),{nome,tipo:tipo||localClass(nome),painelId,lacoId,piso,flmId,portaId,status:'Em operação',ultimaAlteracao:isoNow(),obs:'Importado'}); Object.assign(r.obj,{painelId:r.obj.painelId||painelId,lacoId:r.obj.lacoId||lacoId,piso:r.obj.piso||piso,flmId:r.obj.flmId||flmId,portaId:r.obj.portaId||portaId}); return r.obj}
function deviceKey(d){return [d.painelId,d.lacoId,up(d.tipo),up(d.endereco),up(d.modelo),d.flmId||''].join('|')}
function ensureEquip(obj,mode='diff'){obj.status=normalizeStatus(obj.status); let key=deviceKey(obj); let ex=db.equipamentos.find(e=>deviceKey(e)===key); if(ex){ ex.status=normalizeStatus(ex.status||obj.status); if(mode==='overwrite')Object.assign(ex,{...obj,id:ex.id,status:normalizeStatus(ex.status||obj.status),ultimaAlteracao:ex.ultimaAlteracao||obj.ultimaAlteracao}); return {obj:ex,created:false,updated:mode==='overwrite'} } obj.id=id(); db.equipamentos.push(obj); return {obj,created:true}}
function clearAll(){db=emptyDB();persistLocal();markDirty('limpeza');render()}
function counts(){let tipos=unique(db.equipamentos.map(e=>e.tipo).concat(['Módulo'])); let c={paineis:db.paineis.length,lacos:db.lacos.length,flms:db.flms.length,portas:db.portas.length,locais:db.locais.length,equipamentos:db.equipamentos.length,totalDispositivos:db.equipamentos.length+db.flms.length,tipos:{},status:{}}; tipos.forEach(t=>c.tipos[t]=0); db.flms.forEach(()=>c.tipos['Módulo']=(c.tipos['Módulo']||0)+1); db.equipamentos.forEach(e=>{c.tipos[e.tipo]=(c.tipos[e.tipo]||0)+1;{let st=normalizeStatus(e.status); c.status[st]=(c.status[st]||0)+1}}); db.flms.forEach(f=>{{let st=normalizeStatus(f.status||'Em operação'); c.status[st]=(c.status[st]||0)+1}}); return c}
function table(rows,cols,actions){if(!rows.length)return '<p class="msg warn">Sem registros.</p>';return `<div class="tableWrap"><table><thead><tr>${cols.map(c=>`<th>${c[0]}</th>`).join('')}${actions?'<th>Ações</th>':''}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${c[2]?c[2](r):esc(r[c[1]])}</td>`).join('')}${actions?`<td>${actions(r)}</td>`:''}</tr>`).join('')}</tbody></table></div>`}
function selectOpts(vals,sel=''){return '<option value="">Todos</option>'+vals.map(v=>`<option ${v===sel?'selected':''}>${esc(v)}</option>`).join('')}
function kpi(label,val){return `<div class="metric"><small>${esc(label)}</small><strong>${esc(val)}</strong></div>`}
function render(){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(currentView).classList.add('active'); document.getElementById('pageTitle').textContent={dashboard:'Dashboard',paineis:'Painéis',lacos:'Laços',flms:'FLMs / Portas',locais:'Lojas / Áreas',equipamentos:'Equipamentos',falhas:'Falhas',plano:'Plano de Ação',importacao:'Importação',exportacao:'Exportação',relatorios:'Relatórios',sistema:'Banco de Dados',usuarios:'Usuários e Acessos',configuracoes:'Configurações',backup:'Backup',logs:'Logs do Sistema',sobre:'Sobre'}[currentView]||'SDAI'; renderDashboard();renderPaineis();renderLacos();renderFlms();renderLocais();renderEquipamentos();renderFalhas();renderPlano();renderImportacao();renderExportacao();renderRelatorios();renderSistema();renderUsuarios();renderConfiguracoes();renderBackup();renderLogs();renderSobre();applyBrand();applyRoleUI();attachSearchInputs();restoreSearchFocus();updateSyncFooter();}
document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentView=b.dataset.view;render()})); setInterval(()=>document.getElementById('clock').textContent=now(),1000);
function isOperacaoStatus(st){st=up(normalizeStatus(st||'Em operação'));return st.includes('OPER')}
function isFalhaStatus(st){st=up(normalizeStatus(st||''));return st.includes('FALHA')}
function isDesativadoStatus(st){st=up(normalizeStatus(st||''));return st.includes('DESATIV')}
function isTesteStatus(st){st=up(normalizeStatus(st||''));return st.includes('TESTE')}
function statusClass(st){st=normalizeStatus(st); if(isFalhaStatus(st))return 'bad'; if(isOperacaoStatus(st))return 'ok'; if(isTesteStatus(st))return 'warn'; if(isDesativadoStatus(st))return 'off'; return ''}
function dashBar(label,value,total,cls=''){
  const pct=total?Math.round((value/total)*100):0;
  return `<div class="barrow"><b>${esc(label)}</b><div class="bar"><i class="${cls}" style="width:${pct}%"></i></div><span>${value} • ${pct}%</span></div>`
}
function renderDashboard(){
  const c=counts();
  const allDevices=[...db.flms.map(f=>({...f,tipo:'Módulo'})),...db.equipamentos];
  const total=allDevices.length;
  const op=allDevices.filter(x=>isOperacaoStatus(x.status)).length;
  const falhaLogista=allDevices.filter(x=>up(x.status).includes('LOGISTA')).length;
  const falhaSistema=allDevices.filter(x=>up(x.status).includes('SISTEMA')).length;
  const desativados=allDevices.filter(x=>isDesativadoStatus(x.status)).length;
  const teste=allDevices.filter(x=>isTesteStatus(x.status)).length;
  const falhas=allDevices.filter(x=>isFalhaStatus(x.status)).length;
  const disponibilidade=total?Math.round((op/total)*100):0;
  const falhaPct=total?Math.round((falhas/total)*100):0;
  const deg=Math.max(0,Math.min(360,Math.round((falhas/Math.max(1,total))*360)));

  const tipoRows=Object.entries(c.tipos).map(([tipo,qtd])=>({tipo,qtd,pct:total?Math.round((qtd/total)*100):0}));
  const tipoTable=table(tipoRows,[['Tipo','tipo'],['Qtd.','qtd'],['Participação','pct',r=>dashBar('',r.qtd,total)]]);
  const statusRows=Object.entries(c.status).map(([status,qtd])=>({status:status||'Sem status',qtd,pct:total?Math.round((qtd/total)*100):0}));
  const statusTable=table(statusRows,[['Status','status',r=>`<span class="pill ${statusClass(r.status)}">${esc(r.status)}</span>`],['Qtd.','qtd'],['Participação','pct',r=>dashBar('',r.qtd,total,statusClass(r.status))]]);

  const painelRows=db.paineis.map(p=>{
    const fl=db.flms.filter(f=>f.painelId===p.id);
    const eq=db.equipamentos.filter(e=>e.painelId===p.id);
    const dev=[...fl.map(f=>({...f,tipo:'Módulo'})),...eq];
    const totalP=dev.length;
    const opP=dev.filter(x=>isOperacaoStatus(x.status)).length;
    const falP=dev.filter(x=>isFalhaStatus(x.status)).length;
    return {painel:p.nome,total:totalP,flms:fl.length,equip:eq.length,operacao:opP,falhas:falP,ef:totalP?Math.round((opP/totalP)*100):0};
  });
  const painelTable=table(painelRows,[['Painel','painel'],['Total','total'],['FLMs','flms'],['Equip.','equip'],['Em operação','operacao'],['Falhas','falhas'],['Eficiência','ef',r=>dashBar('',r.operacao,r.total,'ok')]]);

  const painelBlocks=db.paineis.map(p=>{
    const lac=db.lacos.filter(l=>l.painelId===p.id);
    const rows=lac.map(l=>{
      const fl=db.flms.filter(f=>f.lacoId===l.id);
      const eq=db.equipamentos.filter(e=>e.lacoId===l.id);
      const dev=[...fl.map(f=>({...f,tipo:'Módulo'})),...eq];
      const totalL=dev.length;
      const opL=dev.filter(x=>isOperacaoStatus(x.status)).length;
      const falL=dev.filter(x=>isFalhaStatus(x.status)).length;
      const porTipo={};dev.forEach(d=>porTipo[d.tipo]=(porTipo[d.tipo]||0)+1);
      return {laco:l.nome,piso:l.piso,total:totalL,operacao:opL,falhas:falL,ef:totalL?Math.round((opL/totalL)*100):0,tipos:Object.entries(porTipo).map(([k,v])=>`${k}: ${v}`).join(' • ')};
    });
    return `<div class="card"><h3 class="sectionTitle">${esc(p.nome)} — Laços, tipos e performance</h3>${table(rows,[['Laço','laco'],['Piso','piso'],['Total','total'],['Tipos cadastrados','tipos'],['Em operação','operacao'],['Falhas','falhas'],['Eficiência','ef',r=>dashBar('',r.operacao,r.total,'ok')]])}</div>`
  }).join('');

  document.getElementById('dashboard').innerHTML=`
    <div class="card">
      <h3 class="sectionTitle">Base configurada no sistema</h3>
      <div class="grid">
        ${kpi('Painéis',c.paineis)}${kpi('Laços',c.lacos)}${kpi('FLMs físicos',c.flms)}${kpi('Portas',c.portas)}
        ${kpi('Lojas / áreas',c.locais)}${kpi('Equipamentos',c.equipamentos)}${kpi('Total dispositivos',c.totalDispositivos)}${kpi('Tipos distintos',Object.keys(c.tipos).length)}
      </div>
    </div>
    <div class="chartGrid">
      <div class="chartPanel">
        <h4>Distribuição por tipo cadastrado</h4>
        <div class="chartBars">${tipoRows.map(r=>dashBar(r.tipo,r.qtd,total)).join('')||'<p class="msg warn">Sem dados.</p>'}</div>
      </div>
      <div class="chartPanel">
        <h4>Resumo técnico por painel</h4>
        ${painelTable}
      </div>
    </div>
    <div class="card">
      <h3 class="sectionTitle">Eficiência e performance operacional</h3>
      <div class="grid">
        ${kpi('Disponibilidade',disponibilidade+'%')}${kpi('Em operação',op)}${kpi('Falha logista',falhaLogista)}${kpi('Falha sistema',falhaSistema)}
        ${kpi('Falhas totais',falhas)}${kpi('Taxa de falha',falhaPct+'%')}${kpi('Em teste',teste)}${kpi('Desativados',desativados)}
      </div>
    </div>
    <div class="chartGrid">
      <div class="chartPanel">
        <h4>Disponibilidade operacional</h4>
        <div class="donutWrap"><div class="donut" style="--deg:${deg}deg"></div><div class="legend"><span><i class="dot ok"></i>Em operação: ${op}</span><span><i class="dot bad"></i>Falhas: ${falhas}</span><span><i class="dot"></i>Outros status: ${Math.max(0,total-op-falhas)}</span></div></div>
      </div>
      <div class="chartPanel">
        <h4>Status operacional por quantidade</h4>
        <div class="chartBars">${statusRows.map(r=>dashBar(r.status,r.qtd,total,statusClass(r.status))).join('')||'<p class="msg warn">Sem status.</p>'}</div>
      </div>
    </div>
    <div class="card">
      <h3 class="sectionTitle">Tabela consolidada por status</h3>
      ${statusTable}
    </div>
    <h3 class="sectionTitle">Compilado por Painel → Laço</h3>
    ${painelBlocks||'<div class="card"><p class="msg warn">Importe uma base para iniciar.</p></div>'}
  `
}
function renderPaineis(){let rows=db.paineis.map(p=>({...p,totalDisp:db.flms.filter(f=>f.painelId===p.id).length+db.equipamentos.filter(e=>e.painelId===p.id).length,sub:subTipos(x=>x.painelId===p.id)}));document.getElementById('paineis').innerHTML=`<div class="card"><button class="btn" onclick="formPainel()">+ Criar novo painel</button></div><div class="card"><h3 class="sectionTitle">Painéis cadastrados</h3>${table(rows,[['Painel','nome'],['Modelo','modelo'],['Localização','localizacao'],['Total disp.','totalDisp'],['Subtotal por tipo','sub',r=>r.sub]],r=>`<button class="btn small secondary" onclick="formPainel('${r.id}')">✏️</button> <button class="btn small danger" onclick="del('paineis','${r.id}')">🗑</button>`)}</div>`}
function renderLacos(){let fp=filters.lacoPainel||'',fl=filters.lacoNome||'',fs=filters.lacoStatus||''; let rows=db.lacos.filter(l=>(!fp||paiName(l.painelId)===fp)&&(!fl||l.nome===fl)).map(l=>{let eq=db.equipamentos.filter(e=>e.lacoId===l.id);let status=eq.some(e=>up(e.status).includes('FALHA'))?'Com falha':'Em operação';return {...l,painel:paiName(l.painelId),totalDisp:db.flms.filter(f=>f.lacoId===l.id).length+eq.length,status,sub:subTipos(x=>x.lacoId===l.id)}}).filter(r=>(!fs||r.status===fs));document.getElementById('lacos').innerHTML=`<div class="card"><button class="btn" onclick="formLaco()">+ Criar novo laço</button><div class="toolbar"><div class="field"><label>Painel</label><select onchange="filters.lacoPainel=this.value;render()">${selectOpts(unique(db.paineis.map(p=>p.nome)),fp)}</select></div><div class="field"><label>Laço</label><select onchange="filters.lacoNome=this.value;render()">${selectOpts(unique(db.lacos.map(l=>l.nome)),fl)}</select></div><div class="field"><label>Status</label><select onchange="filters.lacoStatus=this.value;render()">${selectOpts(['Em operação','Com falha'],fs)}</select></div></div></div><div class="card"><h3 class="sectionTitle">Laços cadastrados</h3>${table(rows,[['Painel','painel'],['Laço','nome'],['Piso','piso'],['Total disp.','totalDisp'],['Status','status',r=>`<span class="pill ${r.status==='Com falha'?'bad':'ok'}">${r.status}</span>`],['Subtotal por tipo/modelo','sub',r=>r.sub]],r=>`<button class="btn small secondary" onclick="formLaco('${r.id}')">✏️</button> <button class="btn small danger" onclick="del('lacos','${r.id}')">🗑</button>`)}</div>`}
function subTipos(match){let map={}; db.flms.filter(match).forEach(f=>{let k='Módulo • '+(f.modelo||'FLM');map[k]=(map[k]||0)+1}); db.equipamentos.filter(match).forEach(e=>{let k=(e.tipo||'Equipamento')+' • '+(e.modelo||'S/modelo');map[k]=(map[k]||0)+1}); return Object.entries(map).map(([k,v])=>`<span class="pill">${esc(k)}: ${v}</span>`).join(' ')||'-'}
function renderFlms(){let f=filters.flm||{};let paineis=unique(db.paineis.map(p=>p.nome));let lacos=unique(db.lacos.map(l=>l.nome));let pisos=unique(db.flms.map(x=>x.piso).concat(db.lacos.map(x=>x.piso),db.locais.map(x=>x.piso),db.equipamentos.map(x=>x.piso)));let lojas=unique(db.locais.map(x=>x.nome));let rows=db.flms.map(flm=>{let ps=db.portas.filter(p=>p.flmId===flm.id);let portas=ps.map(p=>`P${p.numero}: ${locName(p.localId)||'Sem vínculo'}${p.ligacao?' • '+esc(p.ligacao):''}`).join('<br>');let nomesPortas=ps.map(p=>locName(p.localId)).filter(Boolean).join(' | ');return {...flm,painel:paiName(flm.painelId),laco:lacName(flm.lacoId),portas,lojas:nomesPortas}}).filter(r=>(!f.painel||r.painel===f.painel)&&(!f.laco||r.laco===f.laco)&&(!f.piso||r.piso===f.piso)&&(!f.loja||up(r.lojas).includes(up(f.loja))));document.getElementById('flms').innerHTML=`<div class="card"><button class="btn" onclick="formFlm()">+ Criar novo FLM</button><div class="toolbar"><div class="field"><label>Painel</label><select onchange="filters.flm={...filters.flm,painel:this.value};render()">${selectOpts(paineis,f.painel)}</select></div><div class="field"><label>Laço</label><select onchange="filters.flm={...filters.flm,laco:this.value};render()">${selectOpts(lacos,f.laco)}</select></div><div class="field"><label>Piso</label><select onchange="filters.flm={...filters.flm,piso:this.value};render()">${selectOpts(pisos,f.piso)}</select></div><div class="field"><label>Loja / Área</label><select onchange="filters.flm={...filters.flm,loja:this.value};render()">${selectOpts(lojas,f.loja)}</select></div><button class="btn secondary" onclick="filters.flm={};render()">Limpar filtros</button></div></div><div class="card"><h3 class="sectionTitle">FLMs físicos e portas</h3>${table(rows,[['Painel','painel'],['Laço','laco'],['Piso','piso'],['Endereço FLM','endereco'],['Modelo','modelo'],['Portas / Ligações','portas',r=>r.portas||'-']],r=>`<button class="btn small secondary" onclick="formFlm('${r.id}')">✏️</button> <button class="btn small secondary" onclick="managePortas('${r.id}')">Portas</button> <button class="btn small danger" onclick="del('flms','${r.id}')">🗑</button>`)}</div>`}
function renderLocais(){let q=filters.locaisQ||'';let rows=db.locais.filter(l=>!q||JSON.stringify(l).toUpperCase().includes(up(q))).map(l=>({...l,painel:paiName(l.painelId),laco:lacName(l.lacoId),flm:flmById(l.flmId)?.endereco||'',porta:db.portas.find(p=>p.id===l.portaId)?.numero||'',qtd:db.equipamentos.filter(e=>e.localId===l.id).length}));document.getElementById('locais').innerHTML=`<div class="card"><button class="btn" onclick="formLocal()">+ Criar nova loja/área</button><div class="toolbar"><div class="field"><label>Busca</label><input value="${esc(q)}" data-filter-input="1" data-filter-path="locaisQ" data-focus-key="locaisBusca" placeholder="Loja, piso, painel, laço..."></div></div></div><div class="card"><h3 class="sectionTitle">Lojas / Áreas vinculadas às portas</h3>${table(rows,[['Nome','nome'],['Classificação','tipo'],['Painel','painel'],['Laço','laco'],['Piso','piso'],['FLM','flm'],['Porta','porta'],['Qtd. equip.','qtd'],['Status','status',r=>`<span class="pill ${statusClass(r.status)}">${esc(r.status)}</span>`]],r=>`<button class="btn small secondary" onclick="openLocal('${r.id}')">Histórico</button> <button class="btn small secondary" onclick="formLocal('${r.id}')">✏️</button> <button class="btn small danger" onclick="del('locais','${r.id}')">🗑</button>`)}</div>`}
function renderEquipamentos(){let f=filters.eq||{};let tipos=unique(db.equipamentos.map(e=>e.tipo));let modelos=unique(db.equipamentos.map(e=>e.modelo));let status=unique(db.equipamentos.map(e=>normalizeStatus(e.status)));let rows=db.equipamentos.filter(e=>(!f.painel||paiName(e.painelId)===f.painel)&&(!f.laco||lacName(e.lacoId)===f.laco)&&(!f.tipo||e.tipo===f.tipo)&&(!f.modelo||e.modelo===f.modelo)&&(!f.status||normalizeStatus(e.status)===f.status)&&(!f.q||JSON.stringify(e).toUpperCase().includes(up(f.q)))).map(e=>({...e,painel:paiName(e.painelId),laco:lacName(e.lacoId),loja:locName(e.localId),porta:db.portas.find(p=>p.id===e.portaId)?.numero||'',status:normalizeStatus(e.status)}));document.getElementById('equipamentos').innerHTML=`<div class="card"><button class="btn" onclick="formEquip()">+ Criar novo equipamento</button><div class="toolbar"><div class="field"><label>Painel</label><select onchange="filters.eq={...filters.eq,painel:this.value};render()">${selectOpts(unique(db.paineis.map(p=>p.nome)),f.painel)}</select></div><div class="field"><label>Laço</label><select onchange="filters.eq={...filters.eq,laco:this.value};render()">${selectOpts(unique(db.lacos.map(l=>l.nome)),f.laco)}</select></div><div class="field"><label>Tipo</label><select onchange="filters.eq={...filters.eq,tipo:this.value};render()">${selectOpts(tipos,f.tipo)}</select></div><div class="field"><label>Modelo</label><select onchange="filters.eq={...filters.eq,modelo:this.value};render()">${selectOpts(modelos,f.modelo)}</select></div><div class="field"><label>Status</label><select onchange="filters.eq={...filters.eq,status:this.value};render()">${selectOpts(status,f.status)}</select></div><div class="field"><label>Busca</label><input value="${esc(f.q)}" data-filter-input="1" data-filter-group="eq" data-filter-key="q" data-focus-key="equipBusca"></div></div></div><div class="card"><h3 class="sectionTitle">Equipamentos cadastrados — status operacional</h3>${table(rows,[['Painel','painel'],['Laço','laco'],['Piso','piso'],['Tipo','tipo'],['Endereço','endereco'],['Modelo','modelo'],['Loja/Área','loja'],['Porta','porta'],['Status','status',r=>`<span class="pill ${statusClass(r.status)}">${esc(r.status)}</span>`],['Última alteração','ultimaAlteracao']],r=>`<button class="btn small secondary" onclick="openEquip('${r.id}')">Histórico</button> <button class="btn small secondary" onclick="formEquip('${r.id}')">✏️</button> <button class="btn small danger" onclick="del('equipamentos','${r.id}')">🗑</button>`)}</div>`}
function renderFalhas(){let f=filters.falhas||{};let rows=db.falhas.filter(x=>(!f.status||normalizeStatus(x.status)===f.status)&&(!f.tipo||x.tipo===f.tipo)&&(!f.q||JSON.stringify(x).toUpperCase().includes(up(f.q)))).map(x=>({...x,painel:paiName(x.painelId),laco:lacName(x.lacoId),loja:locName(x.localId)}));document.getElementById('falhas').innerHTML=`<div class="card"><button class="btn" onclick="formFalha()">+ Registrar falha / operação</button><div class="toolbar"><div class="field"><label>Tipo</label><select onchange="filters.falhas={...filters.falhas,tipo:this.value};render()">${selectOpts(unique(db.falhas.map(x=>x.tipo)),f.tipo)}</select></div><div class="field"><label>Status</label><select onchange="filters.falhas={...filters.falhas,status:this.value};render()">${selectOpts(unique(db.falhas.map(x=>normalizeStatus(x.status))),f.status)}</select></div><div class="field"><label>Busca</label><input value="${esc(f.q)}" data-filter-input="1" data-filter-group="falhas" data-filter-key="q" data-focus-key="falhasBusca"></div></div></div><div class="card"><h3 class="sectionTitle">Histórico e falhas</h3>${table(rows,[['Data','data'],['Painel','painel'],['Laço','laco'],['Piso','piso'],['Tipo','tipo'],['Item','itemNome'],['Loja','loja'],['Status','status',r=>`<span class="pill ${statusClass(r.status)}">${esc(r.status)}</span>`],['Origem','origem'],['Motivo','motivo'],['Resolvida em','resolvidaEm']],r=>`<button class="btn small secondary" onclick="formFalha('${r.id}')">✏️</button> <button class="btn small danger" onclick="del('falhas','${r.id}')">🗑</button>`)}</div>`}

function planoCategorias(){return ['Substituição de material','Manutenção corretiva','Refazer teste','Reconfiguração de nome','Notificar logista']}
function planoPrioridades(){return ['Crítica','Alta','Média','Baixa']}
function planoResponsaveis(){return ['L3A Engenharia','Brigada','Logista','Shopping','Terceiro / Fornecedor']}
function prioridadePeso(p){return {'Crítica':1,'Alta':2,'Média':3,'Baixa':4}[p]||9}
function isFalhaStatus(s){s=up(normalizeStatus(s));return s.includes('FALHA')||s.includes('DESATIV')||s.includes('TESTE')}
function itemInfoFromFalha(f){
  let isFlm=String(f.itemId||'').startsWith('flm:'), item=isFlm?flmById(String(f.itemId).slice(4)):db.equipamentos.find(e=>e.id===f.itemId);
  let localId=f.localId||item?.localId||'';
  return {painel:paiName(f.painelId||item?.painelId),laco:lacName(f.lacoId||item?.lacoId),piso:f.piso||item?.piso||'',tipo:f.tipo||(isFlm?'Módulo':item?.tipo)||'',itemNome:f.itemNome||(isFlm?'Módulo ':'')+(item?.endereco||item?.modelo||''),local:locName(localId),localId,itemId:f.itemId||item?.id||'',falhaId:f.id||''}
}
function falhasAtivasParaPlano(){
  let map={}; db.falhas.slice().sort((a,b)=>String(a.data).localeCompare(String(b.data))).forEach(f=>{let k=f.itemId||f.localId||f.id; map[k]=f});
  return Object.values(map).filter(f=>isFalhaStatus(f.status));
}
function planoForFalha(fid){return db.planos.find(p=>p.falhaId===fid)}
function renderPlano(){
  let planos=db.planos||[];
  let q=(document.getElementById('plBuscaPlano')?.value||'').toUpperCase();
  let fcat=document.getElementById('plCat')?.value||'', fprio=document.getElementById('plPrio')?.value||'', fsit=document.getElementById('plSit')?.value||'', fresp=document.getElementById('plResp')?.value||'', ini=document.getElementById('plIni')?.value||'', fim=document.getElementById('plFim')?.value||'';
  let falhas=falhasAtivasParaPlano();
  let rows=[];

  // 1) Planos já criados: nunca somem da base, mesmo concluídos.
  planos.forEach(p=>{
    let f=db.falhas.find(x=>x.id===p.falhaId)||{};
    let inf=f.id?itemInfoFromFalha(f):{};
    rows.push({
      origemLinha:'Plano',
      falhaId:p.falhaId||'',
      planoId:p.id,
      prioridade:p.prioridade||'Média',
      painel:inf.painel||p.painel||'',
      laco:inf.laco||p.laco||'',
      piso:inf.piso||p.piso||'',
      local:inf.local||p.local||'',
      itemNome:inf.itemNome||p.item||'',
      statusFalha:f.status||p.statusFalha||'',
      categoria:p.categoria||'',
      responsavel:p.responsavel||'',
      desde:f.data||p.criadoEm||'',
      criadoEm:p.criadoEm||'',
      concluidoEm:p.concluidoEm||'',
      situacao:p.situacao||'Aberto',
      justificativa:p.justificativa||'',
      providencia:p.providencia||'',
      necessitaCompra:p.necessitaCompra?'Sim':'Não'
    });
  });

  // 2) Falhas ativas sem plano: aparecem para permitir criar plano.
  falhas.forEach(f=>{
    if(planoForFalha(f.id)) return;
    let inf=itemInfoFromFalha(f);
    rows.push({
      origemLinha:'Falha sem plano',
      falhaId:f.id,
      planoId:'',
      prioridade:'Média',
      painel:inf.painel||'',
      laco:inf.laco||'',
      piso:inf.piso||'',
      local:inf.local||'',
      itemNome:inf.itemNome||'',
      statusFalha:f.status||'',
      categoria:'',
      responsavel:'',
      desde:f.data||'',
      criadoEm:'',
      concluidoEm:'',
      situacao:'Sem plano',
      justificativa:f.motivo||f.obs||'',
      providencia:'',
      necessitaCompra:'Não'
    });
  });

  function inPeriodo(x){
    if(!ini&&!fim) return true;
    let datas=[x.desde,x.criadoEm,x.concluidoEm].filter(Boolean).map(String);
    return datas.some(d=>(!ini||d>=ini)&&(!fim||d<=fim+'T23:59'));
  }
  function situacaoPeso(s){return {'Sem plano':0,'Aberto':1,'Em andamento':2,'Concluído':3}[s]??9}
  let filtrados=rows.filter(x=>(!q||JSON.stringify(x).toUpperCase().includes(q))&&(!fcat||x.categoria===fcat)&&(!fprio||x.prioridade===fprio)&&(!fsit||x.situacao===fsit)&&(!fresp||x.responsavel===fresp)&&inPeriodo(x))
    .sort((a,b)=>situacaoPeso(a.situacao)-situacaoPeso(b.situacao)||prioridadePeso(a.prioridade)-prioridadePeso(b.prioridade)||String(a.desde||a.criadoEm).localeCompare(String(b.desde||b.criadoEm)));

  document.getElementById('plano').innerHTML=`
    <div class="card"><h3 class="sectionTitle">Filtros do Plano de Ação</h3><div class="toolbar"><div class="field"><label>Busca</label><input id="plBuscaPlano" placeholder="Loja, laço, item, motivo..." value="${esc(document.getElementById('plBuscaPlano')?.value||'')}"></div><div class="field"><label>Categoria</label><select id="plCat">${selectOpts(planoCategorias(),fcat)}</select></div><div class="field"><label>Prioridade</label><select id="plPrio">${selectOpts(planoPrioridades(),fprio)}</select></div><div class="field"><label>Situação</label><select id="plSit">${selectOpts(['Sem plano','Aberto','Em andamento','Concluído'],fsit)}</select></div><div class="field"><label>Responsável</label><select id="plResp">${selectOpts(planoResponsaveis(),fresp)}</select></div><div class="field"><label>Inicial</label><input id="plIni" type="date" value="${esc(ini)}"></div><div class="field"><label>Final</label><input id="plFim" type="date" value="${esc(fim)}"></div><button class="btn" onclick="renderPlano()">Filtrar</button></div><p class="msg warn">Planos concluídos permanecem registrados para relatório e rastreabilidade.</p></div>
    <div class="card"><h3 class="sectionTitle">Lançamentos e acompanhamento</h3>${table(filtrados,[['Prioridade','prioridade'],['Painel','painel'],['Laço','laco'],['Piso','piso'],['Loja / Área','local'],['Item','itemNome'],['Falha','statusFalha',r=>`<span class="pill ${statusClass(r.statusFalha)}">${esc(r.statusFalha)}</span>`],['Categoria','categoria'],['Responsável','responsavel'],['Desde','desde'],['Situação','situacao',r=>`<span class="pill ${r.situacao==='Concluído'?'ok':r.situacao==='Sem plano'?'warn':''}">${esc(r.situacao)}</span>`],['Concluído em','concluidoEm']],r=>`${r.planoId?`<button class="btn small secondary" onclick="formPlano('${r.planoId}')">✏️ Editar</button>`:`<button class="btn small" onclick="formPlano('', '${r.falhaId}')">+ Criar</button>`} ${r.planoId&&r.situacao!=='Concluído'?`<button class="btn small" onclick="concluirPlano('${r.planoId}')">✅ Concluir</button>`:''}`)}</div>`;
  ['plBuscaPlano','plCat','plPrio','plSit','plResp','plIni','plFim'].forEach(id=>{let el=document.getElementById(id); if(el)el.onchange=renderPlano});
}

function renderImportacao(){if(!can('importar')){document.getElementById('importacao').innerHTML='<div class="card"><h3 class="sectionTitle">Importação bloqueada</h3><p class="msg warn">Seu perfil não possui permissão para importar ou substituir base cadastral.</p></div>';return;}document.getElementById('importacao').innerHTML=`<div class="card"><h3 class="sectionTitle">Importar CSV / XLS / XLSX</h3><div class="toolbar"><div class="field"><label>Arquivo</label><input type="file" id="fileImp" accept=".csv,.xls,.xlsx"></div><div class="field"><label>Modo</label><select id="modeImp"><option value="diff">Somente diferença</option><option value="overwrite">Sobrescrever iguais preservando histórico</option><option value="replace">Apagar dados atuais e importar do zero</option></select></div></div><p class="msg warn"><b>Colunas esperadas:</b> Painel, Laço, Piso, Endereço FLM, Porta, Loja, Tipo, Modelo, Endereço, Fabricante, Status, Observação. O sistema valida antes de importar.</p><button class="btn secondary" onclick="previewImport()">Pré-visualizar / validar</button> <button class="btn" onclick="importFile()">Importar</button><div id="impMsg"></div><div id="previewBox"></div></div><div class="card"><h3 class="sectionTitle">Último diagnóstico de importação</h3>${lastImportHtml()}</div>`}
function lastImportHtml(){let r=db.imports.at(-1); if(!r)return '<p class="msg warn">Nenhuma importação executada.</p>'; let cards=Object.entries(r.stats).map(([k,v])=>`<div class="diagItem"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join(''); let rom=r.romannel?`<div class="msg ${r.romannel.ok?'ok':'err'}">ROMANNEL: ${esc(r.romannel.msg)}</div>`:''; return `${rom}<div class="diag">${cards}</div><h4>Erros / ignorados</h4>${table(r.errors||[],[['Linha','linha'],['Motivo','motivo'],['Registro','registro']])}`}
function renderExportacao(){document.getElementById('exportacao').innerHTML=`<div class="card"><h3 class="sectionTitle">Exportações</h3><div class="toolbar"><button class="btn" onclick="exportJson()">Base completa JSON</button><button class="btn" onclick="exportAllCsv()">Base completa CSV</button><button class="btn secondary" onclick="exportEntity('locais')">Lojas / Áreas</button><button class="btn secondary" onclick="exportEntity('flms')">FLMs</button><button class="btn secondary" onclick="exportEntity('equipamentos')">Equipamentos</button><button class="btn secondary" onclick="exportEntity('planos')">Plano de ação</button><button class="btn secondary" onclick="exportEntity('inconsistencias')">Inconsistências</button><button class="btn danger" onclick="if(confirm('Apagar toda base local?'))clearAll()">Limpar base local</button></div></div>`}
function reportData(){let ini=document.getElementById('repIni')?.value||'',fim=document.getElementById('repFim')?.value||'',painel=document.getElementById('repPainel')?.value||''; let fal=db.falhas.filter(f=>(!painel||paiName(f.painelId)===painel)&&(!ini||f.data>=ini)&&(!fim||f.data<=fim+'T23:59')); let lanc=fal.filter(f=>up(f.status).includes('FALHA')).length; let resol=fal.filter(f=>up(f.status).includes('OPER')||f.resolvidaEm).length; let byPainel={}; db.paineis.filter(p=>!painel||p.nome===painel).forEach(p=>{byPainel[p.nome]={op:0,falha:0,tipos:{}}}); db.equipamentos.forEach(e=>{let pn=paiName(e.painelId); if(!byPainel[pn])return; let st=up(e.status).includes('FALHA')?'falha':'op'; byPainel[pn][st]++; byPainel[pn].tipos[e.tipo]=(byPainel[pn].tipos[e.tipo]||{op:0,falha:0}); byPainel[pn].tipos[e.tipo][st]++}); db.flms.forEach(f=>{let pn=paiName(f.painelId); if(!byPainel[pn])return; let st=up(f.status).includes('FALHA')?'falha':'op'; byPainel[pn][st]++; byPainel[pn].tipos['Módulo']=(byPainel[pn].tipos['Módulo']||{op:0,falha:0}); byPainel[pn].tipos['Módulo'][st]++}); return {ini,fim,painel,fal,lanc,resol,byPainel}}
function renderRelatorios(){let pain=unique(db.paineis.map(p=>p.nome));document.getElementById('relatorios').innerHTML=`<div class="card hidePrint"><h3 class="sectionTitle">Central de relatórios</h3><p class="msg warn">Escolha o período e o painel. Você pode apenas visualizar na tela ou gerar PDF para envio ao cliente.</p><div class="toolbar"><div class="field"><label>Data inicial</label><input type="date" id="repIni"></div><div class="field"><label>Data final</label><input type="date" id="repFim"></div><div class="field"><label>Painel</label><select id="repPainel">${selectOpts(pain)}</select></div><button class="btn" onclick="drawReport()">Visualizar relatório</button><button class="btn secondary" onclick="drawReport();setTimeout(()=>window.print(),250)">Gerar PDF</button></div></div><div id="reportOut" class="printArea"></div>`}
function pct(v,t){return t?Math.round((v/t)*100):0}
function chartBarRows(rows,max){return `<div class="chartBars">${rows.map(r=>`<div class="chartLine"><b>${esc(r.label)}</b><div class="chartTrack"><i class="${r.cls||''}" style="width:${Math.max(2,pct(r.value,max))}%"></i></div><strong>${r.value}</strong></div>`).join('')}</div>`}
function donutChart(ok,bad){let total=ok+bad,deg=total?Math.round((bad/total)*360):0;return `<div class="donutWrap"><div class="donut" style="--deg:${deg}deg"></div><div class="legend"><span><i class="dot ok"></i>Em operação: ${ok}</span><span><i class="dot bad"></i>Em falha: ${bad}</span><span>Total: ${total}</span></div></div>`}

function reportPlanoBlock(r){let ini=r.ini||'',fim=r.fim||'';let plans=(db.planos||[]).filter(p=>(!r.painel||p.painel===r.painel)&&(!ini||String(p.criadoEm||p.atualizadoEm)>=ini)&&(!fim||String(p.criadoEm||p.atualizadoEm)<=fim+'T23:59'));let ab=plans.filter(p=>p.situacao!=='Concluído').length, co=plans.filter(p=>p.situacao==='Concluído').length;let cat=planoCategorias().map(c=>({label:c,value:plans.filter(p=>p.categoria===c).length})).filter(x=>x.value);let pend=plans.filter(p=>p.situacao!=='Concluído').sort((a,b)=>prioridadePeso(a.prioridade)-prioridadePeso(b.prioridade)||String(a.criadoEm).localeCompare(String(b.criadoEm))).slice(0,20);return `<div class="reportBlock"><h3>Plano de Ação</h3><div class="grid">${kpi('Planos criados',plans.length)}${kpi('Planos concluídos',co)}${kpi('Planos em aberto',ab)}${kpi('Pendências críticas',plans.filter(p=>p.prioridade==='Crítica'&&p.situacao!=='Concluído').length)}</div><div class="chartGrid"><div class="chartPanel"><h4>Plano por categoria</h4>${chartBarRows(cat,Math.max(1,...cat.map(x=>x.value)))}</div><div class="chartPanel"><h4>Situação dos planos</h4>${chartBarRows([{label:'Aberto',value:plans.filter(p=>p.situacao==='Aberto').length},{label:'Em andamento',value:plans.filter(p=>p.situacao==='Em andamento').length},{label:'Concluído',value:co,cls:'ok'}],Math.max(1,plans.length))}</div></div><h4>Pendências abertas</h4>${table(pend,[['Prioridade','prioridade'],['Local','local'],['Item','item'],['Categoria','categoria'],['Responsável','responsavel'],['Situação','situacao'],['Criado em','criadoEm']])}</div>`}

function drawReport(){let r=reportData(); let geral=Object.values(r.byPainel).reduce((a,d)=>{a.op+=d.op;a.falha+=d.falha;Object.entries(d.tipos).forEach(([t,v])=>{a.tipos[t]=a.tipos[t]||{op:0,falha:0};a.tipos[t].op+=(v.op||0);a.tipos[t].falha+=(v.falha||0)});return a},{op:0,falha:0,tipos:{}});let maxPain=Math.max(1,...Object.values(r.byPainel).map(d=>d.op+d.falha));let painelChart=chartBarRows(Object.entries(r.byPainel).map(([pn,d])=>({label:pn,value:d.op+d.falha})),maxPain);let tipoRows=Object.entries(geral.tipos).map(([t,v])=>({label:t,value:(v.op||0)+(v.falha||0)}));let tipoChart=chartBarRows(tipoRows,Math.max(1,...tipoRows.map(x=>x.value)));let painBlocks=Object.entries(r.byPainel).map(([pn,d])=>{let lacos=db.lacos.filter(l=>paiName(l.painelId)===pn).map(l=>{let eq=db.equipamentos.filter(e=>e.lacoId===l.id);let fl=db.flms.filter(f=>f.lacoId===l.id);let tipos={}; eq.forEach(e=>{tipos[e.tipo]=tipos[e.tipo]||{op:0,falha:0}; tipos[e.tipo][up(e.status).includes('FALHA')?'falha':'op']++}); fl.forEach(f=>{tipos['Módulo']=tipos['Módulo']||{op:0,falha:0}; tipos['Módulo'][up(f.status).includes('FALHA')?'falha':'op']++});let totalL=Object.values(tipos).reduce((a,v)=>a+(v.op||0)+(v.falha||0),0);let falhaL=Object.values(tipos).reduce((a,v)=>a+(v.falha||0),0);return `<div class="reportBlock"><b>${esc(l.nome)} — ${totalL} itens / ${falhaL} em falha</b><div class="premiumTable">${table(Object.entries(tipos).map(([t,v])=>({tipo:t,operacao:v.op||0,falha:v.falha||0,total:(v.op||0)+(v.falha||0)})),[['Tipo','tipo'],['Em operação','operacao'],['Falha','falha'],['Total','total']])}</div></div>`}).join('');let rowsTipo=Object.entries(d.tipos).map(([t,v])=>({tipo:t,operacao:v.op||0,falha:v.falha||0,total:(v.op||0)+(v.falha||0)}));return `<div class="reportBlock"><h3>${esc(pn)}</h3><div class="miniChart"><div class="chartCard"><h4>Em operação</h4><b>${d.op}</b></div><div class="chartCard"><h4>Em falha</h4><b>${d.falha}</b></div><div class="chartCard"><h4>Disponibilidade</h4><b>${pct(d.op,d.op+d.falha)}%</b></div></div><div class="chartPanel"><h4>Status do painel</h4>${donutChart(d.op,d.falha)}</div><h4>Compilado por tipo</h4><div class="premiumTable">${table(rowsTipo,[['Tipo','tipo'],['Em operação','operacao'],['Falha','falha'],['Total','total']])}</div><h4>Por laço</h4>${lacos}</div>`}).join('');document.getElementById('reportOut').innerHTML=`<div class="card"><div class="reportCover"><h2>Relatório Técnico SDAI Bosch</h2><p>Setup Soluções Integradas • Diagnóstico operacional do sistema de detecção e alarme de incêndio</p><div class="reportMeta"><span>Período: ${esc(r.ini||'início')} até ${esc(r.fim||'atual')}</span><span>Painel: ${esc(r.painel||'Todos')}</span><span>Gerado em: ${now()}</span></div></div><div class="grid">${kpi('Falhas lançadas no período',r.lanc)}${kpi('Falhas resolvidas no período',r.resol)}${kpi('Itens em operação',geral.op)}${kpi('Itens em falha',geral.falha)}${kpi('Disponibilidade',pct(geral.op,geral.op+geral.falha)+'%')}${kpi('Total avaliado',geral.op+geral.falha)}</div><div class="chartGrid"><div class="chartPanel"><h4>Status geral do sistema</h4>${donutChart(geral.op,geral.falha)}</div><div class="chartPanel"><h4>Dispositivos por tipo</h4>${tipoChart}</div><div class="chartPanel"><h4>Total por painel</h4>${painelChart}</div><div class="chartPanel"><h4>Movimentação no período</h4>${chartBarRows([{label:'Falhas lançadas',value:r.lanc,cls:'bad'},{label:'Falhas resolvidas',value:r.resol,cls:'ok'}],Math.max(1,r.lanc,r.resol))}</div></div><div class="reportBlock"><h3>Compilado geral por tipo</h3><div class="premiumTable">${table(Object.entries(geral.tipos).map(([t,v])=>({tipo:t,operacao:v.op||0,falha:v.falha||0,total:(v.op||0)+(v.falha||0)})),[['Tipo','tipo'],['Em operação','operacao'],['Falha','falha'],['Total','total']])}</div></div>${painBlocks}${reportPlanoBlock(r)}<div class="reportBlock"><h3>Conclusão técnica</h3><p>Relatório compilado sem listagem nominal de todas as lojas, priorizando indicadores por painel, laço, tipo de dispositivo e status operacional. A base segue a estrutura Empreendimento → Painel → Laço → FLM físico → Porta → Loja/Área → Equipamentos → Histórico de falhas.</p></div><div class="reportFooter"><span>Setup Soluções Integradas</span><span>Documento técnico gerado pelo SDAI Bosch Manager</span></div></div>`}


function currentUserId(){return localStorage.getItem(KEY+':currentUserId') || (db.usuarios&&db.usuarios[0]&&db.usuarios[0].id) || 'admin-default'}
function currentUser(){let u=(db.usuarios||[]).find(x=>x.id===currentUserId()) || (db.usuarios||[])[0]; if(!u){u={id:'admin-default',nome:'Administrador',email:'admin@local',perfil:'Administrador',ativo:'Sim'}; db.usuarios=[u]} return u}
function perfilAtual(){return currentUser().perfil||'Administrador'}
function can(action){const p=perfilAtual(); if(p==='Administrador')return true; if(p==='Supervisor')return !['importar','cadastro'].includes(action); if(p==='Operacional')return ['operacao','status','planoStatus','visualizar'].includes(action); return false}
function requireAccess(action,msg){if(can(action))return true; alert(msg||'Seu perfil não possui permissão para esta ação.'); return false}
function applyBrand(){const cfg=db.config||{}; const name=cfg.appName||'Contratos L3A'; const sub=cfg.subtitle||'SDAI • Contratos • Operação'; const logo=cfg.logoData||''; const bn=document.getElementById('brandName'), bs=document.getElementById('brandSub'), bl=document.getElementById('brandLogo'); if(bn)bn.textContent=name; if(bs)bs.textContent=sub; if(bl){ if(logo){bl.classList.add('hasImg'); bl.style.backgroundImage=`url(${logo})`; bl.textContent='';} else {bl.classList.remove('hasImg'); bl.style.backgroundImage=''; bl.textContent='L3A';}} const pb=document.getElementById('profileBadge'); const u=currentUser(); if(pb){pb.innerHTML=`<b>${esc(u.nome||'Usuário')}</b><span>${esc(u.perfil||'Administrador')}</span>`} const tu=document.getElementById('topUser'); if(tu){tu.innerHTML=`<b>${esc(u.nome||'Usuário')}</b>${esc(u.perfil||'Administrador')} • Online`}}
function applyRoleUI(){const p=perfilAtual(); document.querySelectorAll('[data-role-action]').forEach(el=>{const a=el.dataset.roleAction; const ok=can(a); el.classList.toggle('disabledByRole',!ok); el.title=ok?'':'Sem permissão para '+a});}
function logoToBase64(file){return new Promise((res,rej)=>{const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file)})}
async function saveIdentity(){db.config=db.config||{}; db.config.appName=n(document.getElementById('cfgAppName').value)||'Contratos L3A'; db.config.subtitle=n(document.getElementById('cfgSub').value)||'SDAI • Contratos • Operação'; const f=document.getElementById('cfgLogo').files[0]; if(f) db.config.logoData=await logoToBase64(f); markDirty('identidade'); render();}
function saveEmpresaCfg(){db.config=db.config||{}; db.config.cliente=n(document.getElementById('cfgCliente').value); db.config.empreendimento=n(document.getElementById('cfgEmpreendimento').value); db.config.responsavelTecnico=n(document.getElementById('cfgRespTecnico').value); markDirty('configurações'); render();}
function selectCurrentUser(v){localStorage.setItem(KEY+':currentUserId',v); render()}
function addUser(){if(!requireAccess('cadastro','Somente administrador pode cadastrar usuários.'))return; openModal(`<h2>Novo usuário</h2><div class="formGrid"><div class="field"><label>Nome</label><input id="uNome"></div><div class="field"><label>E-mail</label><input id="uEmail"></div><div class="field"><label>Perfil</label><select id="uPerfil"><option>Administrador</option><option>Supervisor</option><option>Operacional</option></select></div><div class="field"><label>Ativo</label><select id="uAtivo"><option>Sim</option><option>Não</option></select></div></div><br><button class="btn" onclick="saveUser('')">Salvar usuário</button> <button class="btn secondary" onclick="closeModal()">Cancelar</button>`)}
function editUser(i){if(!requireAccess('cadastro','Somente administrador pode editar usuários.'))return; let u=(db.usuarios||[]).find(x=>x.id===i)||{}; openModal(`<h2>Editar usuário</h2><div class="formGrid"><div class="field"><label>Nome</label><input id="uNome" value="${esc(u.nome)}"></div><div class="field"><label>E-mail</label><input id="uEmail" value="${esc(u.email)}"></div><div class="field"><label>Perfil</label><select id="uPerfil">${['Administrador','Supervisor','Operacional'].map(p=>`<option ${u.perfil===p?'selected':''}>${p}</option>`).join('')}</select></div><div class="field"><label>Ativo</label><select id="uAtivo"><option ${u.ativo!=='Não'?'selected':''}>Sim</option><option ${u.ativo==='Não'?'selected':''}>Não</option></select></div></div><br><button class="btn" onclick="saveUser('${i}')">Salvar usuário</button> <button class="btn secondary" onclick="closeModal()">Cancelar</button>`)}
function saveUser(i){let u=i?(db.usuarios||[]).find(x=>x.id===i):{id:id(),criadoEm:isoNow()}; u.nome=n(uNome.value);u.email=n(uEmail.value);u.perfil=uPerfil.value;u.ativo=uAtivo.value; if(!i){db.usuarios=db.usuarios||[];db.usuarios.push(u)} closeModal(); markDirty('usuários'); render()}
function delUser(i){if(!requireAccess('cadastro','Somente administrador pode excluir usuários.'))return; if(!confirm('Excluir usuário?'))return; db.usuarios=(db.usuarios||[]).filter(x=>x.id!==i); markDirty('usuários'); render()}
function renderUsuarios(){const el=document.getElementById('usuarios'); if(!el)return; const us=db.usuarios||[]; el.innerHTML=`<div class="card"><h3 class="sectionTitle">Usuário ativo</h3><div class="toolbar"><div class="field"><label>Selecionar usuário da sessão</label><select onchange="selectCurrentUser(this.value)">${us.map(u=>`<option value="${u.id}" ${u.id===currentUserId()?'selected':''}>${esc(u.nome)} — ${esc(u.perfil)}</option>`).join('')}</select></div><button class="btn" onclick="addUser()" data-role-action="cadastro">+ Criar usuário</button></div><p class="msg warn">Controle local de perfis para operação interna. Na próxima etapa pode ser vinculado a login Google.</p></div><div class="card"><h3 class="sectionTitle">Perfis de acesso</h3><div class="userGrid"><div class="accessCard"><h4>Administrador</h4><p class="accessMuted">Acesso total: importar, exportar, alterar cadastros, operar falhas, plano de ação e sistema.</p></div><div class="accessCard"><h4>Supervisor</h4><p class="accessMuted">Pode operar e consultar tudo, mas não importa base nem altera cadastros técnicos.</p></div><div class="accessCard"><h4>Operacional</h4><p class="accessMuted">Pode atualizar status, lançar falhas/operação e observações. Não altera nomes nem cadastros.</p></div><div class="accessCard"><h4>Cliente</h4><p class="accessMuted">Preparado para futuro acesso somente leitura.</p></div></div></div><div class="card"><h3 class="sectionTitle">Usuários cadastrados</h3>${table(us,[['Nome','nome'],['E-mail','email'],['Perfil','perfil'],['Ativo','ativo']],u=>`<button class="btn small secondary" onclick="editUser('${u.id}')">✏️</button> <button class="btn small danger" onclick="delUser('${u.id}')">🗑</button>`)}</div>`}
function renderSistema(){
  const el=document.getElementById('sistema'); if(!el)return;
  const c=syncCfg();
  el.innerHTML=`
  <div class="card">
    <h3 class="sectionTitle">Banco de Dados Google</h3>
    <div class="systemStatusGrid">
      <div class="systemBox"><small>Status</small><b>${c.configured?'Conectado':'Não configurado'}</b></div>
      <div class="systemBox"><small>Última sincronização</small><b>${esc(c.lastSync||'Nunca')}</b></div>
      <div class="systemBox"><small>Fila local</small><b>${c.dirty?'Pendente':'0'}</b></div>
    </div>
    <p class="msg warn">O banco fica estruturado por abas no Google Sheets: Painéis, Laços, FLMs, Portas, Lojas/Áreas, Equipamentos, Falhas, Plano de Ação, Histórico, Importações e Usuários.</p>
    <div class="toolbar">
      <button class="btn" onclick="setupGoogle()">Configurar / validar banco</button>
      <button class="btn secondary" onclick="syncNow(true)">Sincronizar agora</button>
      <button class="btn secondary" onclick="loadGoogle()">Carregar do Google</button>
      ${c.sheetUrl?`<a class="btn secondary" href="${esc(c.sheetUrl)}" target="_blank" style="text-decoration:none">Abrir planilha</a>`:''}
    </div>
  </div>
  <div class="card">
    <h3 class="sectionTitle">Sincronização automática</h3>
    <div class="toolbar">
      <div class="field"><label>Ativar autosync</label><select onchange="setAutoEnabled(this.value==='sim')"><option value="sim" ${c.auto?'selected':''}>Sim</option><option value="nao" ${!c.auto?'selected':''}>Não</option></select></div>
      <div class="field"><label>Intervalo de gravação</label><select onchange="setAutoInterval(this.value)">
        ${[15,30,60,120,300].map(s=>`<option value="${s}" ${Number(c.intervalSec)===s?'selected':''}>${s<60?s+' segundos':(s/60)+' minuto(s)'}</option>`).join('')}
      </select></div>
    </div>
    <p class="note">A cada alteração relevante o sistema marca a base como pendente e sincroniza no intervalo configurado.</p>
  </div>`
}

function renderConfiguracoes(){
  const el=document.getElementById('configuracoes'); if(!el)return;
  const cfg=db.config||{};
  el.innerHTML=`
  <div class="card">
    <h3 class="sectionTitle">Identidade visual</h3>
    <div class="formGrid">
      <div class="field"><label>Nome exibido no menu</label><input id="cfgAppName" value="${esc(cfg.appName||'Contratos L3A')}"></div>
      <div class="field"><label>Subtítulo</label><input id="cfgSub" value="${esc(cfg.subtitle||'SDAI • Contratos • Operação')}"></div>
      <div class="field"><label>Logotipo / imagem do menu</label><input type="file" id="cfgLogo" accept="image/*"></div>
      <div class="field"><label>&nbsp;</label><button class="btn" onclick="saveIdentity()">Salvar identidade visual</button></div>
    </div>
    <div class="logoPreviewWrap">${cfg.logoData?`<img src="${cfg.logoData}" alt="Logo" class="logoPreview">`:`<div class="logoPreview empty">L3A</div>`}<p class="note">A imagem fica armazenada localmente e sincroniza com o banco Google junto com as configurações.</p></div>
  </div>
  <div class="card">
    <h3 class="sectionTitle">Dados do cliente/empreendimento</h3>
    <div class="formGrid">
      <div class="field"><label>Cliente</label><input id="cfgCliente" value="${esc(cfg.cliente||'Shopping Pantanal')}"></div>
      <div class="field"><label>Empreendimento</label><input id="cfgEmpreendimento" value="${esc(cfg.empreendimento||'Pantanal Shopping')}"></div>
      <div class="field"><label>Responsável técnico</label><input id="cfgRespTecnico" value="${esc(cfg.responsavelTecnico||'Eng. Hélio Hayashida')}"></div>
      <div class="field"><label>&nbsp;</label><button class="btn secondary" onclick="saveEmpresaCfg()">Salvar dados</button></div>
    </div>
  </div>`
}

function renderBackup(){
  const el=document.getElementById('backup'); if(!el)return;
  el.innerHTML=`<div class="card"><h3 class="sectionTitle">Backup e restauração</h3><p class="msg warn">Backup local é uma segurança adicional. O banco principal continua sendo o Google Sheets.</p><div class="toolbar"><button class="btn" onclick="exportJson()">Exportar JSON local</button><button class="btn secondary" onclick="exportAllCsv()">Exportar CSV local</button><button class="btn secondary" onclick="document.getElementById('restoreJsonInput').click()">Restaurar JSON local</button><input type="file" id="restoreJsonInput" accept="application/json,.json" style="display:none" onchange="restoreBackupFile(this.files[0])"></div></div>`
}

function renderLogs(){
  const el=document.getElementById('logs'); if(!el)return;
  const rows=(db.historico||[]).slice(-200).reverse();
  el.innerHTML=`<div class="card"><h3 class="sectionTitle">Logs e auditoria</h3><p class="note">Últimos registros de alterações e sincronização.</p>${table(rows,[['Data','data'],['Usuário','usuario'],['Entidade','entidade'],['Ação','acao'],['Descrição','descricao']])}</div>`
}

function renderSobre(){
  const el=document.getElementById('sobre'); if(!el)return;
  const u=currentUser(); const c=syncCfg();
  el.innerHTML=`<div class="card"><h3 class="sectionTitle">Sobre o sistema</h3><div class="grid">${kpi('Versão','5.4 UX')}${kpi('Usuário',u.nome||'Usuário')}${kpi('Perfil',u.perfil||'Administrador')}${kpi('Banco',c.configured?'Conectado':'Local')}</div><p class="msg warn">Arquitetura definida: GitHub Pages + Google Apps Script + Google Sheets. Uso interno para gestão operacional de contratos, SDAI e plano de ação.</p></div>`
}


async function readRows(){let f=document.getElementById('fileImp').files[0]; if(!f)throw new Error('Selecione um arquivo.'); let ext=f.name.split('.').pop().toLowerCase(); let data=await f.arrayBuffer(); if(ext==='csv'){let txt=new TextDecoder('utf-8').decode(data); return parseCSV(txt)} if(typeof XLSX==='undefined')throw new Error('Biblioteca XLSX não carregada. Para XLS/XLSX, abra com internet ou use CSV.'); let wb=XLSX.read(data,{type:'array'}); let rows=[]; wb.SheetNames.forEach(sn=>{rows=rows.concat(XLSX.utils.sheet_to_json(wb.Sheets[sn],{defval:''}))}); return rows}
function parseCSV(txt){let sep=(txt.split('\n')[0].match(/;/g)||[]).length>=(txt.split('\n')[0].match(/,/g)||[]).length?';':','; let lines=txt.split(/\r?\n/).filter(x=>x.trim()); if(!lines.length)return []; let headers=splitCSV(lines[0],sep); return lines.slice(1).map(l=>{let vals=splitCSV(l,sep),o={};headers.forEach((h,i)=>o[h]=vals[i]||'');return o})}
function splitCSV(line,sep){let out=[],cur='',q=false; for(let i=0;i<line.length;i++){let ch=line[i]; if(ch==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(ch===sep&&!q){out.push(cur);cur=''}else cur+=ch} out.push(cur); return out}
async function previewImport(){try{let rows=await readRows(); let v=validateRows(rows); document.getElementById('previewBox').innerHTML=`<div class="msg ${v.ok?'ok':'err'}">${v.ok?'Arquivo validado':'Arquivo com inconsistências'}: ${rows.length} registros lidos.</div>${table(rows.slice(0,20),Object.keys(rows[0]||{}).map(k=>[k,k]))}${v.errors.length?table(v.errors,[['Linha','linha'],['Motivo','motivo'],['Registro','registro']]):''}`}catch(e){document.getElementById('impMsg').innerHTML=`<div class="msg err">${esc(e.message)}</div>`}}
function validateRows(rows){let errors=[]; if(!rows.length)errors.push({linha:0,motivo:'Arquivo vazio',registro:''}); let cols=Object.keys(rows[0]||{}).map(normKey); ['PAINEL','LACO','TIPO','MODELO'].forEach(c=>{if(!cols.some(x=>x.includes(c)))errors.push({linha:1,motivo:'Coluna obrigatória ausente: '+c,registro:Object.keys(rows[0]||{}).join(', ')})}); return {ok:!errors.length,errors}}
async function importFile(){try{let rows=await readRows(); let mode=document.getElementById('modeImp').value; let v=validateRows(rows); if(!v.ok)throw new Error(v.errors.map(e=>e.motivo).join(' | ')); if(mode==='replace')db=emptyDB(); let stats={registrosLidos:rows.length,paineis:0,lacos:0,flms:0,portas:0,lojasCriadas:0,areasTecnicas:0,areasComuns:0,detectores:0,acionadores:0,modulos:0,ignorados:0}; let errors=[],rom={ok:false,msg:'Não localizada no arquivo.'}; rows.forEach((r,i)=>{let linha=i+2; try{let painel=get(r,['Painel','Central']); let laco=get(r,['Laço','Laco','Loop']); let piso=get(r,['Piso','Pavimento']); let endFlm=get(r,['Endereço FLM','Endereco FLM','FLM','Módulo','Modulo']); let porta=get(r,['Porta','Canal','Porta / Ligação','Porta Ligação']); let loja=get(r,['Loja','Local','Área','Area','Ambiente']); let tipo=get(r,['Tipo','Classificação','Classificacao']); let modelo=get(r,['Modelo','Dispositivo','Nome do dispositivo']); let endereco=get(r,['Endereço','Endereco','Zona','Endereço Equipamento']); let fab=get(r,['Fabricante']); let status=normalizeStatus(get(r,['Status'])||'Em operação'); let obs=get(r,['Observação','Observacao','Obs']); if(!painel||!laco){stats.ignorados++; errors.push({linha,motivo:'Painel ou laço ausente',registro:JSON.stringify(r)}); return} let p0=db.paineis.length,l0=db.lacos.length,f0=db.flms.length,pt0=db.portas.length,loc0=db.locais.length; let p=ensurePanel(painel); let l=ensureLaco(p.id,laco,piso); stats.paineis+=db.paineis.length>p0?1:0; stats.lacos+=db.lacos.length>l0?1:0; let classe=classifyDevice(modelo,tipo,loja); let isModulo=classe==='Módulo'; let flm=null,portaObj=null,local=null; if(isModulo||endFlm){flm=ensureFlm(p.id,l.id,endFlm||endereco||modelo,modelo||'FLM',piso); stats.flms+=db.flms.length>f0?1:0; stats.modulos+=db.flms.length>f0?1:0; if(porta||loja){portaObj=ensurePorta(flm.id,porta||'1'); stats.portas+=db.portas.length>pt0?1:0} if(loja){local=ensureLocal(loja,localClass(loja),p.id,l.id,piso,flm.id,portaObj?.id); if(portaObj)local.portaId=portaObj.id, portaObj.localId=local.id; let created=db.locais.length>loc0; if(created){if(local.tipo==='Loja')stats.lojasCriadas++; if(local.tipo==='Área Técnica')stats.areasTecnicas++; if(local.tipo==='Área Comum')stats.areasComuns++} if(up(loja).includes('ROMANNEL'))rom={ok:true,msg:`Importada/vinculada ao ${painel} • ${laco} • FLM ${flm.endereco} • Porta ${portaObj?.numero||porta||'1'}.`}} } else { if(loja){local=db.locais.find(x=>up(x.nome)===up(loja)); if(!local){let areaTipo=equipAreaClass(loja,modelo,tipo); if(areaTipo){local=ensureLocal(loja,areaTipo,p.id,l.id,piso,'',''); if(up(loja).includes('ROMANNEL'))rom={ok:false,msg:'ROMANNEL apareceu em registro de equipamento/área. Não foi criada como loja; foi tratada como '+areaTipo+'.'} } else { if(up(loja).includes('ROMANNEL'))rom={ok:false,msg:'ROMANNEL apareceu em registro de equipamento, mas loja só é criada por porta de FLM. Registro não criou loja.'}; errors.push({linha,motivo:'Equipamento não cria loja. Loja informada não existe por porta de FLM: '+loja,registro:JSON.stringify(r)}) }}} let res=ensureEquip({painelId:p.id,lacoId:l.id,piso,tipo:classe,endereco:endereco||get(r,['Zona'])||'',modelo,fabricante:fab,localId:local?.id||'',flmId:flm?.id||'',portaId:portaObj?.id||'',status,ultimaAlteracao:isoNow(),obs},mode); if(res.created){if(classe.includes('Detector'))stats.detectores++; else if(classe.includes('Acionador'))stats.acionadores++;} }
      }catch(e){stats.ignorados++; errors.push({linha,motivo:e.message,registro:JSON.stringify(r)})}}); stats.lojasCriadas=db.locais.filter(x=>x.tipo==='Loja').length; stats.areasTecnicas=db.locais.filter(x=>x.tipo==='Área Técnica').length; stats.areasComuns=db.locais.filter(x=>x.tipo==='Área Comum').length; stats.detectores=db.equipamentos.filter(x=>x.tipo.includes('Detector')).length; stats.acionadores=db.equipamentos.filter(x=>x.tipo.includes('Acionador')).length; stats.modulos=db.flms.length; stats.flms=db.flms.length; stats.portas=db.portas.length; stats.paineis=db.paineis.length; stats.lacos=db.lacos.length; stats.ignorados=errors.length; db.inconsistencias=errors; db.imports.push({data:isoNow(),stats,errors,romannel:rom}); persistLocal(); markDirty('importação'); render(); document.getElementById('impMsg').innerHTML=`<div class="msg ok">Importação concluída. DFO/FAP/ACM/DM210/SM210/FMC são importados como equipamentos vinculados a Área Comum/Técnica, sem criar loja.</div>`}catch(e){document.getElementById('impMsg').innerHTML=`<div class="msg err">${esc(e.message)}</div>`}}
function openModal(html){document.getElementById('drawer').innerHTML=html;document.getElementById('modal').classList.add('show')} function closeModal(){document.getElementById('modal').classList.remove('show')} document.getElementById('modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()})
function formPainel(i=''){if(!requireAccess('cadastro','Seu perfil não pode criar/editar painéis.'))return; let o=db.paineis.find(x=>x.id===i)||{};openModal(`<h2>${i?'Editar':'Novo'} Painel</h2><div class="formGrid"><div class="field"><label>Nome</label><input id="mNome" value="${esc(o.nome)}"></div><div class="field"><label>Modelo</label><input id="mModelo" value="${esc(o.modelo)}"></div><div class="field"><label>Localização</label><input id="mLoc" value="${esc(o.localizacao)}"></div><div class="field"><label>Observação</label><input id="mObs" value="${esc(o.obs)}"></div></div><br><button class="btn" onclick="savePainel('${i}')">Salvar</button> <button class="btn secondary" onclick="closeModal()">Cancelar</button>`)}
function savePainel(i){let o=i?db.paineis.find(x=>x.id===i):{id:id()}; o.nome=n(mNome.value);o.modelo=n(mModelo.value);o.localizacao=n(mLoc.value);o.obs=n(mObs.value); if(!i)db.paineis.push(o); closeModal(); save()}
function formLaco(i=''){if(!requireAccess('cadastro','Seu perfil não pode criar/editar laços.'))return; let o=db.lacos.find(x=>x.id===i)||{};openModal(`<h2>${i?'Editar':'Novo'} Laço</h2><div class="formGrid"><div class="field"><label>Painel</label><select id="mPainel">${db.paineis.map(p=>`<option value="${p.id}" ${p.id===o.painelId?'selected':''}>${esc(p.nome)}</option>`)}</select></div><div class="field"><label>Laço</label><input id="mNome" value="${esc(o.nome)}"></div><div class="field"><label>Piso</label><input id="mPiso" value="${esc(o.piso)}"></div><div class="field"><label>Obs</label><input id="mObs" value="${esc(o.obs)}"></div></div><br><button class="btn" onclick="saveLaco('${i}')">Salvar</button> <button class="btn secondary" onclick="closeModal()">Cancelar</button>`)}
function saveLaco(i){let o=i?db.lacos.find(x=>x.id===i):{id:id()}; o.painelId=mPainel.value;o.nome=n(mNome.value);o.piso=n(mPiso.value);o.obs=n(mObs.value); if(!i)db.lacos.push(o); closeModal(); save()}
function formFlm(i=''){if(!requireAccess('cadastro','Seu perfil não pode criar/editar FLMs.'))return; let o=db.flms.find(x=>x.id===i)||{};let pisos=unique(db.flms.map(x=>x.piso).concat(db.lacos.map(x=>x.piso),db.locais.map(x=>x.piso),db.equipamentos.map(x=>x.piso)));let modelos=unique(db.flms.map(x=>x.modelo));if(o.piso&&!pisos.includes(o.piso))pisos.push(o.piso);if(o.modelo&&!modelos.includes(o.modelo))modelos.push(o.modelo);openModal(`<h2>${i?'Editar':'Novo'} FLM físico</h2><div class="formGrid"><div class="field"><label>Painel</label><select id="mPainel">${db.paineis.map(p=>`<option value="${p.id}" ${p.id===o.painelId?'selected':''}>${esc(p.nome)}</option>`)}</select></div><div class="field"><label>Laço</label><select id="mLaco">${db.lacos.map(l=>`<option value="${l.id}" ${l.id===o.lacoId?'selected':''}>${esc(paiName(l.painelId)+' - '+l.nome)}</option>`)}</select></div><div class="field"><label>Endereço FLM</label><input id="mEnd" value="${esc(o.endereco)}"></div><div class="field"><label>Modelo</label><input id="mModelo" list="listaModelosFlm" value="${esc(o.modelo||modelos[0]||'FLM')}"><datalist id="listaModelosFlm">${modelos.map(v=>`<option value="${esc(v)}"></option>`).join('')}</datalist></div><div class="field"><label>Piso</label><select id="mPiso"><option value="">Selecione</option>${pisos.map(v=>`<option value="${esc(v)}" ${v===o.piso?'selected':''}>${esc(v)}</option>`).join('')}</select></div></div><br><button class="btn" onclick="saveFlm('${i}')">Salvar</button> <button class="btn secondary" onclick="closeModal()">Cancelar</button>`)}
function saveFlm(i){let o=i?db.flms.find(x=>x.id===i):{id:id(),status:'Em operação'}; o.painelId=mPainel.value;o.lacoId=mLaco.value;o.endereco=n(mEnd.value);o.modelo=n(mModelo.value)||'FLM';o.piso=n(mPiso.value); if(!i)db.flms.push(o); closeModal(); save()}
function managePortas(flmId){let f=flmById(flmId); let ps=db.portas.filter(p=>p.flmId===flmId); openModal(`<h2>Portas do FLM ${esc(f?.endereco)}</h2>${table(ps.map(p=>({...p,loja:locName(p.localId)})),[['Porta','numero'],['Loja / Área','loja'],['Ligação','ligacao']],p=>`<button class="btn small secondary" onclick="formPorta('${flmId}','${p.id}')">✏️</button> <button class="btn small danger" onclick="del('portas','${p.id}')">🗑</button>`)}<br><button class="btn" onclick="formPorta('${flmId}')">+ Porta</button> <button class="btn secondary" onclick="closeModal()">Fechar</button>`)}
function formPorta(flmId,pid=''){if(!requireAccess('cadastro','Seu perfil não pode criar/editar portas.'))return; let p=db.portas.find(x=>x.id===pid)||{flmId};openModal(`<h2>${pid?'Editar':'Nova'} Porta</h2><div class="formGrid"><div class="field"><label>Número</label><select id="mNum"><option ${p.numero==='1'?'selected':''}>1</option><option ${p.numero==='2'?'selected':''}>2</option></select></div><div class="field"><label>Loja / Área</label><select id="mLocal"><option value="">Sem vínculo</option>${db.locais.map(l=>`<option value="${l.id}" ${l.id===p.localId?'selected':''}>${esc(l.nome)}</option>`)}</select></div><div class="field"><label>Ligação</label><input id="mLig" value="${esc(p.ligacao)}"></div></div><br><button class="btn" onclick="savePorta('${flmId}','${pid}')">Salvar</button>`)}
function savePorta(flmId,pid){let p=pid?db.portas.find(x=>x.id===pid):{id:id(),flmId};p.numero=mNum.value;p.localId=mLocal.value;p.ligacao=mLig.value;if(!pid)db.portas.push(p);let loc=localById(p.localId);if(loc){loc.flmId=flmId;loc.portaId=p.id} closeModal(); save()}
function formLocal(i=''){if(!requireAccess('cadastro','Seu perfil não pode criar/editar lojas/áreas.'))return; let o=db.locais.find(x=>x.id===i)||{};openModal(`<h2>${i?'Editar':'Nova'} Loja / Área</h2><div class="formGrid"><div class="field"><label>Nome</label><input id="mNome" value="${esc(o.nome)}"></div><div class="field"><label>Classificação</label><select id="mTipo"><option ${o.tipo==='Loja'?'selected':''}>Loja</option><option ${o.tipo==='Área Técnica'?'selected':''}>Área Técnica</option><option ${o.tipo==='Área Comum'?'selected':''}>Área Comum</option></select></div><div class="field"><label>Piso</label><input id="mPiso" value="${esc(o.piso)}"></div><div class="field"><label>Status</label><select id="mStatus"><option>Em operação</option><option>Falha logista</option><option>Falha sistema</option><option>Desativada</option></select></div></div><br><button class="btn" onclick="saveLocal('${i}')">Salvar</button>`)}
function saveLocal(i){let o=i?db.locais.find(x=>x.id===i):{id:id(),ultimaAlteracao:isoNow()}; if(i&&o.nome!==n(mNome.value))db.falhas.push({id:id(),data:isoNow(),tipo:'Alteração cadastral',itemId:o.id,itemNome:o.nome,localId:o.id,status:'Nome alterado',motivo:`Nome anterior: ${o.nome} | Novo: ${n(mNome.value)}`,origem:'Cadastro'}); o.nome=n(mNome.value);o.tipo=mTipo.value;o.piso=n(mPiso.value);o.status=mStatus.value;if(!i)db.locais.push(o);closeModal();save()}
function formEquip(i=''){if(!requireAccess('cadastro','Seu perfil não pode criar/editar equipamentos.'))return; let o=db.equipamentos.find(x=>x.id===i)||{};openModal(`<h2>${i?'Editar':'Novo'} Equipamento</h2><div class="formGrid"><div class="field"><label>Painel</label><select id="mPainel">${db.paineis.map(p=>`<option value="${p.id}" ${p.id===o.painelId?'selected':''}>${esc(p.nome)}</option>`)}</select></div><div class="field"><label>Laço</label><select id="mLaco">${db.lacos.map(l=>`<option value="${l.id}" ${l.id===o.lacoId?'selected':''}>${esc(paiName(l.painelId)+' - '+l.nome)}</option>`)}</select></div><div class="field"><label>Tipo</label><input id="mTipo" value="${esc(o.tipo)}" placeholder="Detector de Fumaça, Acionador Manual..."></div><div class="field"><label>Endereço</label><input id="mEnd" value="${esc(o.endereco)}"></div><div class="field"><label>Modelo</label><input id="mModelo" value="${esc(o.modelo)}"></div><div class="field"><label>Piso</label><input id="mPiso" value="${esc(o.piso)}"></div><div class="field"><label>Loja / Área</label><select id="mLocal"><option value="">Sem vínculo</option>${db.locais.map(l=>`<option value="${l.id}" ${l.id===o.localId?'selected':''}>${esc(l.nome)}</option>`)}</select></div><div class="field"><label>Status</label><select id="mStatus">${['Em operação','Falha logista','Falha sistema','Desativada','Em teste'].map(st=>`<option ${normalizeStatus(o.status)===st?'selected':''}>${st}</option>`).join('')}</select></div></div><br><button class="btn" onclick="saveEquip('${i}')">Salvar</button>`)}
function saveEquip(i){let o=i?db.equipamentos.find(x=>x.id===i):{id:id(),ultimaAlteracao:isoNow()}; o.painelId=mPainel.value;o.lacoId=mLaco.value;o.tipo=n(mTipo.value);o.endereco=n(mEnd.value);o.modelo=n(mModelo.value);o.piso=n(mPiso.value);o.localId=mLocal.value;o.status=normalizeStatus(mStatus.value);o.ultimaAlteracao=isoNow(); if(!i)db.equipamentos.push(o);closeModal();save()}
function falhaItems(){
  const eq=db.equipamentos.map(e=>({id:e.id,n:`${e.tipo} • ${e.endereco||'sem endereço'} • ${locName(e.localId)||'Sem vínculo'}`,tipo:e.tipo,painelId:e.painelId,lacoId:e.lacoId,piso:e.piso,localId:e.localId,kind:'equip'}));
  const fl=db.flms.map(f=>{const ps=db.portas.filter(p=>p.flmId===f.id);const locs=ps.map(p=>p.localId).filter(Boolean);const label=ps.map(p=>`P${p.numero}: ${locName(p.localId)||'Sem vínculo'}`).join(' | ');return {id:'flm:'+f.id,n:`Módulo • ${f.endereco||f.modelo||'sem endereço'}${label?' • '+label:''}`,tipo:'Módulo',painelId:f.painelId,lacoId:f.lacoId,piso:f.piso,localId:'',localIds:locs,kind:'flm'}});
  return eq.concat(fl);
}
function getFalhaFilterValues(){return {
  painel:document.getElementById('mFiltroPainel')?.value||'',
  laco:document.getElementById('mFiltroLaco')?.value||'',
  piso:document.getElementById('mFiltroPiso')?.value||'',
  local:document.getElementById('mFiltroLocal')?.value||'',
  item:document.getElementById('mItem')?.value||''
}}
function itemMatchesFalhaFilters(it,f){
  if(f.painel && paiName(it.painelId)!==f.painel)return false;
  if(f.laco && lacName(it.lacoId)!==f.laco)return false;
  if(f.piso && n(it.piso)!==f.piso)return false;
  if(f.local){
    const locOk=it.localId===f.local || (it.localIds||[]).includes(f.local);
    if(!locOk)return false;
  }
  return true;
}
function falhaFilteredItems(ignoreField=''){
  const f=getFalhaFilterValues(); if(ignoreField)f[ignoreField]='';
  return falhaItems().filter(it=>itemMatchesFalhaFilters(it,f));
}
function refreshFalhaFilters(changed=''){
  const f=getFalhaFilterValues();
  const fill=(id,vals,sel,allLabel='Todos')=>{const el=document.getElementById(id); if(!el)return; const keep=vals.includes(sel)?sel:''; el.innerHTML=`<option value="">${allLabel}</option>`+vals.map(v=>`<option value="${esc(v)}" ${v===keep?'selected':''}>${esc(v)}</option>`).join('')};
  fill('mFiltroPainel',unique(falhaFilteredItems('painel').map(it=>paiName(it.painelId))),f.painel,'Todos os painéis');
  fill('mFiltroLaco',unique(falhaFilteredItems('laco').map(it=>lacName(it.lacoId))),f.laco,'Todos os laços');
  fill('mFiltroPiso',unique(falhaFilteredItems('piso').map(it=>it.piso)),f.piso,'Todos os pisos');
  const localIds=unique(falhaFilteredItems('local').flatMap(it=>[it.localId,...(it.localIds||[])]));
  const localOpts=localIds.map(id=>({id,nome:locName(id)})).filter(x=>x.id&&x.nome).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const locEl=document.getElementById('mFiltroLocal'); if(locEl){const keep=localIds.includes(f.local)?f.local:''; locEl.innerHTML='<option value="">Todas as lojas/áreas</option>'+localOpts.map(x=>`<option value="${x.id}" ${x.id===keep?'selected':''}>${esc(x.nome)}</option>`).join('')}
  const items=falhaFilteredItems();
  const itemEl=document.getElementById('mItem'); if(itemEl){const keep=items.some(x=>x.id===f.item)?f.item:''; itemEl.innerHTML=items.map(it=>`<option value="${it.id}" ${it.id===keep?'selected':''}>${esc(it.n)}</option>`).join('')||'<option value="">Nenhum item encontrado</option>'}
  const hint=document.getElementById('mFalhaHint'); if(hint){hint.textContent=`${items.length} item(ns) disponível(is) com os filtros aplicados.`}
}
function bindFalhaModal(){['mFiltroPainel','mFiltroLaco','mFiltroPiso','mFiltroLocal'].forEach(id=>{const el=document.getElementById(id); if(el)el.addEventListener('change',()=>refreshFalhaFilters(id.replace('mFiltro','').toLowerCase()))});
  document.querySelectorAll('input[name="mStatusCheck"]').forEach(ch=>ch.addEventListener('change',e=>{if(e.target.checked)document.querySelectorAll('input[name="mStatusCheck"]').forEach(o=>{if(o!==e.target)o.checked=false})}));
  refreshFalhaFilters();
}
function formFalha(i=''){
  let o=db.falhas.find(x=>x.id===i)||{};
  const item=falhaItems().find(it=>it.id===o.itemId);
  const fp=item?paiName(item.painelId):''; const fl=item?lacName(item.lacoId):''; const fpi=item?item.piso:''; const flo=o.localId||item?.localId||'';
  const statusAtual=o.status||'Em operação';
  openModal(`<h2>Registrar Falha / Operação</h2>
  <p class="msg warn">Fluxo correto: filtre por painel, laço, piso ou loja/área. Os filtros permanecem ativos e restringem os próximos campos.</p>
  <div class="formGrid">
    <div class="field"><label>Painel</label><select id="mFiltroPainel"><option value="${esc(fp)}" selected>${esc(fp||'Todos os painéis')}</option></select></div>
    <div class="field"><label>Laço</label><select id="mFiltroLaco"><option value="${esc(fl)}" selected>${esc(fl||'Todos os laços')}</option></select></div>
    <div class="field"><label>Piso / Pavimento</label><select id="mFiltroPiso"><option value="${esc(fpi)}" selected>${esc(fpi||'Todos os pisos')}</option></select></div>
    <div class="field"><label>Loja / Área</label><select id="mFiltroLocal"><option value="${esc(flo)}" selected>${esc(locName(flo)||'Todas as lojas/áreas')}</option></select></div>
    <div class="field" style="grid-column:1/-1"><label>Item filtrado</label><select id="mItem"><option value="${esc(o.itemId||'')}" selected>${esc(item?.n||'Selecione um item')}</option></select><small id="mFalhaHint" class="note"></small></div>
    <div class="field"><label>Data/hora do lançamento</label><input value="${esc(i?o.data:now())}" disabled></div>
    <div class="field"><label>Responsável pelo lançamento</label><input id="mResp" value="${esc(o.responsavel)}" placeholder="Ex.: Hélio / equipe técnica"></div>
    <div class="field"><label>Origem</label><select id="mOrigem"><option ${o.origem==='Painel Bosch'?'selected':''}>Painel Bosch</option><option ${o.origem==='Teste em campo'?'selected':''}>Teste em campo</option><option ${o.origem==='Inspeção'?'selected':''}>Inspeção</option><option ${o.origem==='Importação'?'selected':''}>Importação</option></select></div>
    <div class="field"><label>Motivo</label><input id="mMotivo" value="${esc(o.motivo)}" placeholder="Ex.: curto, aberto, acionamento, normalização"></div>
    <div class="field" style="grid-column:1/-1"><label>Status do sistema</label><div class="toolbar statusChecks">
      ${['Em operação','Falha logista','Falha sistema','Desativada','Em teste'].map((st,idx)=>`<label class="check"><input type="checkbox" name="mStatusCheck" value="${st}" ${st===statusAtual?'checked':''}> ${st}</label>`).join('')}
    </div></div>
    <div class="field" style="grid-column:1/-1"><label>Observação técnica</label><textarea id="mObs" placeholder="Detalhe técnico do lançamento">${esc(o.obs)}</textarea></div>
  </div><br><button class="btn" onclick="saveFalha('${i}')">Salvar lançamento</button> <button class="btn secondary" onclick="closeModal()">Cancelar</button>`);
  bindFalhaModal();
}
function saveFalha(i){
  let sel=mItem.value; if(!sel){alert('Selecione um item filtrado antes de salvar.');return}
  let checked=document.querySelector('input[name="mStatusCheck"]:checked'); if(!checked){alert('Marque um status do sistema.');return}
  let isFlm=sel.startsWith('flm:');let item=isFlm?db.flms.find(x=>x.id===sel.slice(4)):db.equipamentos.find(x=>x.id===sel); if(!item)return;
  let localId=isFlm?(mFiltroLocal.value||''):(item.localId||mFiltroLocal.value||'');
  let statusAnterior=item.status||'Em operação'; item.status=checked.value; item.ultimaAlteracao=isoNow();
  let loc=localById(localId); if(loc){loc.status=checked.value;loc.ultimaAlteracao=isoNow()}
  let rec=i?db.falhas.find(x=>x.id===i):{id:id()};
  Object.assign(rec,{data:isoNow(),painelId:item.painelId,lacoId:item.lacoId,piso:item.piso,tipo:isFlm?'Módulo':item.tipo,itemId:sel,itemNome:(isFlm?'Módulo ':'')+(item.endereco||item.modelo),localId,status:checked.value,statusAnterior,responsavel:n(mResp.value),origem:mOrigem.value,motivo:n(mMotivo.value),obs:n(mObs.value),resolvidaEm:up(checked.value).includes('OPER')?isoNow():''});
  if(!i){db.falhas.push(rec); if(isFalhaStatus(rec.status)&&!db.planos.find(p=>p.falhaId===rec.id)){db.planos.push({id:id(),falhaId:rec.id,criadoEm:isoNow(),categoria:'Manutenção corretiva',prioridade:'Média',responsavel:'L3A Engenharia',situacao:'Aberto',painel:paiName(rec.painelId),laco:lacName(rec.lacoId),piso:rec.piso,local:locName(rec.localId),item:rec.itemNome,statusFalha:rec.status,justificativa:rec.motivo||rec.obs||'',providencia:'',necessitaCompra:false});}} closeModal(); save()
}

function formPlano(i='',falhaId=''){
  let o=db.planos.find(x=>x.id===i)||{}; let f=db.falhas.find(x=>x.id===(falhaId||o.falhaId))||{}; let inf=f.id?itemInfoFromFalha(f):{};
  openModal(`<h2>${i?'Editar':'Criar'} plano de ação</h2><p class="msg warn">Base: ${esc(inf.painel||'')} • ${esc(inf.laco||'')} • ${esc(inf.local||'')} • ${esc(inf.itemNome||'')}</p><div class="formGrid">
    <div class="field"><label>Categoria</label><select id="mCategoria">${planoCategorias().map(c=>`<option ${c===(o.categoria||'Manutenção corretiva')?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Prioridade</label><select id="mPrioridade">${planoPrioridades().map(c=>`<option ${c===(o.prioridade||'Média')?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Responsável</label><select id="mRespPlano">${planoResponsaveis().map(c=>`<option ${c===(o.responsavel||'L3A Engenharia')?'selected':''}>${c}</option>`).join('')}</select></div>
    <div class="field"><label>Situação</label><select id="mSituacao"><option ${o.situacao==='Aberto'?'selected':''}>Aberto</option><option ${o.situacao==='Em andamento'?'selected':''}>Em andamento</option><option ${o.situacao==='Concluído'?'selected':''}>Concluído</option></select></div>
    <div class="field"><label>Previsão</label><input id="mPrazo" type="date" value="${esc(o.prazo)}"></div>
    <div class="field"><label>Necessita compra?</label><select id="mCompra"><option value="Não" ${!o.necessitaCompra?'selected':''}>Não</option><option value="Sim" ${o.necessitaCompra?'selected':''}>Sim</option></select></div>
    <div class="field" style="grid-column:1/-1"><label>Material necessário / quantidade</label><input id="mMaterial" value="${esc(o.material)}" placeholder="Ex.: FLM-420/4-CON-S/D - 01 unidade"></div>
    <div class="field" style="grid-column:1/-1"><label>Justificativa técnica</label><textarea id="mJust">${esc(o.justificativa||f.motivo||f.obs||'')}</textarea></div>
    <div class="field" style="grid-column:1/-1"><label>Providência executada / próxima ação</label><textarea id="mProv">${esc(o.providencia)}</textarea></div>
  </div><br><button class="btn" onclick="savePlano('${i}','${falhaId||o.falhaId||''}')">Salvar plano</button> <button class="btn secondary" onclick="closeModal()">Cancelar</button>`)
}
function savePlano(i,falhaId=''){
  let f=db.falhas.find(x=>x.id===falhaId)||{}; let inf=f.id?itemInfoFromFalha(f):{}; let o=i?db.planos.find(x=>x.id===i):{id:id(),criadoEm:isoNow(),falhaId};
  let old=o.situacao||'Aberto'; Object.assign(o,{falhaId:falhaId||o.falhaId,categoria:mCategoria.value,prioridade:mPrioridade.value,responsavel:mRespPlano.value,situacao:mSituacao.value,prazo:mPrazo.value,necessitaCompra:mCompra.value==='Sim',material:n(mMaterial.value),justificativa:n(mJust.value),providencia:n(mProv.value),painel:inf.painel||o.painel,laco:inf.laco||o.laco,piso:inf.piso||o.piso,local:inf.local||o.local,item:inf.itemNome||o.item,statusFalha:f.status||o.statusFalha,atualizadoEm:isoNow()});
  if(o.situacao==='Concluído'&&!o.concluidoEm)o.concluidoEm=isoNow(); if(!i)db.planos.push(o); closeModal(); save()
}
function concluirPlano(i){let o=db.planos.find(x=>x.id===i); if(!o)return; o.situacao='Concluído'; o.concluidoEm=isoNow(); if(confirm('Plano concluído. Deseja retornar o item automaticamente para Em operação?')){let f=db.falhas.find(x=>x.id===o.falhaId); if(f){let itemId=f.itemId||'';let isFlm=String(itemId).startsWith('flm:');let item=isFlm?flmById(String(itemId).slice(4)):db.equipamentos.find(e=>e.id===itemId);if(item){let old=item.status||'Em operação';item.status='Em operação';item.ultimaAlteracao=isoNow();db.falhas.push({id:id(),data:isoNow(),painelId:item.painelId,lacoId:item.lacoId,piso:item.piso,tipo:isFlm?'Módulo':item.tipo,itemId:f.itemId,itemNome:f.itemNome,localId:f.localId,status:'Em operação',statusAnterior:old,responsavel:o.responsavel,origem:'Plano de Ação',motivo:'Plano de ação concluído',obs:o.providencia,resolvidaEm:isoNow()})}}} save()}

function openEquip(i){let e=db.equipamentos.find(x=>x.id===i);let hist=db.falhas.filter(f=>f.itemId===i||f.localId===e.localId).sort((a,b)=>b.data.localeCompare(a.data));openModal(`<h2>${esc(e.tipo)} ${esc(e.endereco)}</h2><p><b>Loja:</b> ${esc(locName(e.localId))} • <b>Painel:</b> ${esc(paiName(e.painelId))} • <b>Laço:</b> ${esc(lacName(e.lacoId))}</p><h3>Histórico</h3><div class="timeline">${hist.map(h=>`<div class="tl"><b>${esc(h.status)}</b><br><small>${esc(h.data)} • ${esc(h.origem||'')}</small><p>${esc(h.motivo||h.obs||'Sem observação')}</p></div>`).join('')||'<p class="msg warn">Sem histórico.</p>'}</div>`)}
function openLocal(i){let l=db.locais.find(x=>x.id===i);let hist=db.falhas.filter(f=>f.localId===i||f.itemId===i).sort((a,b)=>b.data.localeCompare(a.data));openModal(`<h2>${esc(l.nome)}</h2><p><b>Tipo:</b> ${esc(l.tipo)} • <b>Painel:</b> ${esc(paiName(l.painelId))} • <b>Laço:</b> ${esc(lacName(l.lacoId))} • <b>Piso:</b> ${esc(l.piso)}</p><h3>Histórico da loja/área</h3><div class="timeline">${hist.map(h=>`<div class="tl"><b>${esc(h.status)}</b><br><small>${esc(h.data)} • ${esc(h.itemNome||'')}</small><p>${esc(h.motivo||h.obs||'Sem observação')}</p></div>`).join('')||'<p class="msg warn">Sem histórico.</p>'}</div>`)}
function del(ent,i){if(['paineis','lacos','flms','portas','locais','equipamentos'].includes(ent)&&!requireAccess('cadastro','Seu perfil não pode excluir cadastros.'))return; if(!confirm('Excluir registro?'))return;db[ent]=db[ent].filter(x=>x.id!==i);closeModal();save()}
async function restoreBackupFile(file){if(!file)return; if(!confirm('Restaurar este backup local e substituir a base atual do navegador?'))return; const txt=await file.text(); try{const parsed=JSON.parse(txt); db=normalizeAllStatuses(Object.assign(emptyDB(),parsed)); persistLocal(); markDirty('backup restaurado'); render(); alert('Backup restaurado localmente. Use Sincronizar agora para enviar ao Google.');}catch(e){alert('Arquivo de backup inválido: '+e.message)}}
function exportJson(){download(JSON.stringify(db,null,2),'base_sdai_bosch_completa.json','application/json')}
function flat(entity){return db[entity].map(o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,typeof v==='object'?JSON.stringify(v):v])))}
function toCsv(rows){if(!rows.length)return '';let keys=Object.keys(rows[0]);return keys.join(';')+'\n'+rows.map(r=>keys.map(k=>csvEscape(r[k])).join(';')).join('\n')}
function exportEntity(e){download(toCsv(flat(e)),e+'.csv','text/csv;charset=utf-8')}
function exportAllCsv(){let chunks=[];['paineis','lacos','flms','portas','locais','equipamentos','falhas','planos','inconsistencias'].forEach(e=>{chunks.push('### '+e+' ###\n'+toCsv(flat(e))) }); download(chunks.join('\n\n'),'base_sdai_bosch_completa.csv','text/csv;charset=utf-8')}
function download(content,name,type){let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click()}
document.getElementById('sideCollapseBtn')?.addEventListener('click',()=>document.querySelector('.app').classList.toggle('sideCollapsed'));
document.getElementById('mobileMenuBtn')?.addEventListener('click',()=>document.querySelector('.side').classList.toggle('open'));
document.querySelectorAll('.nav button').forEach(b=>b.addEventListener('click',()=>document.querySelector('.side').classList.remove('open')));
setInterval(()=>scheduleAutoSync(0),30000);
render();
