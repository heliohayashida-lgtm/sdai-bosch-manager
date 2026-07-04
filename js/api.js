/* SDAI Bosch Manager v5 — API client para GitHub Pages + Apps Script
   Usa JSONP para evitar bloqueio CORS do Apps Script em GitHub Pages. */

const API_URL = 'https://script.google.com/macros/s/AKfycby45dTdw4g-pkcvY9sys3_gmvVcmnSyf6PZzJbRsbSFjhtuWbV1D5XSBEc-J1UtOBYftA/exec';

function apiJsonp(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const cb = '__sdai_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const params = new URLSearchParams();
    params.set('action', action);
    params.set('callback', cb);
    Object.entries(payload || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      params.set(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    });

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado ao comunicar com Apps Script.'));
    }, 30000);

    function cleanup() {
      clearTimeout(timer);
      try { delete window[cb]; } catch(e) { window[cb] = undefined; }
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cb] = (res) => {
      cleanup();
      if (!res || res.ok === false) reject(new Error((res && res.error) || 'Erro na API.'));
      else resolve(res);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('Falha ao carregar resposta da API. Verifique implantação do Apps Script.'));
    };

    script.src = API_URL + '?' + params.toString();
    document.head.appendChild(script);
  });
}

window.SDAI_API = {
  ping: () => apiJsonp('ping'),
  setupDatabase: (name = 'Banco - SDAI Bosch Manager') => apiJsonp('setupDatabase', { name }),
  getDatabaseInfo: () => apiJsonp('getDatabaseInfo'),
  getAll: () => apiJsonp('getAll'),

  // Atenção: saveAll com muitos dados pode ultrapassar limite de URL do JSONP.
  // Para bases grandes, vamos salvar por tabela/lote ou usar Apps Script como host do front.
  saveAll: (data) => apiJsonp('saveAll', { data }),
  appendRows: (table, rows) => apiJsonp('appendRows', { table, rows }),
  clearDatabase: () => apiJsonp('clearDatabase')
};
