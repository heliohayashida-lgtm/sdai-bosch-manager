// Compatibilidade com o sistema original + fallback local.
(function(){
  const key = (window.SDAI_CONFIG||{}).STORAGE_KEY || 'sdai_manager_v5_payload';
  const local = {
    async get(k){ const v=localStorage.getItem(k); return v===null?null:{value:v}; },
    async set(k,v){ localStorage.setItem(k,v); return {ok:true}; }
  };
  window.storage = window.storage || local;
  window.SdaiStorage = {
    async saveAll(data){
      localStorage.setItem(key, JSON.stringify(data));
      const r = await window.SdaiApi.saveAll(data);
      if(r && r.ok) return {ok:true, remote:true};
      return {ok:true, remote:false, warning:r&&r.error};
    },
    async loadAll(){
      const r = await window.SdaiApi.loadAll();
      if(r && r.ok && r.data) { localStorage.setItem(key, JSON.stringify(r.data)); return {data:r.data, remote:true}; }
      const v = localStorage.getItem(key);
      return {data: v?JSON.parse(v):null, remote:false};
    }
  };
})();
