/* SDAI Bosch Manager — API GitHub Pages + Apps Script
   Leitura usa JSONP. Salvamento usa POST por formulário oculto para evitar CORS. */
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

function postNoCors(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const iframeName = 'sdai_post_' + Date.now();
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = API_URL;
    form.target = iframeName;
    form.style.display = 'none';

    const add = (name, value) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    add('action', action);
    Object.entries(payload || {}).forEach(([k, v]) => {
      add(k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''));
    });

    document.body.appendChild(form);

    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      cleanup();
      resolve({ ok: true, mode: 'posted' });
    }, 2500);

    function cleanup() {
      clearTimeout(timer);
      try { form.remove(); } catch(e) {}
      try { iframe.remove(); } catch(e) {}
    }

    try { form.submit(); }
    catch(e) { cleanup(); reject(e); }
  });
}

window.SDAI_API = {
  ping: () => apiJsonp('ping'),
  setupDatabase: (name = 'Banco - SDAI Bosch Manager') => apiJsonp('setupDatabase', { name }),
  getDatabaseInfo: () => apiJsonp('getDatabaseInfo'),
  getAll: () => apiJsonp('getAll'),
  saveAll: (data) => postNoCors('saveAll', { data: btoa(unescape(encodeURIComponent(JSON.stringify(data)))) }),
  clearDatabase: () => apiJsonp('clearDatabase')
};
