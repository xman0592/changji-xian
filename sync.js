/* 长季鲜 · Supabase 多人同步（原生 fetch，无第三方依赖） */
(function (global) {
  'use strict';

  const LS_KEY = 'cjx_sync_v1';
  let cfg = loadCfg();
  let session = cfg.session || null;
  let lastError = '';
  let lastSyncAt = null;

  function loadCfg() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function persist() {
    cfg.session = session;
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }
  function base() { return String(cfg.url || '').replace(/\/+$/, ''); }
  function isConfigured() { return !!(cfg.url && cfg.anonKey && cfg.email); }
  function isAuthed() { return !!(session && session.access_token && isConfigured()); }
  function status() {
    return {
      configured: isConfigured(), authed: isAuthed(), url: cfg.url || '',
      email: cfg.email || '', lastSyncAt, lastError,
      expiresAt: session ? session.expires_at : 0
    };
  }
  function setError(msg) { lastError = msg || ''; }

  async function authFetch(path, body, useToken) {
    const headers = { 'apikey': cfg.anonKey, 'Content-Type': 'application/json' };
    if (useToken && session && session.access_token) headers['Authorization'] = 'Bearer ' + session.access_token;
    const res = await fetch(base() + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!res.ok) {
      const msg = (data && (data.error_description || data.msg || data.error)) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  async function login(url, anonKey, email, password) {
    url = String(url || '').trim().replace(/\/+$/, '');
    anonKey = String(anonKey || '').trim();
    email = String(email || '').trim();
    if (!/^https?:\/\//i.test(url)) throw new Error('Supabase 地址要以 https:// 开头');
    if (!anonKey || anonKey.length < 30) throw new Error('anon public key 看起来不对');
    if (!email) throw new Error('请填写同步账号邮箱');
    cfg = { url, anonKey, email };
    session = null;
    const data = await authFetch('/auth/v1/token?grant_type=password', { email, password });
    if (!data || !data.access_token) throw new Error('登录失败，请检查邮箱和密码');
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000 - 60000,
      email
    };
    lastError = '';
    persist();
    return status();
  }

  async function refreshSession() {
    if (!session || !session.refresh_token) throw new Error('登录已过期，请重新登录');
    const data = await authFetch('/auth/v1/token?grant_type=refresh_token', { refresh_token: session.refresh_token });
    if (!data || !data.access_token) throw new Error('登录已过期，请重新登录');
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || session.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000 - 60000,
      email: cfg.email
    };
    persist();
    return session;
  }

  async function ensureSession() {
    if (!session) throw new Error('尚未登录同步账号');
    if (!session.expires_at || session.expires_at < Date.now() + 30000) await refreshSession();
    return session;
  }

  async function rest(path, opts, retried) {
    const s = await ensureSession();
    const options = opts || {};
    const headers = Object.assign({
      'apikey': cfg.anonKey,
      'Authorization': 'Bearer ' + s.access_token,
      'Content-Type': 'application/json'
    }, options.headers || {});
    const res = await fetch(base() + '/rest/v1/' + path, Object.assign({}, options, { headers }));
    if (res.status === 401 && !retried) {
      await refreshSession();
      return rest(path, opts, true);
    }
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    if (!res.ok) {
      const msg = (data && (data.message || data.hint || data.details)) || ('HTTP ' + res.status);
      throw new Error(msg);
    }
    return data;
  }

  function isoMax(a, b) {
    if (!a) return b || '';
    if (!b) return a || '';
    return String(a) > String(b) ? a : b;
  }

  async function pullAll(opts) {
    const get = (path) => rest(path, { method: 'GET' });
    const since = (opts && opts.since) || '';
    // 时钟偏差兜底：往回多看一段，重叠部分由 mergeRemote 幂等丢弃
    const overlap = Number((opts && opts.overlap) || 0);
    let from = since;
    if (since && overlap > 0) {
      const t = Date.parse(since);
      if (!isNaN(t)) from = new Date(t - overlap * 1000).toISOString();
    }
    const q = from ? '&updated_at=gt.' + encodeURIComponent(from) : '';
    const qr = from ? '&submitted_at=gt.' + encodeURIComponent(from) : '';
    const out = await Promise.all([
      get('cjx_rooms?select=*' + q),
      get('cjx_dishes?select=*' + q),
      get('cjx_customers?select=*' + q),
      get('cjx_orders?select=*' + q),
      get('cjx_rsvps?select=*' + qr),
      get('cjx_settings?select=*&id=eq.1' + q)
    ]);
    const rows = [].concat(out[0] || [], out[1] || [], out[2] || [], out[3] || [], out[4] || [], out[5] || []);
    let cursor = since;
    rows.forEach((r) => { cursor = isoMax(cursor, r && (r.updated_at || r.submitted_at)); });
    lastSyncAt = new Date().toISOString();
    lastError = '';
    return {
      rooms: out[0] || [], dishes: out[1] || [], customers: out[2] || [],
      orders: out[3] || [], rsvps: out[4] || [], settings: out[5] || [],
      since: from || '', _cursor: cursor || ''
    };
  }

  async function upsert(table, rows) {
    if (!rows || !rows.length) return true;
    await rest(table + '?on_conflict=id', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows)
    });
    return true;
  }

  async function pushAll(payload) {
    // payload: { rooms, dishes, customers, orders, rsvps, settings }
    const jobs = [];
    ['rooms', 'dishes', 'customers', 'orders', 'rsvps'].forEach((t) => {
      if (payload[t] && payload[t].length) jobs.push(upsert('cjx_' + t, payload[t]));
    });
    if (payload.settings) {
      jobs.push(rest('cjx_settings?on_conflict=id', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([payload.settings])
      }));
    }
    await Promise.all(jobs);
    lastSyncAt = new Date().toISOString();
    lastError = '';
    return true;
  }

  function logout() {
    session = null;
    cfg.session = null;
    persist();
  }

  function clearConfig() {
    session = null;
    cfg = {};
    localStorage.removeItem(LS_KEY);
  }

  async function fetchPublicMenu() {
    // 供 menu.html / invite.html 使用：匿名读取公开视图
    if (!cfg.url || !cfg.anonKey) throw new Error('未配置同步');
    const headers = { 'apikey': cfg.anonKey, 'Authorization': 'Bearer ' + cfg.anonKey };
    const res = await fetch(base() + '/rest/v1/cjx_public_menu?select=*', { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function fetchPublicShop() {
    if (!cfg.url || !cfg.anonKey) throw new Error('未配置同步');
    const headers = { 'apikey': cfg.anonKey, 'Authorization': 'Bearer ' + cfg.anonKey };
    const res = await fetch(base() + '/rest/v1/cjx_public_shop?select=*', { headers });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function submitRsvp(sync, row) {
    // 匿名提交回执：sync = {url, anonKey}
    if (!sync || !sync.url || !sync.anonKey) throw new Error('未配置同步');
    const headers = {
      'apikey': sync.anonKey,
      'Authorization': 'Bearer ' + sync.anonKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
    const res = await fetch(String(sync.url).replace(/\/+$/, '') + '/rest/v1/cjx_rsvps', {
      method: 'POST', headers, body: JSON.stringify(row)
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || ('HTTP ' + res.status));
    }
    return true;
  }

  global.CJXSync = {
    login, logout, clearConfig, isConfigured, isAuthed, status,
    pullAll, pushAll, fetchPublicMenu, fetchPublicShop, submitRsvp,
    getConfig: () => ({ url: cfg.url || '', anonKey: cfg.anonKey || '', email: cfg.email || '' }),
    setLastSync: (v) => { lastSyncAt = v; },
    setError
  };
})(window);
