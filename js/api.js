// Camada de API. Mantém o sistema funcionando localmente e prepara integração Google.
window.SdaiApi = {
  async request(action, payload={}){
    const url = (window.SDAI_CONFIG||{}).API_URL;
    if(!url) return {ok:false, error:'API_URL não configurada'};
    try{
      // Apps Script pode bloquear CORS em alguns navegadores. Se falhar, storage.js usa fallback local.
      const res = await fetch(url + '?action=' + encodeURIComponent(action), {
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(payload)
      });
      const txt = await res.text();
      try{return JSON.parse(txt)}catch(e){return {ok:false, raw:txt}}
    }catch(err){
      return {ok:false, error: err.message || String(err)};
    }
  },
  setupDatabase(){ return this.request('setupDatabase', {}); },
  saveAll(data){ return this.request('saveAll', {data}); },
  loadAll(){ return this.request('loadAll', {}); }
};
