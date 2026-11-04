/* 长季鲜 · 预约及客情维护系统 */
(function () {
  'use strict';
  const D = window.CJXData;
  if (!D) { document.body.innerHTML = '<p style="padding:40px;text-align:center">数据脚本加载失败，请刷新重试。</p>'; return; }

  const LS_STATE = 'cjx_state_v1';
  const LS_SNAPS = 'cjx_snaps_v1';
  const LS_SESSION = 'cjx_session_v1';
  const LS_CURSOR = 'cjx_sync_cursor_v1';   // 增量同步游标（本机）

  const ROLES = {
    boss: { name: '老板', desc: '接单、审核、菜单、邀请函', icon: 'crown' },
    manager: { name: '店长', desc: '上下架、配菜、备货、邀请函', icon: 'clipboard' },
    kitchen: { name: '后厨', desc: '看时令菜、看备货单', icon: 'dish' },
    service: { name: '服务员', desc: '看板、包厢开台准备', icon: 'bell' }
  };
  // 权限矩阵：老板 / 店长可改菜单、上下架、AI 配菜；后厨与服务员只读
  // 菜价只有店长能改：老板能改菜名/做法/上下架，但价格字段锁定
  const PERMS = {
    boss: { menuEdit: true, menuShelf: true, menuPrice: false, aiMenu: true, prepView: true, prepManage: true, orderManage: true, invite: true, roleQr: true },
    manager: { menuEdit: true, menuShelf: true, menuPrice: true, aiMenu: true, prepView: true, prepManage: true, orderManage: true, invite: true, roleQr: true },
    kitchen: { menuEdit: false, menuShelf: false, menuPrice: false, aiMenu: false, prepView: true, prepManage: false, orderManage: false, invite: false, roleQr: false },
    service: { menuEdit: false, menuShelf: false, menuPrice: false, aiMenu: false, prepView: false, prepManage: false, orderManage: false, invite: false, roleQr: false }
  };
  const TABS = {
    boss: [['home', '首页', 'home'], ['orders', '预定', 'list'], ['calendar', '日历', 'calendar'], ['customers', '熟客', 'users'], ['more', '更多', 'more']],
    manager: [['home', '首页', 'home'], ['orders', '预定', 'list'], ['calendar', '日历', 'calendar'], ['prep', '备货', 'clipboard'], ['more', '更多', 'more']],
    kitchen: [['dishes', '时令菜', 'dish'], ['prep', '备货', 'clipboard'], ['orders', '需求', 'list'], ['more', '更多', 'more']],
    service: [['board', '看板', 'bell'], ['orders', '订单', 'list'], ['dishes', '菜单', 'dish'], ['more', '更多', 'more']]
  };
  const SUBVIEWS = ['orderForm', 'orderDetail', 'customerDetail', 'settings', 'ledger'];
  const STATUS = {
    pending: { label: '待审核', cls: 'pending' },
    confirmed: { label: '已确认', cls: 'confirmed' },
    notified: { label: '已通知', cls: 'notified' },
    done: { label: '已完成', cls: 'done' },
    cancelled: { label: '已取消', cls: 'cancelled' }
  };
  // 开台准备：按人数自动算量，服务员照单备
  const SERVICE_CHECKS = [
    { key: 'tableware', label: '碗碟', unit: '套', calc: (n) => n + 2, hint: '按人数 +2 套备用' },
    { key: 'pitcher', label: '酒水扎壶', unit: '个', calc: (n) => Math.max(1, Math.ceil(n / 4)), hint: '每 4 人 1 个' },
    { key: 'water', label: '矿泉水', unit: '瓶', calc: (n) => Math.max(2, Math.ceil(n / 2)), hint: '每 2 人 1 瓶' },
    { key: 'drink', label: '饮料', unit: '瓶', calc: (n) => Math.max(1, Math.ceil(n / 3)), hint: '每 3 人 1 瓶' }
  ];
  // 菜单流转：接单 → 转店长 → 出菜单 → 转老板 → 发客户 → 客户确认 → 邀请函
  const FLOW_STEPS = [
    { key: 'new', label: '接单', desc: '老板录入客人预定' },
    { key: 'manager', label: '转店长', desc: '店长按人数餐标配菜' },
    { key: 'menu', label: '出菜单', desc: 'AI 生成本桌菜单' },
    { key: 'boss', label: '转老板', desc: '老板核对后发客户' },
    { key: 'customer', label: '发客户', desc: '客户确认是否改菜' },
    { key: 'confirmed', label: '已确认', desc: '可发邀请函' }
  ];

  /* ---------- SVG 图标 ---------- */
  const svg = (p, extra) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" ' + (extra || '') + '>' + p + '</svg>';
  const I = {
    back: svg('<path d="M15 18l-6-6 6-6"/>'),
    home: svg('<path d="M3 10.7L12 3l9 7.7"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>'),
    list: svg('<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8h8M8 12h8M8 16h5"/>'),
    calendar: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 13h2M14 13h2M8 17h2M14 17h2"/>'),
    users: svg('<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.4-3.4 2.6-5.2 5.5-5.2s5.1 1.8 5.5 5.2"/><path d="M16 5.5a3 3 0 0 1 0 5.8M17.5 15c2 .6 3.2 2.2 3.5 4.6"/>'),
    more: svg('<circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    chat: svg('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.9 9.9 0 0 1-3.5-.7L4 21l1.3-3.8A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/><path d="M8 10.5h8M8 14h5"/>'),
    dish: svg('<path d="M4 12.5h16a8 8 0 0 1-16 0z"/><path d="M3 21h18"/><path d="M8 9.5c0-1.5 1-2.2 1-3.5M12 9.5c0-1.8 1.2-2.6 1.2-4M16 9.5c0-1.4.9-2.1.9-3.3"/>'),
    clipboard: svg('<rect x="5" y="4.5" width="14" height="16.5" rx="2.5"/><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4"/>'),
    bell: svg('<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/>'),
    cloud: svg('<path d="M7 18.5h10.5a3.5 3.5 0 0 0 .4-7 5.5 5.5 0 0 0-10.6-1.6A4.3 4.3 0 0 0 7 18.5z"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>'),
    share: svg('<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4M8.2 13.2l7.6 4"/>'),
    download: svg('<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>'),
    upload: svg('<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'),
    check: svg('<path d="M4.5 12.5l5 5 10-11"/>'),
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
    edit: svg('<path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z"/><path d="M13.5 6.5l3 3"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>'),
    phone: svg('<path d="M6.5 3.5h3l1.5 4-2 1.5a13 13 0 0 0 6 6l1.5-2 4 1.5v3A2.5 2.5 0 0 1 18 20 15 15 0 0 1 4 6a2.5 2.5 0 0 1 2.5-2.5z"/>'),
    search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'),
    arrow: svg('<path d="M9 5l7 7-7 7"/>'),
    alert: svg('<path d="M12 3l9.5 17h-19z"/><path d="M12 9v5M12 17.5v.2"/>'),
    clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 2"/>'),
    refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 6.6"/><path d="M20 4v7h-7"/>'),
    lock: svg('<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    crown: svg('<path d="M3 7l4.5 4L12 4l4.5 7L21 7l-1.5 12h-15z"/><path d="M6 19h12"/>'),
    spark: svg('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>'),
    money: svg('<circle cx="12" cy="12" r="8.5"/><path d="M9 8h5a2.5 2.5 0 0 1 0 5H9M9 13h6M9 8v9M12.5 6v2.5M12.5 15.5V18"/>'),
    room: svg('<path d="M4 21V4.5h16V21"/><path d="M4 21h16M9 21v-5h6v5"/><circle cx="15.5" cy="12" r=".8" fill="currentColor" stroke="none"/>'),
    swap: svg('<path d="M4 8h14l-3-3M20 16H6l3 3"/>'),
    help: svg('<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.7v.4"/><circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>')
  };

  /* ---------- 基础工具 ---------- */
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const alive = (arr) => (arr || []).filter((x) => x && !x.deleted);
  const truncate = (s, n) => (String(s || '').length > n ? String(s).slice(0, n) + '…' : String(s || ''));
  const roleName = () => (session && ROLES[session.role] ? ROLES[session.role].name : '');

  function toast(msg) {
    const w = $('#toastWrap');
    if (!w) return;
    w.innerHTML = '<div class="toast">' + esc(msg) + '</div>';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { w.innerHTML = ''; }, 2300);
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      toast('已复制');
    } catch (e) {
      toast('复制失败，请长按手动复制');
    }
  }
  function download(name, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function b64e(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64d(str) {
    let s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function syncReady() { return !!(window.CJXSync && window.CJXSync.isAuthed()); }
  function cloudConfigured() { return !!(window.CJXSync && window.CJXSync.isConfigured()); }
  function pageUrl(file) { try { return new URL(file, location.href).href; } catch (e) { return file; } }
  // 托管平台（app.workbuddy.host）用 sharecode 做访问凭证：任何不带它的链接都会 403「链接不完整」。
  // 生成二维码 / 菜单链接 / 邀请函链接时必须把它带上，否则别人的手机打不开。
  function shareCode() {
    try { return new URLSearchParams(location.search).get('sharecode') || ''; } catch (e) { return ''; }
  }
  function pageLink(file, params) {
    try {
      const u = new URL(file, location.href);
      u.hash = '';
      const sc = shareCode();
      if (sc) u.searchParams.set('sharecode', sc);
      Object.keys(params || {}).forEach((k) => u.searchParams.set(k, String(params[k])));
      return u.href;
    } catch (e) { return file; }
  }

  /* ---------- 状态 ---------- */
  let S = loadState();
  let session = loadSession();
  let ui = {
    view: '', params: {}, stack: [],
    orderFilter: 'today', orderSearch: '',
    custSearch: '', ledgerSearch: '', ledgerFilter: 'all',
    calDate: D.todayStr(), prepDate: D.todayStr(), boardDate: D.todayStr(),
    dishSearch: '', form: null, pendingAction: null, busy: false, autoPinRole: null,
    lastSyncAt: '', cloudMsg: ''
  };
  if (!session) ui.view = 'gate';
  else ui.view = session.role === 'service' ? 'board' : (session.role === 'kitchen' ? 'dishes' : 'home');

  /* ---------- 示例数据（按需加载：demo.js 不进首屏） ---------- */
  const ASSET_VER = String(D.APP_VERSION || '1');
  let demoPromise = null;
  function loadDemoScript() {
    if (window.CJXDemo && window.CJXDemo.seedDemo) return Promise.resolve();
    if (demoPromise) return demoPromise;
    demoPromise = new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = 'demo.js?v=' + ASSET_VER;
      s.async = true;
      s.onload = function () {
        if (window.CJXDemo && window.CJXDemo.seedDemo) resolve();
        else { demoPromise = null; reject(new Error('示例数据文件内容异常')); }
      };
      s.onerror = function () { demoPromise = null; reject(new Error('示例数据加载失败')); };
      document.head.appendChild(s);
    });
    return demoPromise;
  }
  function seedDemo(S) {
    if (window.CJXDemo && window.CJXDemo.seedDemo) { window.CJXDemo.seedDemo(S); return true; }
    return false;
  }

  function loadState() {
    let s = null;
    try {
      const raw = localStorage.getItem(LS_STATE);
      if (raw) s = JSON.parse(raw);
    } catch (e) { s = null; }
    if (!s || typeof s !== 'object') s = D.defaultState();
    return migrate(s);
  }
  function migrate(s) {
    s.meta = s.meta || {};
    s.settings = Object.assign(D.defaultSettings(), s.settings || {});
    s.settings.pins = Object.assign({ boss: '', manager: '', kitchen: '', service: '' }, s.settings.pins || {});
    if (!s.settings.cuisine) s.settings.cuisine = '福安菜 × 厦门海鲜';
    delete s.settings.mealFocus;
    s.rooms = Array.isArray(s.rooms) ? s.rooms : D.defaultRooms();
    // 包厢容量迁移：VIP1/VIP2 → 10–12 人，VIP3 → 15–18 人；自定义包厢按原座位数兜底
    s.rooms.forEach((r) => {
      if (!r) return;
      const name = String(r.name || '');
      if (r.maxSeats == null || r.minSeats == null) {
        if (/^VIP\s*1$/i.test(name) || /^VIP\s*2$/i.test(name)) { r.minSeats = r.minSeats || 10; r.maxSeats = r.maxSeats || 12; }
        else if (/^VIP\s*3$/i.test(name)) { r.minSeats = r.minSeats || 15; r.maxSeats = r.maxSeats || 18; }
        else { r.maxSeats = r.maxSeats || Number(r.seats) || 10; r.minSeats = r.minSeats || Math.max(1, r.maxSeats - 2); }
      }
      r.seats = Number(r.maxSeats) || Number(r.seats) || 10;
    });
    s.dishes = Array.isArray(s.dishes) ? s.dishes : D.defaultDishes();
    s.customers = Array.isArray(s.customers) ? s.customers : [];
    s.orders = Array.isArray(s.orders) ? s.orders : [];
    s.orders.forEach((o) => {
      o.serviceChecks = Object.assign({ tableware: false, pitcher: false, water: false, drink: false }, o.serviceChecks || {});
      if (!o.flow && (o.dishes || []).length) o.flow = { stage: (o.inviteCode || o.status === 'done') ? 'confirmed' : 'menu', at: o.updatedAt || D.nowISO(), by: '系统迁移', history: [] };
    });
    s.rsvps = Array.isArray(s.rsvps) ? s.rsvps : [];
    // 门店地址迁移：旧演示地址/空地址 → 厦门新址；旧演示经纬度作废，避免导航定位到错误坐标
    const addr = String(s.settings.address || '');
    if (!addr || addr.indexOf('富春大道') >= 0) {
      s.settings.address = '厦门市湖里区天地建材城综合楼东侧二楼';
    }
    const demoCoords = [['27.09', '119.65'], ['24.4923', '118.1318']];
    demoCoords.forEach(function (c) {
      if (String(s.settings.lat || '').indexOf(c[0]) === 0 && String(s.settings.lng || '').indexOf(c[1]) === 0) {
        s.settings.lat = '';
        s.settings.lng = '';
      }
    });
    // 门店电话 / 专属经理：旧演示值或空值 → 正式联系方式
    const oldPhones = ['0593-6688999', '0592-6688999', '13805926688'];
    if (!s.settings.phone || oldPhones.indexOf(String(s.settings.phone).trim()) >= 0) s.settings.phone = '18950071506';
    if (!s.settings.managerName || s.settings.managerName === '陈经理') s.settings.managerName = '陈锦长';
    if (!s.settings.managerPhone || oldPhones.indexOf(String(s.settings.managerPhone).trim()) >= 0) s.settings.managerPhone = '18950071506';
    s.meta.schemaVersion = 3;
    return s;
  }
  function loadSession() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_SESSION) || 'null');
      return s && s.role && ROLES[s.role] ? s : null;
    } catch (e) { return null; }
  }
  function snapshots() {
    try { return JSON.parse(localStorage.getItem(LS_SNAPS) || '[]'); } catch (e) { return []; }
  }
  /* 快照只保留可恢复的数据，剔掉 _dirty 这类运行时标记，避免体积和噪音 */
  function snapshotState() {
    return JSON.parse(JSON.stringify(S, function (k, v) {
      if (k === '_dirty' || k === 'settingsDirty') return undefined;
      return v;
    }));
  }
  const SNAP_MIN_GAP = 120000; // 自动快照最小间隔：2 分钟（关键动作可用 snap:true 强制）
  let lastSnapAt = 0;
  function saveState(opts) {
    opts = opts || {};
    if (!opts.noRev) { S.meta.rev = (S.meta.rev || 0) + 1; S.meta.updatedAt = D.nowISO(); }
    const wantSnap = !opts.noSnap && (opts.snap === true || Date.now() - lastSnapAt >= SNAP_MIN_GAP);
    if (wantSnap) {
      const snaps = snapshots();
      snaps.push({ at: D.nowISO(), rev: S.meta.rev, state: snapshotState() });
      while (snaps.length > 10) snaps.shift();
      try {
        localStorage.setItem(LS_SNAPS, JSON.stringify(snaps));
        lastSnapAt = Date.now();
      } catch (e) {
        // 空间不足时只留最近 4 份，保证还有得恢复
        try { localStorage.setItem(LS_SNAPS, JSON.stringify(snaps.slice(-4))); lastSnapAt = Date.now(); } catch (e2) { }
      }
    }
    try { localStorage.setItem(LS_STATE, JSON.stringify(S)); } catch (e) { toast('本地存储空间不足'); }
    if (!opts.noPush) schedulePush();
  }
  function touch(o) { o.updatedAt = D.nowISO(); o._dirty = true; }
  function touchSettings() { S.meta.settingsUpdatedAt = D.nowISO(); S.meta.settingsDirty = true; }

  /* ---------- 云端同步 ---------- */
  let pushTimer = null;
  function schedulePush() {
    if (!syncReady()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushDirty(false); }, 900);
  }
  // 包厢人数区间存在 note（JSON）里，旧云端表不用改结构也能同步
  function roomNoteOf(r) {
    return JSON.stringify({ min: Number(r.minSeats) || 0, max: Number(r.maxSeats) || Number(r.seats) || 0 });
  }
  function roomCapFromNote(note, seats) {
    try {
      const o = JSON.parse(String(note || ''));
      if (o && typeof o === 'object' && (o.min || o.max)) return { min: Number(o.min) || 0, max: Number(o.max) || Number(seats) || 0 };
    } catch (e) { }
    return { min: 0, max: Number(seats) || 0 };
  }
  function toDb(type, o) {
    if (type === 'rooms') return { id: o.id, name: o.name, seats: Number(o.maxSeats) || Number(o.seats) || 0, sort: o.sort || 0, enabled: o.enabled !== false, note: roomNoteOf(o), updated_at: o.updatedAt, deleted: !!o.deleted };
    if (type === 'dishes') return { id: o.id, name: o.name, category: o.category, price: Number(o.price) || 0, status: o.status, lead_days: Number(o.leadDays) || 0, tags: o.tags || [], flavor: o.flavor || [], note: o.note || '', updated_at: o.updatedAt, deleted: !!o.deleted };
    if (type === 'customers') return { id: o.id, name: o.name, aliases: o.aliases || [], wechat: o.wechat || '', phone: o.phone || '', tags: o.tags || [], dietary: o.dietary || [], taste_tags: o.tasteTags || [], taste_scores: o.tasteScores || {}, dish_counts: o.dishCounts || {}, pref_room: o.prefRoom || '', notes: o.notes || '', visit_count: Number(o.visitCount) || 0, last_visit: o.lastVisit || null, budget_pref: o.budgetPref || null, budget_mode: o.budgetMode || 'table', updated_at: o.updatedAt, deleted: !!o.deleted };
    if (type === 'orders') return { id: o.id, code: o.code, status: o.status, date: o.date, time: o.time, party_size: Number(o.partySize) || 0, room_id: o.roomId || '', customer_id: o.customerId || '', customer_name: o.customerName || '', phone: o.phone || '', wechat: o.wechat || '', occasion: o.occasion || '', dishes: o.dishes || [], dietary: o.dietary || [], taste_hints: o.tasteHints || [], special: o.special || '', host_name: o.hostName || '', notes: o.notes || '', budget: o.budget || null, budget_mode: o.budgetMode || 'table', menu_source: o.menuSource || 'manual', guests: o.guests || [], service_checks: o.serviceChecks || {}, invite_code: o.inviteCode || '', invite_at: o.inviteAt || null, missing: o.missing || [], change_log: o.changeLog || [], audit: Object.assign({}, o.audit || {}, { flow: o.flow || null, menuConfirmed: !!o.menuConfirmed, menuConfirmedAt: o.menuConfirmedAt || null }), change_pending: !!o.changePending, updated_at: o.updatedAt, deleted: !!o.deleted };
    if (type === 'rsvps') return { id: o.id, order_id: o.orderId, invite_code: o.inviteCode || '', guest_name: o.guestName || '', phone: o.phone || '', attend: o.attend !== false, dietary: o.dietary || [], party_size: Number(o.partySize) || 1, submitted_at: o.submittedAt || D.nowISO(), source: o.source || 'invite' };
    return o;
  }
  function fromDb(type, r) {
    if (type === 'rooms') { const cap = roomCapFromNote(r.note, r.seats); return { id: r.id, name: r.name, seats: cap.max || r.seats, minSeats: cap.min, maxSeats: cap.max || r.seats, sort: r.sort, enabled: r.enabled, note: '', updatedAt: r.updated_at, deleted: !!r.deleted, _dirty: false }; }
    if (type === 'dishes') return { id: r.id, name: r.name, category: r.category, price: Number(r.price) || 0, status: r.status, leadDays: r.lead_days || 0, tags: r.tags || [], flavor: r.flavor || [], note: r.note || '', updatedAt: r.updated_at, deleted: !!r.deleted, _dirty: false };
    if (type === 'customers') return { id: r.id, name: r.name, aliases: r.aliases || [], wechat: r.wechat || '', phone: r.phone || '', tags: r.tags || [], dietary: r.dietary || [], tasteTags: r.taste_tags || [], tasteScores: r.taste_scores || {}, dishCounts: r.dish_counts || {}, prefRoom: r.pref_room || '', notes: r.notes || '', visitCount: r.visit_count || 0, lastVisit: r.last_visit || '', budgetPref: r.budget_pref || null, budgetMode: r.budget_mode || 'table', updatedAt: r.updated_at, deleted: !!r.deleted, _dirty: false };
    if (type === 'orders') return { id: r.id, code: r.code, status: r.status, date: r.date, time: r.time, partySize: r.party_size, roomId: r.room_id || '', customerId: r.customer_id || '', customerName: r.customer_name || '', phone: r.phone || '', wechat: r.wechat || '', occasion: r.occasion || '', dishes: r.dishes || [], dietary: r.dietary || [], tasteHints: r.taste_hints || [], special: r.special || '', hostName: r.host_name || '', notes: r.notes || '', budget: r.budget || null, budgetMode: r.budget_mode || 'table', menuSource: r.menu_source || 'manual', guests: r.guests || [], serviceChecks: Object.assign({ tableware: false, pitcher: false, water: false, drink: false }, r.service_checks || {}), inviteCode: r.invite_code || '', inviteAt: r.invite_at || '', missing: r.missing || [], changeLog: r.change_log || [], audit: r.audit || {}, flow: (r.audit || {}).flow || null, menuConfirmed: !!(r.audit || {}).menuConfirmed, menuConfirmedAt: (r.audit || {}).menuConfirmedAt || '', changePending: !!r.change_pending, updatedAt: r.updated_at, deleted: !!r.deleted, _dirty: false };
    if (type === 'rsvps') return { id: r.id, orderId: r.order_id, inviteCode: r.invite_code || '', guestName: r.guest_name || '', phone: r.phone || '', attend: r.attend !== false, dietary: r.dietary || [], partySize: r.party_size || 1, submittedAt: r.submitted_at, source: r.source || 'invite' };
    return r;
  }
  function collectDirty() {
    const payload = { rooms: [], dishes: [], customers: [], orders: [], rsvps: [] };
    let any = false;
    const types = ['rooms', 'dishes', 'customers', 'orders', 'rsvps'];
    types.forEach((t) => {
      (S[t] || []).forEach((o) => {
        if (o._dirty) { payload[t].push(toDb(t, o)); any = true; }
      });
    });
    if (S.meta.settingsDirty) {
      payload.settings = { id: 1, doc: S.settings, updated_at: S.meta.settingsUpdatedAt || D.nowISO() };
      any = true;
    }
    return any ? payload : null;
  }
  async function pushDirty(manual, force) {
    if (!syncReady()) { if (manual) toast('请先在设置里登录同步账号'); return; }
    if (ui.busy && !force) return;
    const payload = collectDirty();
    if (!payload) { if (manual) toast('已是最新'); return; }
    ui.busy = true;
    try {
      await window.CJXSync.pushAll(payload);
      const types = ['rooms', 'dishes', 'customers', 'orders', 'rsvps'];
      types.forEach((t) => {
        payload[t].forEach((row) => {
          const local = (S[t] || []).find((x) => x.id === row.id);
          if (local && local.updatedAt === row.updated_at) local._dirty = false;
        });
      });
      if (payload.settings) S.meta.settingsDirty = false;
      S.meta.lastSyncedAt = D.nowISO();
      localStorage.setItem(LS_STATE, JSON.stringify(S));
      if (manual) toast('已同步到云端');
    } catch (e) {
      toast('同步失败：' + e.message);
    } finally { ui.busy = false; }
  }
  function mergeRemote(data) {
    ['rooms', 'dishes', 'customers', 'orders'].forEach((t) => {
      (data[t] || []).forEach((row) => {
        const remote = fromDb(t, row);
        const arr = S[t] || (S[t] = []);
        const idx = arr.findIndex((x) => x.id === remote.id);
        if (idx < 0) arr.push(remote);
        else if (!arr[idx]._dirty && String(remote.updatedAt || '') > String(arr[idx].updatedAt || '')) arr[idx] = remote;
      });
    });
    if (data.settings && data.settings[0]) {
      const row = data.settings[0];
      if (String(row.updated_at || '') > String(S.meta.settingsUpdatedAt || '')) {
        S.settings = Object.assign(D.defaultSettings(), row.doc || {});
        S.settings.pins = Object.assign({ boss: '', manager: '', kitchen: '', service: '' }, S.settings.pins || {});
        S.meta.settingsUpdatedAt = row.updated_at;
        S.meta.settingsDirty = false;
      }
    }
    (data.rsvps || []).forEach((row) => {
      const r = fromDb('rsvps', row);
      if (!S.rsvps.some((x) => x.id === r.id)) S.rsvps.push(r);
    });
    attachRsvps();
    localStorage.setItem(LS_STATE, JSON.stringify(S));
  }
  function attachRsvps() {
    (S.rsvps || []).forEach((r) => {
      const o = (S.orders || []).find((x) => x.id === r.orderId);
      if (!o || o.deleted) return;
      o.guests = o.guests || [];
      if (o.guests.some((g) => g.id === r.id)) return;
      o.guests.push({ id: r.id, name: r.guestName, phone: r.phone, attend: r.attend, dietary: r.dietary || [], partySize: r.partySize || 1, submittedAt: r.submittedAt, source: r.source });
      o.changeLog = o.changeLog || [];
      o.changeLog.push({ at: D.nowISO(), by: '系统', text: '收到亲友回执：' + (r.guestName || '亲友') + (r.attend ? ' 到场' : ' 缺席') });
      touch(o);
    });
  }
  function markAllDirty() {
    ['rooms', 'dishes', 'customers', 'orders'].forEach((t) => {
      (S[t] || []).forEach((o) => { o._dirty = true; });
    });
    S.meta.settingsDirty = true;
    S.meta.settingsUpdatedAt = D.nowISO();
  }
  /* 增量同步游标：记录上次拉到的 updated_at，避免每 22 秒全表重拉 */
  let pullCursor = (function () { try { return localStorage.getItem(LS_CURSOR) || ''; } catch (e) { return ''; } })();
  let pullRounds = 0;
  const FULL_PULL_EVERY = 30;   // 每 30 轮（约 11 分钟）全量兜底一次，防止设备时钟偏差漏行
  function resetPullCursor() {
    pullCursor = ''; pullRounds = 0;
    try { localStorage.removeItem(LS_CURSOR); } catch (e) { }
  }
  async function syncPull(manual) {
    if (!syncReady()) { if (manual) toast('请先在设置里登录同步账号'); return; }
    if (ui.busy) return;
    ui.busy = true;
    try {
      // 增量拉取：只取上次之后有变动的行；没有游标、或到兜底轮次时才全量
      pullRounds++;
      const fullPull = !pullCursor || pullRounds % FULL_PULL_EVERY === 0;
      const data = await window.CJXSync.pullAll(fullPull ? null : { since: pullCursor, overlap: manual ? 600 : 300 });
      mergeRemote(data);
      if (data._cursor) {
        pullCursor = data._cursor;
        try { localStorage.setItem(LS_CURSOR, pullCursor); } catch (e) { }
      }
      // 只有全量拉取时，"远端为空"才代表需要把本机数据补上去（首次登录尤其重要）
      if (fullPull) {
        ['rooms', 'dishes', 'customers', 'orders'].forEach((t) => {
          if (!(data[t] || []).length) (S[t] || []).forEach((o) => { o._dirty = true; });
        });
        if (!(data.settings || []).length) { S.meta.settingsDirty = true; S.meta.settingsUpdatedAt = D.nowISO(); }
      }
      S.meta.lastSyncedAt = D.nowISO();
      ui.lastSyncAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      await pushDirty(false, true);
      saveState({ noPush: true, noSnap: true, noRev: true });
      if (manual) toast(fullPull ? '已同步（全量）' : '已同步');
      refreshCurrent();
    } catch (e) {
      toast('同步失败：' + e.message);
    } finally { ui.busy = false; }
  }

  /* ---------- 通用查询 ---------- */
  function roomName(id) { return D.roomName(S, id); }
  function enabledRooms() { return alive(S.rooms).filter((r) => r.enabled !== false).sort((a, b) => (a.sort || 0) - (b.sort || 0)); }
  function can(cap) { const p = PERMS[session && session.role]; return !!(p && p[cap]); }
  function roomCapText(r) { return D.roomCapText(r); }
  function roomOccupied(roomId, date, time, excludeId) {
    return alive(S.orders).find((o) => o.id !== excludeId && o.roomId === roomId && o.date === date &&
      ['pending', 'confirmed', 'notified'].includes(o.status) && Math.abs(toMinutes(o.time) - toMinutes(time)) < 150);
  }
  function roomOptions(date, time, party, excludeId) {
    const n = Number(party) || 0;
    return enabledRooms().map((r) => {
      const cap = D.roomCap(r);
      const conflict = roomOccupied(r.id, date, time, excludeId);
      let fit = 'ok';
      if (cap.max && n > cap.max) fit = 'small';        // 坐不下
      else if (cap.min && n < cap.min) fit = 'big';     // 偏大
      return { room: r, cap, fit, conflict: conflict ? (conflict.customerName || '已有预定') : '' };
    });
  }
  // AI 配菜时自动选包厢：优先「刚好坐得下、且不冲突」的最小包厢
  function suggestRoom(date, time, party, excludeId) {
    const opts = roomOptions(date, time, party, excludeId).filter((x) => !x.conflict);
    const ok = opts.filter((x) => x.fit === 'ok').sort((a, b) => a.cap.max - b.cap.max);
    if (ok.length) return { room: ok[0].room, reason: '刚好合适（' + roomCapText(ok[0].room) + '）', overflow: false };
    const big = opts.filter((x) => x.fit === 'big').sort((a, b) => a.cap.max - b.cap.max);
    if (big.length) return { room: big[0].room, reason: '略大但可用（' + roomCapText(big[0].room) + '）', overflow: false };
    const maxRoom = enabledRooms().map((r) => D.roomCap(r).max).sort((a, b) => b - a)[0] || 0;
    return { room: null, reason: Number(party) > maxRoom ? '超过最大包厢 ' + maxRoom + ' 人，建议拆两桌或加位' : '当天该时段包厢已被占用', overflow: Number(party) > maxRoom };
  }
  function orderName(o) {
    const name = (o && o.customerName) || '未称呼';
    const tail = D.phoneTail(o && o.phone);
    if (!tail) return name;
    const first = name.slice(0, 1);
    const conflict = alive(S.orders).some((x) => x.id !== o.id && (x.customerName || '').slice(0, 1) === first &&
      D.phoneTail(x.phone) && D.phoneTail(x.phone) !== tail) ||
      alive(S.customers).some((c) => (c.name || '').slice(0, 1) === first && D.phoneTail(c.phone) && D.phoneTail(c.phone) !== tail);
    return conflict ? name + '（尾' + tail + '）' : name;
  }
  function custLabel(c) {
    if (!c) return '';
    const tail = D.phoneTail(c.phone);
    if (!tail) return c.name;
    const first = (c.name || '').slice(0, 1);
    const conflict = alive(S.customers).some((x) => x.id !== c.id && (x.name || '').slice(0, 1) === first && D.phoneTail(x.phone) && D.phoneTail(x.phone) !== tail);
    return conflict ? c.name + '（尾' + tail + '）' : c.name;
  }
  function orderFlow(o) {
    const stage = o && o.flow && o.flow.stage;
    if (stage && FLOW_STEPS.some((s) => s.key === stage)) return stage;
    if (!o) return 'new';
    if (o.menuConfirmed || o.inviteCode) return 'confirmed';
    if ((o.dishes || []).length) return 'menu';
    return 'new';
  }
  function setFlow(o, stage, note) {
    o.flow = o.flow || { stage: 'new', history: [] };
    o.flow.stage = stage;
    o.flow.at = D.nowISO();
    o.flow.by = roleName();
    o.flow.history = o.flow.history || [];
    o.flow.history.push({ at: o.flow.at, by: roleName(), stage, note: note || '' });
    const step = FLOW_STEPS.find((s) => s.key === stage);
    if (step) addLog(o, '流程：' + step.label + (note ? '（' + note + '）' : ''));
    touch(o);
  }
  function servicePrepItems(o) {
    const n = Number(o.partySize) || 0;
    return SERVICE_CHECKS.map((k) => ({ key: k.key, label: k.label, unit: k.unit, qty: k.calc(n), hint: k.hint }));
  }
  function orderCustomer(o) {
    if (!o) return null;
    if (o.customerId) { const c = (S.customers || []).find((x) => x.id === o.customerId && !x.deleted); if (c) return c; }
    return D.findCustomer(S, { phone: o.phone, name: o.customerName, wechat: o.wechat });
  }
  function customerOrders(c) {
    return alive(S.orders).filter((o) => o.customerId === c.id || (c.phone && o.phone === c.phone) || (c.name && (o.customerName === c.name || (c.aliases || []).includes(o.customerName)))).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }
  function customerFavs(c) { return D.favDishesOf(c, 5); }
  function customerStats(c) {
    const list = customerOrders(c);
    const done = list.filter((o) => o.status === 'done');
    let spend = 0; done.forEach((o) => { const t = D.orderTotal(o); if (t) spend += t; });
    return { list, done, spend, lastVisit: c.lastVisit || (done[0] && done[0].date) || '' };
  }
  function findConflict(order) {
    return alive(S.orders).find((o) => o.id !== order.id && o.roomId === order.roomId && o.date === order.date && ['pending', 'confirmed', 'notified'].includes(o.status) && Math.abs(toMinutes(o.time) - toMinutes(order.time)) < 150);
  }
  function toMinutes(t) { const p = String(t || '0:0').split(':'); return (Number(p[0]) || 0) * 60 + (Number(p[1]) || 0); }
  function nowGreeting() { const h = new Date().getHours(); if (h < 11) return '早上好'; if (h < 14) return '中午好'; if (h < 18) return '下午好'; return '晚上好'; }
  function statusBadge(o) {
    if (o.status === 'pending' && o.changePending) return '<span class="status warn">改单待审</span>';
    const st = STATUS[o.status] || STATUS.pending;
    return '<span class="status ' + st.cls + '">' + st.label + '</span>';
  }
  function chip(text, cls) { return '<span class="chip ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function missingCount(o) { return (o.missing || []).length; }
  function serviceCheckState(o) {
    const checks = o.serviceChecks || {};
    const done = SERVICE_CHECKS.filter((k) => checks[k.key]).length;
    return { checks, done, total: SERVICE_CHECKS.length };
  }
  function serviceCheckHtml(o, compact, noHead) {
    const st = serviceCheckState(o);
    const editable = ['service', 'boss', 'manager'].includes(session.role) && ['confirmed', 'notified', 'done'].includes(o.status);
    const items = servicePrepItems(o);
    return '<div class="svc-row ' + (compact ? 'compact' : '') + '">' + (noHead ? '' : '<div class="svc-head"><span>开台准备 · ' + (o.partySize || 0) + ' 人</span><b class="' + (st.done === st.total ? 'all' : '') + '">' + st.done + '/' + st.total + '</b></div>') + '<div class="svc-items">' +
      items.map((k) => {
        const on = !!st.checks[k.key];
        const inner = '<span class="sc-box">' + (on ? '✓' : '') + '</span>' + k.label + '<b class="svc-qty">' + k.qty + '</b><span class="svc-unit">' + k.unit + '</span>';
        if (!editable) return '<span class="svc-btn ' + (on ? 'on' : '') + '" title="' + esc(k.hint) + '">' + inner + '</span>';
        return '<button type="button" class="svc-btn ' + (on ? 'on' : '') + '" data-act="toggle-service-check" data-id="' + o.id + '" data-key="' + k.key + '" title="' + esc(k.hint) + '">' + inner + '</button>';
      }).join('') + '</div></div>';
  }
  function servicePrepText(o, compact) {
    const room = roomName(o.roomId) || '包厢待定';
    const head = (compact ? '' : S.settings.shopName + ' · ' + D.fmtDateCN(o.date) + ' ') + o.time + ' ' + room + ' · ' + (o.partySize || '?') + ' 位';
    return [head, ...servicePrepItems(o).map((k) => '· ' + k.label + ' ' + k.qty + ' ' + k.unit)].join('\n');
  }

  /* ---------- 视图渲染 ---------- */
  function render(opts) {
    opts = opts || {};
    const app = $('#app');
    if (!app) return;
    if (!session || ui.view === 'gate') { app.innerHTML = viewGate(); return; }
    if (!ui.view) ui.view = 'home';
    const sub = SUBVIEWS.includes(ui.view);
    const tabs = TABS[session.role] || TABS.boss;
    const activeTab = tabs.some((t) => t[0] === ui.view) ? ui.view : (ui.view === 'ledger' ? 'more' : '');
    const html = '<div class="shell">' + topbar() + '<main id="view">' + viewFor(ui.view) + '</main>' +
      (sub ? '' : tabbar(tabs, activeTab)) + fab() + '</div>';
    app.innerHTML = html;
    if (opts.scroll !== false) window.scrollTo(0, 0);
  }
  function refreshCurrent() {
    if (!session || ui.view === 'gate') return;
    if (ui.view === 'orderForm') return;
    if (ui.view === 'orderDetail') {
      render({ scroll: false });
      return;
    }
    render({ scroll: false });
  }
  function viewFor(v) {
    switch (v) {
      case 'home': return viewHome();
      case 'orders': return viewOrders();
      case 'orderForm': return viewOrderForm();
      case 'orderDetail': return viewOrderDetail();
      case 'calendar': return viewCalendar();
      case 'customers': return viewCustomers();
      case 'customerDetail': return viewCustomerDetail();
      case 'dishes': return viewDishes();
      case 'prep': return viewPrep();
      case 'board': return viewBoard();
      case 'ledger': return viewLedger();
      case 'more': return viewMore();
      case 'settings': return viewSettings();
      default: return viewHome();
    }
  }
  function viewTitle() {
    return ({
      home: '首页', orders: '预定订单', orderForm: ui.form && ui.form.mode === 'edit' ? '修改预定' : '新建预定',
      orderDetail: '预定详情', calendar: '包厢日历', customers: '熟客档案', customerDetail: '熟客档案',
      dishes: '时令菜品', prep: '备货清单', board: '接待看板', ledger: '历史台账', more: '更多',
      settings: '设置'
    })[ui.view] || '长季鲜';
  }
  function topbar() {
    const sub = SUBVIEWS.includes(ui.view);
    const role = ROLES[session.role] || ROLES.boss;
    const dot = syncReady() ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#8fd3ae;margin-left:6px;vertical-align:1px"></span>' :
      (cloudConfigured() ? '<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#e2b158;margin-left:6px;vertical-align:1px"></span>' : '');
    const title = sub ? viewTitle() : S.settings.shopName;
    const subline = sub ? (ui.view === 'orderDetail' && selectedOrder() ? selectedOrder().code : (S.settings.cuisine || '私厨会所')) :
      ((S.settings.cuisine || '私厨会所') + ' · ' + D.fmtDateCN(D.todayStr()) + ' ' + D.weekdayCN(D.todayStr()));
    return '<header class="topbar">' +
      (sub ? '<button class="icon-btn back-btn" data-act="back" aria-label="返回">' + I.back + '</button>' : '') +
      '<div class="tb-left"><div class="tb-title">' + esc(title) + '</div><div class="tb-sub">' + esc(subline) + '</div></div>' +
      '<div class="tb-actions"><button class="role-chip" data-act="switch-role">' + esc(role.name) + dot + '</button></div>' +
      '</header>';
  }
  function tabbar(tabs, active) {
    const pending = alive(S.orders).filter((o) => o.status === 'pending').length;
    return '<nav class="tabbar">' + tabs.map((t) => {
      const on = t[0] === active;
      return '<button class="tab ' + (on ? 'on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + I[t[2]] + '<span>' + t[1] + '</span>' +
        (t[0] === 'orders' && pending ? '<span class="t-badge">' + pending + '</span>' : '') + '</button>';
    }).join('') + '</nav>';
  }
  function fab() {
    if (!['home', 'orders', 'calendar'].includes(ui.view)) return '';
    if (!['boss', 'manager'].includes(session.role)) return '';
    return '<button class="fab" data-act="new-order" aria-label="新建预定">' + I.plus + '</button>';
  }

  /* ---------- 入口 / 角色 ---------- */
  function viewGate() {
    if (!S.meta.onboarded) {
      return '<div class="gate"><div class="gate-card">' +
        '<div class="gate-logo">鲜</div>' +
        '<h1>长季鲜</h1><div class="gate-sub">' + esc(S.settings.cuisine || '福安菜 × 厦门海鲜') + ' · 私厨会所</div>' +
        '<div class="welcome-perks">' +
          '<div>' + I.chat + '<span>老板转发微信聊天，自动整理成要素齐全的预定单</span></div>' +
          '<div>' + I.money + '<span>只给人数和餐标，也能按口味自动配一桌菜</span></div>' +
          '<div>' + I.users + '<span>熟客口味、忌口、常点菜记在档案里，二次接待更稳</span></div>' +
          '<div>' + I.cloud + '<span>老板、店长、后厨、服务员多台手机同步</span></div>' +
        '</div>' +
        '<div class="welcome-actions"><button class="btn gold block" data-act="load-demo">载入示例数据，先体验</button>' +
        '<button class="btn ghost block" data-act="start-blank">从空白开始</button></div>' +
        '<div class="gate-note">示例数据只存在本机，随时可以在设置里清空。多人同步需要先对接 Supabase，具体步骤在设置里。</div>' +
        '</div></div>';
    }
    return '<div class="gate"><div class="gate-card">' +
      '<div class="gate-logo">鲜</div><h1>长季鲜</h1>' +
      '<div class="gate-sub">' + esc(S.settings.cuisine || '福安菜 × 厦门海鲜') + ' · 选择角色</div>' +
      '<div class="role-list">' + Object.keys(ROLES).map((k) => {
        const r = ROLES[k];
        return '<button class="role-btn" data-act="pick-role" data-role="' + k + '"><div class="r-ico">' + I[r.icon] + '</div>' +
          '<div><div class="r-title">' + r.name + '</div><div class="r-sub">' + r.desc + '</div></div>' +
          '<span class="r-go">' + I.arrow + '</span></button>';
      }).join('') + '</div>' +
      '<div class="gate-note">同一台设备固定用一个角色。多人同时使用请先在「设置 → 多人同步」登录同一个账号。</div>' +
      '</div></div>';
  }
  function enterRole(role) {
    session = { role, at: D.nowISO() };
    localStorage.setItem(LS_SESSION, JSON.stringify(session));
    ui.view = role === 'service' ? 'board' : (role === 'kitchen' ? 'dishes' : 'home');
    ui.stack = [];
    render();
  }
  function requestRole(role) {
    const pin = (S.settings.pins || {})[role];
    if (pin) { openPinSheet(role); return; }
    enterRole(role);
  }
  function openPinSheet(role) {
    openSheet('<h3>' + ROLES[role].name + ' · 输入密码</h3><p class="sheet-sub">这台设备给' + ROLES[role].name + '使用，输入 4 位密码进入。</p>' +
      '<div class="field"><input id="pinInput" type="password" inputmode="numeric" maxlength="4" placeholder="4 位数字" autofocus></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn primary" data-act="pin-ok" data-role="' + role + '">进入</button></div>');
  }

  /* ---------- 首页 ---------- */
  function viewHome() {
    const t = D.todayStr();
    const todayOrders = alive(S.orders).filter((o) => o.date === t && o.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));
    const pending = alive(S.orders).filter((o) => o.status === 'pending').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const tomorrow = alive(S.orders).filter((o) => o.date === D.addDays(t, 1) && o.status !== 'cancelled').sort((a, b) => a.time.localeCompare(b.time));
    const vipOrders = todayOrders.filter((o) => { const c = orderCustomer(o); return c && (c.tags || []).some((x) => /VIP|老友/i.test(x)); });
    // 流程待办：老板 → 店长配菜；店长 → 出菜单；老板 → 发客户
    const todo = alive(S.orders).filter((o) => ['pending', 'confirmed', 'notified'].includes(o.status)).filter((o) => {
      const st = orderFlow(o);
      if (session.role === 'manager') return st === 'manager';
      if (session.role === 'boss') return st === 'boss';
      return false;
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const todoLabel = session.role === 'manager' ? '待我配菜' : '待我发客户';
    return '<div class="hero"><div class="hero-date">' + D.fmtDateCN(t) + ' · ' + D.weekdayCN(t) + ' · ' + esc(S.settings.cuisine || '') + '</div>' +
      '<h2>' + nowGreeting() + '，' + esc(roleName()) + '</h2><p>' + (todayOrders.length ? '今天有 ' + todayOrders.length + ' 桌客人，忙而不乱。' : '今天还没有预定，先把客人接住。') + '</p>' +
      '<div class="hero-stats">' +
        '<div class="hstat"><b>' + todayOrders.length + '</b><span>今日桌数</span></div>' +
        '<div class="hstat"><b>' + pending.length + '</b><span>待审核</span></div>' +
        '<div class="hstat"><b>' + tomorrow.length + '</b><span>明日预定</span></div>' +
      '</div></div>' +
      '<div class="quick-grid">' +
        quick('新建预定', 'gold', 'plus', 'new-order') +
        quick('聊天转订单', 'blue', 'chat', 'import-order') +
        quick('时令菜', '', 'dish', 'go-dishes') +
        quick('备货单', 'gold', 'clipboard', 'go-prep') +
      '</div>' +
      (vipOrders.length ? '<div class="section"><div class="notice"><b>今天有熟客到店</b><br>' + vipOrders.slice(0, 3).map((o) => {
        const c = orderCustomer(o);
        const favs = c ? customerFavs(c).map((x) => x.name).slice(0, 2).join('、') : '';
        return esc(o.time) + ' ' + esc(orderName(o)) + '（' + esc(roomName(o.roomId)) + '）' + (c && c.tags.length ? ' · ' + esc(c.tags.join('/')) : '') + (favs ? ' · 常点：' + esc(favs) : '');
      }).join('<br>') + '</div></div>' : '') +
      (todo.length ? '<div class="section"><div class="sec-head"><div class="sec-title">' + todoLabel + ' · ' + todo.length + '</div></div><div class="list">' +
        todo.map((o) => '<button class="list-row" data-act="open-order" data-id="' + o.id + '"><div class="lr-ico gold">' + I.spark + '</div><div class="lr-main"><div class="lr-title">' + esc(orderName(o)) + ' · ' + (o.partySize || '?') + ' 位 · ' + esc(D.relativeDay(o.date)) + ' ' + esc(o.time) + '</div><div class="lr-sub">' + esc(roomName(o.roomId) || '包厢待定') + ' · 餐标 ' + (o.budget ? D.money(o.budget) + (o.budgetMode === 'person' ? '/位' : '/桌') : '未填') + '</div></div><div class="lr-val">' + I.arrow + '</div></button>').join('') +
        '</div></div>' : '') +
      (pending.length ? '<div class="section"><div class="sec-head"><div class="sec-title">待审核 · ' + pending.length + '</div><button class="sec-action" data-act="go-orders" data-filter="pending">全部</button></div>' +
        pending.slice(0, 4).map((o) => orderCard(o, true)).join('') + '</div>' : '') +
      '<div class="section"><div class="sec-head"><div class="sec-title">今日预定</div><button class="sec-action" data-act="go-orders">全部</button></div>' +
        (todayOrders.length ? todayOrders.map((o) => orderCard(o, false)).join('') : emptyState('calendar', '今天还没有预定', '客人来消息时，可直接把聊天记录粘进来。')) + '</div>' +
      (tomorrow.length ? '<div class="section"><div class="sec-head"><div class="sec-title">明日预定</div><button class="sec-action" data-act="go-calendar" data-date="' + D.addDays(t, 1) + '">日历</button></div>' +
        '<div class="list">' + tomorrow.map((o) => '<button class="list-row" data-act="open-order" data-id="' + o.id + '"><div class="lr-ico">' + I.clock + '</div><div class="lr-main"><div class="lr-title">' + esc(o.time) + ' · ' + esc(orderName(o)) + '</div><div class="lr-sub">' + esc(roomName(o.roomId) || '包厢待定') + ' · ' + (o.partySize || '?') + ' 位</div></div><div class="lr-val">' + statusBadge(o) + '</div>' + I.arrow + '</button>').join('') + '</div></div>' : '') +
      '<div style="height:12px"></div>';
  }
  function quick(title, cls, icon, act) {
    return '<button class="quick" data-act="' + act + '"><span class="q-ico ' + cls + '">' + I[icon] + '</span><span>' + title + '</span></button>';
  }
  function emptyState(icon, title, text) {
    return '<div class="empty"><div class="e-ico">' + I[icon] + '</div><b>' + esc(title) + '</b><p>' + esc(text) + '</p></div>';
  }
  function orderCard(o, showDate) {
    const room = roomName(o.roomId);
    const dietary = (o.dietary || []).filter((x) => x && x !== '无忌口');
    const pre = (o.dishes || []).filter((d) => d && d.status === 'preorder');
    const miss = missingCount(o);
    const invite = o.inviteCode;
    return '<div class="order-card st-' + o.status + '" data-act="open-order" data-id="' + o.id + '">' +
      '<div class="oc-top"><div class="oc-time">' + esc(o.time || '--:--') + '<small>' + esc(room || '包厢待定') + '</small></div>' +
      '<div class="oc-main"><div class="oc-name">' + esc(orderName(o)) + ' ' + statusBadge(o) + (invite ? chip('已发邀请', 'green') : '') + '</div>' +
      '<div class="oc-meta"><span>' + (showDate ? D.relativeDay(o.date) + ' · ' + D.fmtDateCN(o.date) : (o.occasion || '到店')) + '</span><span>' + (o.partySize || '?') + ' 位</span>' + (o.budget ? '<span>' + D.money(o.budget) + (o.budgetMode === 'person' ? '/位' : '/桌') + '</span>' : '') + '</div></div></div>' +
      '<div class="oc-notes">' + dietary.slice(0, 3).map((x) => chip(x, 'red')).join('') +
        (pre.length ? chip('需预订 ' + pre.length + ' 道', 'gold') : '') +
        (miss ? chip('缺 ' + miss + ' 项', 'gold') : '') +
        (o.special ? chip(truncate(o.special, 14), 'outline') : '') + '</div></div>';
  }

  /* ---------- 订单列表 ---------- */
  function viewOrders() {
    const tabs = [['today', '今天'], ['tomorrow', '明天'], ['week', '近七天'], ['pending', '待审核'], ['all', '全部']];
    return '<div class="view-head"><div><div class="view-title">预定订单</div><div class="view-sub">' + alive(S.orders).length + ' 张订单 · ' + alive(S.orders).filter((o) => o.status === 'pending').length + ' 张待审核</div></div></div>' +
      '<div class="searchbar">' + I.search + '<input id="orderSearch" placeholder="搜客人、电话、包厢、菜品" value="' + esc(ui.orderSearch) + '"></div>' +
      '<div class="seg">' + tabs.map((t) => '<button class="' + (ui.orderFilter === t[0] ? 'on' : '') + '" data-act="order-filter" data-filter="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>' +
      '<div id="orderList" class="mt12">' + orderListHtml() + '</div>';
  }
  function filteredOrders() {
    let list = alive(S.orders).slice();
    const t = D.todayStr();
    if (ui.orderFilter === 'today') list = list.filter((o) => o.date === t);
    else if (ui.orderFilter === 'tomorrow') list = list.filter((o) => o.date === D.addDays(t, 1));
    else if (ui.orderFilter === 'week') list = list.filter((o) => o.date >= t && o.date <= D.addDays(t, 7));
    else if (ui.orderFilter === 'pending') list = list.filter((o) => o.status === 'pending');
    if (ui.orderSearch.trim()) {
      const q = ui.orderSearch.trim().toLowerCase();
      list = list.filter((o) => [o.customerName, o.phone, o.wechat, roomName(o.roomId), o.occasion, o.special, o.code, o.date, o.notes].join(' ').toLowerCase().includes(q) ||
        (o.dishes || []).some((d) => String(d.name || d).toLowerCase().includes(q)));
    }
    return list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }
  function orderListHtml() {
    const list = filteredOrders();
    if (!list.length) return emptyState('list', '没有符合条件的订单', '换个筛选条件，或新建一张预定。');
    return list.map((o) => orderCard(o, ui.orderFilter === 'all' || ui.orderFilter === 'week' || ui.orderFilter === 'pending')).join('');
  }
  function updateOrderList() {
    const el = $('#orderList');
    if (el) el.innerHTML = orderListHtml();
  }

  /* ---------- 新建/修改预定 ---------- */
  function blankOrder(prefill) {
    const base = {
      id: '', code: '', status: 'pending', date: D.todayStr(), time: '18:00', partySize: 8,
      roomId: (enabledRooms()[0] || {}).id || '', customerId: '', customerName: '', phone: '', wechat: '',
      occasion: '', dishes: [], dietary: [], dietaryCustom: '', tasteHints: [], special: '', notes: '',
      budget: '', budgetMode: 'table', menuSource: 'manual',
      dietaryConfirmed: false, dishConfirmed: false, specialConfirmed: false,
      serviceChecks: { tableware: false, pitcher: false, water: false, drink: false },
      guests: [], inviteCode: '', inviteAt: '', changeLog: [], missing: [], audit: {}
    };
    return Object.assign(base, prefill || {});
  }
  function startNewOrder(prefill) {
    const pref = prefill || {};
    const data = blankOrder(pref);
    if (pref.customer) {
      const c = pref.customer;
      data.customerId = c.id; data.customerName = c.name; data.phone = c.phone || ''; data.wechat = c.wechat || '';
      data.dietary = (c.dietary || []).slice();
      if (c.prefRoom && !pref.roomId) data.roomId = c.prefRoom;
      if (c.budgetPref) { data.budget = c.budgetPref; data.budgetMode = c.budgetMode || 'table'; }
    }
    ui.form = { mode: 'new', id: '', original: null, data, parseSummary: '' };
    ui.stack = [];
    if (ui.view !== 'orders' && ui.view !== 'home' && ui.view !== 'calendar' && ui.view !== 'customers') ui.stack = [{ view: 'home', params: {} }];
    go('orderForm');
  }
  function editOrder(id) {
    const o = alive(S.orders).find((x) => x.id === id);
    if (!o) return;
    const data = JSON.parse(JSON.stringify(o));
    data.dietaryCustom = '';
    data.dietaryConfirmed = !!(o.missing || []).every((m) => !/忌口/.test(m)) && (o.dietary || []).length >= 0;
    data.dishConfirmed = !!(o.missing || []).every((m) => !/菜/.test(m));
    data.specialConfirmed = !!(o.missing || []).every((m) => !/特殊/.test(m));
    ui.form = { mode: 'edit', id: o.id, original: JSON.parse(JSON.stringify(o)), data, parseSummary: '' };
    go('orderForm');
  }
  function viewOrderForm() {
    const f = ui.form;
    if (!f) { return emptyState('edit', '表单已关闭', '返回订单列表重新打开。'); }
    const d = f.data;
    const edit = f.mode === 'edit';
    const rooms = enabledRooms();
    const cust = D.findCustomer(S, { phone: d.phone, name: d.customerName, wechat: d.wechat });
    return '<div class="view-head"><div><div class="view-title">' + (edit ? '修改预定' : '新建预定') + '</div><div class="view-sub">' + (edit ? '改单后需重新审核，后厨和服务员会收到新版本' : '先录准确的，缺的项系统会提醒') + '</div></div></div>' +
      (!edit ? '<div class="form-card import-box"><h3>微信聊天一键识别</h3>' +
        '<textarea id="chatInput" placeholder="把客人的微信聊天记录粘进来，例如：\n明天晚上6点半，10人，2000餐标，王总，13805920001，VIP2，海鲜过敏，过生日"></textarea>' +
        '<div class="btn-row mt8"><button class="btn primary" data-act="parse-chat">识别并填入</button><button class="btn soft" data-act="paste-json">粘贴 AI 订单 JSON</button></div>' +
        '<div class="hint">只识别不提交；日期、人数、餐标、包厢、忌口、场景、菜名都会自动抓出来。也可以把聊天记录发给 AI 助理，拿到 JSON 后粘进来。</div>' +
        (f.parseSummary ? '<div class="parse-result">' + f.parseSummary + '</div>' : '') + '</div>' : '') +
      '<div id="custMatch">' + customerBanner(cust, d) + '</div>' +
      '<div class="form-card"><h3>时间与包厢</h3>' +
        '<div class="field-row"><div class="field"><label>日期 <b>*</b></label><input type="date" data-ff="date" value="' + esc(d.date) + '"></div>' +
        '<div class="field"><label>到店时间 <b>*</b></label><input type="time" data-ff="time" value="' + esc(d.time) + '"></div></div>' +
        '<div class="field-row"><div class="field"><label>人数 <b>*</b></label><input type="number" inputmode="numeric" min="1" max="60" data-ff="partySize" value="' + esc(d.partySize) + '"></div>' +
        '<div class="field"><label>包厢 <b>*</b></label><select data-ff="roomId"><option value="">请选择</option>' + rooms.map((r) => '<option value="' + r.id + '" ' + (d.roomId === r.id ? 'selected' : '') + '>' + esc(r.name) + '（' + r.seats + '座）</option>').join('') + '</select></div></div>' +
        '<div class="field"><label>餐标（选填，用于自动配菜）</label><div class="field-row">' +
          '<input type="number" inputmode="numeric" min="0" step="50" data-ff="budget" value="' + esc(d.budget || '') + '" placeholder="如 2000">' +
          '<div class="seg" style="align-self:center"><button class="' + (d.budgetMode !== 'person' ? 'on' : '') + '" data-act="budget-mode" data-mode="table" type="button">每桌</button><button class="' + (d.budgetMode === 'person' ? 'on' : '') + '" data-act="budget-mode" data-mode="person" type="button">每位</button></div></div>' +
          '<button class="btn gold sm mt8" data-act="gen-menu" type="button">' + I.spark + ' 按人数 + 餐标自动出菜单</button></div>' +
        '<div class="field"><label>场景</label><div class="pick-grid">' + ['生日', '寿宴', '纪念日', '商务宴请', '家宴', '朋友聚会', '公司聚餐', '其他'].map((x) => '<button class="pick ' + (d.occasion === x ? 'on' : '') + '" data-act="pick-occasion" data-value="' + x + '" type="button">' + x + '</button>').join('') + '</div></div>' +
      '</div>' +
      '<div class="form-card"><h3>客人信息</h3><div class="field-row"><div class="field"><label>称呼 <b>*</b></label><input type="text" data-ff="customerName" value="' + esc(d.customerName) + '" placeholder="如 王总 / 林女士"></div>' +
        '<div class="field"><label>电话</label><input type="tel" inputmode="tel" data-ff="phone" value="' + esc(d.phone) + '" placeholder="手机号"></div></div>' +
        '<div class="field"><label>微信</label><input type="text" data-ff="wechat" value="' + esc(d.wechat) + '" placeholder="微信号（选填）"></div></div>' +
      '<div class="form-card"><h3>菜单</h3>' +
        '<div class="between mb8"><div class="small muted">已选 <b id="dishCount">' + (d.dishes || []).length + '</b> 道 · 合计 <b id="menuTotal">' + (D.orderTotal(d) ? D.money(D.orderTotal(d)) : '—') + '</b></div>' +
        '<button class="btn gold sm" data-act="gen-menu" type="button">' + I.spark + ' 按餐标配菜</button></div>' +
        '<div id="dishPicker">' + dishPickerHtml(d) + '</div>' +
        '<div id="dishWarn">' + dishWarnHtml(d) + '</div>' +
        '<div class="hint">私房菜以提前预定为主，建议至少提前 1 天；灰色划线的已下市，「来不及」的是预订单但日期太近。配菜会保留客户指定的菜，再用剩余餐标补齐。</div></div>' +
      '<div class="form-card"><h3>忌口与特殊安排</h3>' +
        '<div class="field"><label>忌口</label><div class="pick-grid" id="dietPicks">' + D.DIET_OPTIONS.map((x) => '<button class="pick ' + ((d.dietary || []).includes(x) ? 'on red' : '') + '" data-act="toggle-diet" data-value="' + x + '" type="button">' + x + '</button>').join('') + '</div>' +
        '<input class="mt8" type="text" data-ff="dietaryCustom" value="' + esc(d.dietaryCustom || '') + '" placeholder="补充忌口，如：不吃葱蒜、儿童" style="width:100%;min-height:42px;border:1px solid var(--line-2);border-radius:10px;background:#fdfbf6;padding:9px 11px;font-size:15px"></div>' +
        '<div class="field"><label>客户口味偏好（会记进档案，下次配菜自动带上）</label><div class="pick-grid">' + D.TASTE_OPTIONS.map((x) => '<button class="pick ' + ((d.tasteHints || []).includes(x) ? 'on gold' : '') + '" data-act="toggle-taste" data-value="' + x + '" type="button">' + x + '</button>').join('') + '</div></div>' +
        '<div class="field"><label>特殊安排</label><textarea data-ff="special" placeholder="如：生日蛋糕、包厢布置、鲜花、儿童座椅">' + esc(d.special) + '</textarea><div class="pick-grid mt8">' + D.SPECIAL_OPTIONS.map((x) => '<button class="pick" data-act="toggle-special" data-value="' + x + '" type="button">+ ' + x + '</button>').join('') + '</div></div>' +
        '<div class="field"><label>备注</label><textarea data-ff="notes" placeholder="其他要交代的，如：客人会晚到、需要代驾">' + esc(d.notes) + '</textarea></div></div>' +
      '<div id="missingPanel">' + missingPanelHtml(d) + '</div>' +
      '<div class="btn-row mt16"><button class="btn ghost" data-act="cancel-form">取消</button><button class="btn primary grow" data-act="save-order">' + (edit ? '保存修改' : '保存为待审核') + '</button></div>' +
      '<div style="height:12px"></div>';
  }
  function customerBanner(c, d) {
    if (!c) return '';
    const favs = customerFavs(c);
    const stats = customerStats(c);
    return '<div class="profile-banner"><div class="pb-name">' + esc(custLabel(c)) + (c.aliases || []).map((a) => chip(a, 'outline')).join('') + (c.tags || []).map((t) => chip(t, 'gold')).join('') + '</div>' +
      '<div class="pb-meta">' + (c.dietary && c.dietary.length ? '忌口：' + esc(c.dietary.join('、')) + '　' : '') +
        (c.tasteTags && c.tasteTags.length ? '口味：' + esc(c.tasteTags.slice(0, 5).join('、')) + '　' : '') +
        (favs.length ? '常点：' + esc(favs.map((x) => x.name + (x.count > 1 ? '×' + x.count : '')).join('、')) : '') +
        (c.budgetPref ? '<br>常餐标：' + D.money(c.budgetPref) + (c.budgetMode === 'person' ? '/位' : '/桌') : '') +
        (stats.lastVisit ? '　上次到店：' + D.relativeDay(stats.lastVisit) : '') + '</div>' +
      (c.notes ? '<div class="pb-notes">' + esc(c.notes) + '</div>' : '') +
      '<div class="btn-row mt8"><button class="btn sm soft" data-act="apply-customer" data-mode="diet" type="button">带入忌口</button>' +
      (favs.length ? '<button class="btn sm soft" data-act="apply-customer" data-mode="fav" type="button">带入常点菜</button>' : '') +
      (c.budgetPref ? '<button class="btn sm gold" data-act="customer-menu" type="button">按记忆餐标配菜</button>' : '<button class="btn sm gold" data-act="apply-customer" data-mode="budget" type="button">用记住的餐标</button>') +
      '</div></div>';
  }
  function dishPickerHtml(d) {
    const selected = new Set((d.dishes || []).map((x) => (typeof x === 'string' ? x : x.name)));
    const lead = d.date ? D.dayDiff(D.todayStr(), d.date) : 0;
    return D.CATEGORIES.map((cat) => {
      const list = alive(S.dishes).filter((x) => x.category === cat).sort((a, b) => (a.status === 'off' ? 1 : 0) - (b.status === 'off' ? 1 : 0) || a.price - b.price);
      if (!list.length) return '';
      return '<div class="dish-group"><h4>' + cat + '</h4><div class="pick-grid">' + list.map((x) => {
        const on = selected.has(x.name);
        const off = x.status === 'off';
        const tooLate = x.status === 'preorder' && Number(x.leadDays || 0) > Math.max(0, lead);
        const disabled = off || (tooLate && !on);
        const st = off ? ' · 下市' : (x.status === 'preorder' ? (tooLate ? ' · 来不及备料' : ' · 需提前' + x.leadDays + '天') : '');
        return '<button type="button" class="pick dish-opt ' + (on ? 'on' : '') + '" data-act="toggle-dish" data-id="' + x.id + '" ' + (disabled ? 'disabled' : '') + '>' +
          '<span>' + esc(x.name) + '</span><span class="st">' + D.money(x.price) + st + '</span></button>';
      }).join('') + '</div></div>';
    }).join('');
  }
  function dishWarnHtml(d) {
    const sel = (d.dishes || []).map((x) => (typeof x === 'string' ? D.dishByName(S, x) : (D.dishByName(S, x.name) || x))).filter(Boolean);
    if (!sel.length) return '';
    const diet = [].concat(d.dietary || [], d.dietaryCustom ? splitList(d.dietaryCustom) : []);
    const conflicts = sel.filter((x) => D.dietExcludes(x, diet));
    const offs = sel.filter((x) => x.status === 'off');
    const lead = d.date ? D.dayDiff(D.todayStr(), d.date) : 0;
    const late = sel.filter((x) => x.status === 'preorder' && Number(x.leadDays || 0) > Math.max(0, lead));
    let h = '';
    if (conflicts.length) h += '<div class="alert-line">' + I.alert + '<div><b>与忌口冲突：</b>' + esc(conflicts.map((x) => x.name).join('、')) + '。请和客人再确认。</div></div>';
    if (offs.length) h += '<div class="alert-line">' + I.alert + '<div><b>已下市：</b>' + esc(offs.map((x) => x.name).join('、')) + '。请和厨房确认是否还能安排。</div></div>';
    if (late.length) h += '<div class="alert-line gold">' + I.clock + '<div><b>来不及备料：</b>' + esc(late.map((x) => x.name).join('、')) + '。预定日期太近，需和厨房确认。</div></div>';
    return h;
  }
  function missingPanelHtml(d) {
    const req = [];
    if (!d.date) req.push('日期');
    if (!d.time) req.push('时间');
    if (!d.partySize) req.push('人数');
    if (!d.customerName) req.push('客人称呼');
    if (!d.roomId) req.push('包厢');
    const soft = [];
    if (!d.dietaryConfirmed) soft.push('忌口');
    if (!d.dishConfirmed) soft.push('时令/预约菜');
    if (!d.specialConfirmed) soft.push('特殊安排');
    if (!req.length && !soft.length) return '<div class="missing-box ok"><b>信息齐全</b>，可以直接保存为待审核。</div>';
    return '<div class="missing-box"><b>' + (req.length ? '还差 ' + req.length + ' 项必填：' + req.join('、') : '必填项已齐') + '</b>' +
      (soft.length ? '<div class="mt8">建议跟客人确认：' + soft.join('、') + '</div><div class="confirm-checks">' +
        (!d.dietaryConfirmed ? '<button class="btn xs soft" data-act="confirm-field" data-key="dietaryConfirmed" type="button">已确认无忌口</button>' : '') +
        (!d.dishConfirmed ? '<button class="btn xs soft" data-act="confirm-field" data-key="dishConfirmed" type="button">无需预约菜</button>' : '') +
        (!d.specialConfirmed ? '<button class="btn xs soft" data-act="confirm-field" data-key="specialConfirmed" type="button">无特殊安排</button>' : '') +
        '</div>' : '') + '</div>';
  }
  function refreshFormSummary() {
    const f = ui.form; if (!f) return;
    const d = f.data;
    const dp = $('#dishCount'); if (dp) dp.textContent = (d.dishes || []).length;
    const mt = $('#menuTotal'); if (mt) mt.textContent = D.orderTotal(d) ? D.money(D.orderTotal(d)) : '—';
    const mp = $('#missingPanel'); if (mp) mp.innerHTML = missingPanelHtml(d);
    const dw = $('#dishWarn'); if (dw) dw.innerHTML = dishWarnHtml(d);
    const cm = $('#custMatch');
    if (cm) { const c = D.findCustomer(S, { phone: d.phone, name: d.customerName, wechat: d.wechat }); cm.innerHTML = customerBanner(c, d); }
  }
  function parseChatIntoForm(text) {
    const f = ui.form; if (!f) return;
    const d = f.data;
    const p = D.parseChat(text, S);
    const filled = [];
    const labels = { date: '日期', time: '时间', customerName: '称呼', phone: '电话', wechat: '微信', occasion: '场景', special: '特殊安排', notes: '备注' };
    ['date', 'time', 'customerName', 'phone', 'wechat', 'occasion', 'special', 'notes'].forEach((k) => {
      if (p[k]) { d[k] = p[k]; filled.push(labels[k] || k); }
    });
    if (p.partySize) { d.partySize = p.partySize; filled.push('人数'); }
    if (p.roomId) { d.roomId = p.roomId; filled.push('包厢'); }
    if (p.budget) { d.budget = p.budget; d.budgetMode = p.budgetMode; filled.push('餐标'); }
    if (p.dietary && p.dietary.length) {
      d.dietary = Array.from(new Set([].concat(d.dietary || [], p.dietary)));
      d.dietaryConfirmed = true;
      filled.push('忌口');
    }
    if (p.taste && p.taste.length) {
      d.tasteHints = Array.from(new Set([].concat(d.tasteHints || [], p.taste)));
      filled.push('口味偏好');
    }
    if (p.dishes && p.dishes.length) {
      const objs = D.dishObjs(S, p.dishes);
      const names = new Set((d.dishes || []).map((x) => (typeof x === 'string' ? x : x.name)));
      objs.forEach((x) => { if (!names.has(x.name)) d.dishes.push(x); });
      d.dishConfirmed = true;
      filled.push('菜品');
    }
    const missing = [];
    if (!d.date) missing.push('日期');
    if (!d.time) missing.push('时间');
    if (!d.partySize) missing.push('人数');
    if (!d.customerName) missing.push('称呼');
    if (!d.roomId) missing.push('包厢');
    f.parseSummary = '<b>已识别：</b>' + (filled.length ? filled.join('、') : '暂无可识别内容') +
      (missing.length ? '<br><span class="warn">还需要补：' + missing.join('、') + '</span>' : '<br>要素已齐，核对后保存即可');
    render({ scroll: false });
    toast(filled.length ? '已识别，请核对' : '没识别到信息，手动补一下');
  }
  function parseJsonIntoForm(text) {
    try {
      const start = text.indexOf('{'); const end = text.lastIndexOf('}');
      if (start < 0 || end < 0) throw new Error('没有找到 JSON');
      const obj = JSON.parse(text.slice(start, end + 1));
      const f = ui.form; const d = f.data;
      if (obj.date) d.date = obj.date;
      if (obj.time) d.time = obj.time;
      if (obj.partySize || obj.party_size) d.partySize = obj.partySize || obj.party_size;
      if (obj.customerName || obj.name) d.customerName = obj.customerName || obj.name;
      if (obj.phone) d.phone = obj.phone;
      if (obj.wechat) d.wechat = obj.wechat;
      if (obj.occasion) d.occasion = obj.occasion;
      if (obj.special) d.special = obj.special;
      if (obj.notes) d.notes = obj.notes;
      if (obj.budget) { d.budget = obj.budget; d.budgetMode = obj.budgetMode || obj.budget_mode || 'table'; }
      if (obj.dietary) d.dietary = Array.isArray(obj.dietary) ? obj.dietary : String(obj.dietary).split(/[，,、]/).filter(Boolean);
      if (obj.taste || obj.tasteHints) d.tasteHints = Array.isArray(obj.taste || obj.tasteHints) ? (obj.taste || obj.tasteHints) : splitList(obj.taste || obj.tasteHints);
      if (obj.roomName || obj.roomId) {
        const rid = obj.roomId || ((enabledRooms().find((r) => r.name === obj.roomName) || {}).id);
        if (rid) d.roomId = rid;
      }
      if (Array.isArray(obj.dishes)) {
        const names = obj.dishes.map((x) => (typeof x === 'string' ? x : x.name)).filter(Boolean);
        const objs = D.dishObjs(S, names);
        const existing = new Set((d.dishes || []).map((x) => (typeof x === 'string' ? x : x.name)));
        objs.forEach((x) => { if (!existing.has(x.name)) d.dishes.push(x); });
        d.dishConfirmed = true;
      }
      f.parseSummary = '<b>AI 订单已填入</b>，请核对后保存。';
      render({ scroll: false });
      toast('已填入 AI 订单');
    } catch (e) {
      toast('JSON 解析失败：' + e.message);
    }
  }
  function readFormFields() {
    const f = ui.form; if (!f) return;
    document.querySelectorAll('[data-ff]').forEach((el) => {
      const key = el.dataset.ff;
      let v = el.value;
      if (el.type === 'number') v = v === '' ? '' : Number(v);
      f.data[key] = v;
    });
    const custom = f.data.dietaryCustom;
    if (custom && String(custom).trim()) {
      const extra = String(custom).split(/[，,、\s]+/).filter(Boolean);
      f.data.dietary = Array.from(new Set([].concat((f.data.dietary || []).filter((x) => x !== '无忌口'), extra)));
    }
  }
  function saveOrderForm() {
    const f = ui.form; if (!f) return;
    readFormFields();
    const d = f.data;
    const missingReq = [];
    if (!d.date) missingReq.push('日期');
    if (!d.time) missingReq.push('时间');
    if (!d.partySize) missingReq.push('人数');
    if (!d.customerName) missingReq.push('客人称呼');
    if (!d.roomId) missingReq.push('包厢');
    if (missingReq.length) { toast('请先补：' + missingReq.join('、')); refreshFormSummary(); return; }
    if (Number(d.partySize) < 1 || Number(d.partySize) > 60) { toast('人数填 1–60 之间'); return; }
    const softMissing = [];
    if (!d.dietaryConfirmed) softMissing.push('忌口确认');
    if (!d.dishConfirmed) softMissing.push('时令菜确认');
    if (!d.specialConfirmed) softMissing.push('特殊安排确认');

    // 熟客：先按手机号/微信精确匹配；同名不同手机尾号视为两个人
    let cust = D.findCustomer(S, { phone: d.phone, name: d.customerName, wechat: d.wechat });
    let dupName = false;
    if (!cust) {
      dupName = alive(S.customers).some((x) => x.name === String(d.customerName || '').trim());
      cust = { id: D.uid('c_'), name: d.customerName, aliases: [], wechat: d.wechat || '', phone: d.phone || '', tags: [], dietary: d.dietary || [], tasteTags: [], tasteScores: {}, dishCounts: {}, prefRoom: d.roomId, notes: '', visitCount: 0, lastVisit: '', budgetPref: d.budget || null, budgetMode: d.budgetMode || 'table', updatedAt: D.nowISO(), deleted: false, _dirty: true };
      S.customers.push(cust);
      S.meta.rev++;
    }
    // 忌口沉淀：每次预定都把新忌口并进档案，下次配菜自动避开
    const dietList = (d.dietary || []).filter((x) => x && x !== '无忌口');
    if (dietList.length) {
      const merged = Array.from(new Set([].concat(cust.dietary || [], dietList)));
      if (merged.length !== (cust.dietary || []).length) { cust.dietary = merged; cust.dietaryUpdatedAt = D.nowISO(); cust._dirty = true; }
    }
    const dupNote = dupName && D.phoneTail(d.phone) ? ' · 同名已按尾' + D.phoneTail(d.phone) + '区分' : '';
    const existingEdit = f.mode === 'edit' ? alive(S.orders).find((x) => x.id === f.id) : null;
    const orig = f.original;
    let status = 'pending';
    let changePending = false;
    let changeText = '';
    if (existingEdit) {
      status = existingEdit.status;
      if (['confirmed', 'notified', 'pending'].includes(status)) {
        const diffs = [];
        if (orig.date !== d.date) diffs.push('日期 ' + orig.date + '→' + d.date);
        if (orig.time !== d.time) diffs.push('时间 ' + orig.time + '→' + d.time);
        if (Number(orig.partySize) !== Number(d.partySize)) diffs.push('人数 ' + orig.partySize + '→' + d.partySize);
        if (orig.roomId !== d.roomId) diffs.push('包厢 ' + roomName(orig.roomId) + '→' + roomName(d.roomId));
        if (JSON.stringify(orig.dishes) !== JSON.stringify(d.dishes)) diffs.push('菜单已调整');
        if (JSON.stringify(orig.dietary) !== JSON.stringify(d.dietary)) diffs.push('忌口已更新');
        if (orig.special !== d.special) diffs.push('特殊安排已更新');
        changeText = diffs.join('；');
        if (status !== 'pending') { status = 'pending'; changePending = true; }
      }
    }
    const order = existingEdit ? existingEdit : {
      id: D.uid('o_'), code: '', status: 'pending', createdAt: D.nowISO(), createdBy: roleName(),
      guests: [], inviteCode: '', inviteAt: '', changeLog: [],
      audit: { createdAt: D.nowISO(), createdBy: roleName(), updatedAt: D.nowISO(), updatedBy: roleName() }
    };
    order.serviceChecks = Object.assign({ tableware: false, pitcher: false, water: false, drink: false }, order.serviceChecks || {});
    Object.assign(order, {
      date: d.date, time: d.time, partySize: Number(d.partySize), roomId: d.roomId,
      customerId: cust.id, customerName: d.customerName, phone: d.phone, wechat: d.wechat,
      occasion: d.occasion, dishes: d.dishes || [], dietary: d.dietary || [],
      tasteHints: d.tasteHints || [],
      special: d.special, notes: d.notes, budget: d.budget ? Number(d.budget) : null,
      budgetMode: d.budgetMode || 'table', menuSource: d.menuSource || 'manual',
      missing: softMissing, changePending, deleted: false
    });
    if ((d.tasteHints || []).length) {
      cust.tasteScores = cust.tasteScores || {};
      (d.tasteHints || []).forEach((t) => { cust.tasteScores[t] = (cust.tasteScores[t] || 0) + 1; });
      cust.tasteTags = Object.keys(cust.tasteScores).sort((a, b) => cust.tasteScores[b] - cust.tasteScores[a]).slice(0, 6);
      cust.updatedAt = D.nowISO(); cust._dirty = true;
    }
    order.audit = order.audit || {};
    order.audit.updatedAt = D.nowISO(); order.audit.updatedBy = roleName();
    if (status !== order.status) order.status = status;
    if (!order.code) order.code = nextOrderCode(order.date);
    order.changeLog = order.changeLog || [];
    if (changeText) order.changeLog.push({ at: D.nowISO(), by: roleName(), text: '改单：' + changeText + '（待复核）' });
    else if (!existingEdit) order.changeLog.push({ at: D.nowISO(), by: roleName(), text: '创建预定' + (d.menuSource === 'ai' || d.menuSource === 'auto' ? '（AI 按餐标配菜）' : '') });
    else order.changeLog.push({ at: D.nowISO(), by: roleName(), text: '修改订单信息' });
    if (!existingEdit && !order.flow) order.flow = { stage: 'new', at: D.nowISO(), by: roleName(), history: [{ at: D.nowISO(), by: roleName(), stage: 'new', note: '接单' }] };
    touch(order);
    if (!existingEdit) S.orders.push(order);
    S.meta.rev++;
    saveState({ snap: true });
    toast((existingEdit ? (changePending ? '已保存，等待店长复核改单' : '已保存') : '已存为待审核') + dupNote);
    ui.form = null;
    ui.stack = [{ view: 'orders', params: {} }];
    ui.view = 'orderDetail'; ui.params = { orderId: order.id };
    render();
  }
  function nextOrderCode(date) {
    const prefix = 'CJX-' + String(date || '').replace(/-/g, '');
    const same = alive(S.orders).filter((o) => o.code && o.code.indexOf(prefix) === 0);
    return prefix + '-' + String(same.length + 1).padStart(2, '0');
  }

  /* ---------- 餐标配菜 / AI 自动菜单 ---------- */
  function menuTargetSource() {
    if (ui.menuTarget === 'order') {
      const o = alive(S.orders).find((x) => x.id === ui.menuOrderId);
      if (!o) return null;
      return {
        mode: 'order', order: o, time: o.time,
        partySize: Number(o.partySize) || 0, budget: o.budget, budgetMode: o.budgetMode || 'table',
        date: o.date, dietary: (o.dietary || []).filter((x) => x && x !== '无忌口'),
        tasteHints: o.tasteHints || [], dishes: o.dishes || [],
        roomId: o.roomId, customer: orderCustomer(o)
      };
    }
    const f = ui.form; if (!f) return null;
    readFormFields();
    const d = f.data;
    return {
      mode: 'form', order: null, time: d.time || '18:00',
      partySize: Number(d.partySize) || 0, budget: d.budget, budgetMode: d.budgetMode || 'table',
      date: d.date || D.todayStr(), dietary: d.dietary || [], tasteHints: d.tasteHints || [],
      dishes: d.dishes || [], roomId: d.roomId,
      customer: D.findCustomer(S, { phone: d.phone, name: d.customerName, wechat: d.wechat })
    };
  }
  function openMenuPlanner(target) {
    if (!can('aiMenu')) { toast('AI 配菜由老板 / 店长操作'); return; }
    if (target === 'order') { ui.menuTarget = 'order'; ui.menuOrderId = ui.params.orderId; }
    else { ui.menuTarget = 'form'; }
    const src = menuTargetSource(); if (!src) return;
    if (!src.partySize) { toast('先填人数，才能按餐标配菜'); return; }
    if (!src.budget) { toast('先填餐标，比如 2000 元/桌'); return; }
    const keptDishes = (src.dishes || []).slice();
    const menus = D.generateMenus(S, {
      partySize: src.partySize, budget: Number(src.budget), budgetMode: src.budgetMode,
      date: src.date, dietary: src.dietary, customer: src.customer,
      tasteTags: src.tasteHints, keepDishes: keptDishes
    });
    if (!menus.length) { toast('没有可选菜品，检查菜单和忌口'); return; }
    const totalBudget = D.budgetTotalOf(src.budget, src.budgetMode, src.partySize);
    const cust = src.customer;
    const tasteLine = [].concat((cust && cust.tasteTags) || [], src.tasteHints || []).filter((v, i, a) => a.indexOf(v) === i).slice(0, 6);
    const dietAll = src.dietary || [];
    const keptConflicts = keptDishes.map((k) => D.dishByName(S, k.name || k) || k).filter((x) => D.dietExcludes(x, dietAll));
    const curRoom = roomOptions(src.date, src.time, src.partySize, src.order ? src.order.id : null).find((x) => x.room.id === src.roomId);
    const sug = suggestRoom(src.date, src.time, src.partySize, src.order ? src.order.id : null);
    const roomOk = curRoom && curRoom.fit === 'ok' && !curRoom.conflict;
    const roomLine = roomOk
      ? '<div class="alert-line green">' + I.room + '<div><b>包厢：' + esc(roomName(src.roomId)) + '（' + roomCapText(curRoom.room) + '）</b> · ' + src.partySize + ' 人正好，无需调整</div></div>'
      : (sug && sug.room
        ? '<div class="alert-line gold">' + I.room + '<div><b>建议包厢：' + esc(sug.room.name) + '（' + roomCapText(sug.room) + '）</b> · ' + esc(sug.reason) + (curRoom && curRoom.conflict ? ' · 当前 ' + esc(roomName(src.roomId)) + ' 该时段已有 ' + esc(curRoom.conflict) : '') + '<br>采用菜单时会自动安排。 </div></div>'
        : '<div class="alert-line">' + I.alert + '<div><b>包厢排不下：</b>' + esc(sug ? sug.reason : '当天没有空闲包厢') + '</div></div>');
    const html = '<h3>AI 配菜 · ' + src.partySize + ' 人</h3><p class="sheet-sub">' + (src.order ? esc(orderName(src.order)) + ' · ' : '') + D.money(src.budget) + (src.budgetMode === 'person' ? '/位' : '/桌') + '（合计 ' + D.money(totalBudget) + '）' +
      (keptDishes.length ? ' · 保留指定 ' + keptDishes.length + ' 道' : '') +
      (cust ? ' · 参考 ' + esc(custLabel(cust)) + (tasteLine.length ? '（' + esc(tasteLine.join('、')) + '）' : '') + ' 的口味和常点' : (tasteLine.length ? ' · 已参考口味：' + esc(tasteLine.join('、')) : '')) + '</p>' +
      roomLine +
      (keptConflicts.length ? '<div class="alert-line" style="margin-bottom:12px">' + I.alert + '<div><b>指定菜与忌口冲突：</b>' + esc(keptConflicts.map((x) => x.name).join('、')) + '。系统已保留，请和客人确认。</div></div>' : '') +
      menus.map((m) => '<div class="card pad mb12"><div class="between"><div class="sec-title">' + esc(m.title) + '</div><span class="status ' + (m.within ? 'notified' : 'warn') + '">' + D.money(m.total) + '</span></div>' +
        '<div class="small muted">' + esc(m.desc) + ' · 人均 ' + D.money(Math.round(m.perPerson)) + ' · ' + m.items.length + ' 道' + (m.preorder ? ' · 含 ' + m.preorder + ' 道预订单' : '') + ' · ' + (m.remaining >= 0 ? '余 ' + D.money(m.remaining) : '超 ' + D.money(-m.remaining)) + '</div>' +
        '<div class="chips mt8">' + m.items.map((x) => '<span class="chip ' + (x.status === 'preorder' ? 'gold' : '') + '">' + esc(x.name) + ' ' + D.money(x.price) + '</span>').join('') + '</div>' +
        (m.total < totalBudget * 0.7 ? '<div class="hint">当前菜价偏低，预算可再升级硬菜或加酒水。</div>' : '') +
        '<button class="btn primary sm mt8" data-act="adopt-menu" data-key="' + m.key + '">采用这套菜单' + (sug && sug.room && !roomOk ? ' + 安排 ' + esc(sug.room.name) : '') + '</button></div>').join('') +
      '<div class="btn-row"><button class="btn ghost" data-act="close-sheet">再看看</button><button class="btn soft" data-act="gen-menu">重新生成</button></div>';
    ui.menuCache = menus;
    openSheet(html);
  }
  function adoptMenu(key) {
    const menus = ui.menuCache || [];
    const m = menus.find((x) => x.key === key);
    if (!m) return;
    const src = menuTargetSource();
    if (!src) return;
    const items = m.items.map((x) => ({ id: x.id, name: x.name, price: x.price, category: x.category, status: x.status, leadDays: x.leadDays, flavor: x.flavor || [] }));
    const curRoom = roomOptions(src.date, src.time, src.partySize, src.order ? src.order.id : null).find((x) => x.room.id === src.roomId);
    const needRoom = !curRoom || curRoom.fit !== 'ok' || !!curRoom.conflict;
    const sug = needRoom ? suggestRoom(src.date, src.time, src.partySize, src.order ? src.order.id : null) : null;
    let roomNote = '';
    let roomId = src.roomId;
    if (needRoom && sug && sug.room) { roomId = sug.room.id; roomNote = '，已自动安排 ' + sug.room.name + '（' + roomCapText(sug.room) + '）'; }
    if (src.mode === 'order') {
      const o = src.order;
      o.dishes = items;
      o.menuSource = 'ai';
      o.dishConfirmed = true;
      if (roomId) o.roomId = roomId;
      setFlow(o, 'menu', 'AI 出 ' + items.length + ' 道菜 · ' + D.money(m.total));
      S.meta.rev++;
      saveState({ snap: true });
      closeSheet(); render({ scroll: false });
      toast('菜单已生成' + roomNote);
    } else {
      const d = ui.form.data;
      d.dishes = items;
      d.menuSource = 'ai';
      d.dishConfirmed = true;
      if (roomId) d.roomId = roomId;
      closeSheet(); render({ scroll: false });
      toast('已采用，' + D.money(m.total) + (roomNote ? roomNote : ' / ' + (m.within ? '在餐标内' : '略超餐标')));
    }
  }

  /* ---------- 订单详情 ---------- */
  function selectedOrder() {
    if (!ui.params.orderId) return null;
    return alive(S.orders).find((o) => o.id === ui.params.orderId) || null;
  }
  function flowBar(o) {
    const stage = orderFlow(o);
    const idx = FLOW_STEPS.findIndex((s) => s.key === stage);
    const cur = FLOW_STEPS[idx] || FLOW_STEPS[0];
    return '<div class="flow-bar">' + FLOW_STEPS.map((s, i) => '<div class="flow-step ' + (i < idx ? 'done' : (i === idx ? 'on' : '')) + '"><span class="fs-dot">' + (i < idx ? '✓' : (i + 1)) + '</span><span class="fs-label">' + s.label + '</span></div>' + (i < FLOW_STEPS.length - 1 ? '<span class="flow-line ' + (i < idx ? 'done' : '') + '"></span>' : '')).join('') +
      '</div><div class="flow-hint">' + esc(cur.desc) + (o.flow && o.flow.at ? ' · ' + esc(String(o.flow.at).replace('T', ' ').slice(5, 16)) + ' ' + esc(o.flow.by || '') : '') + '</div>';
  }
  function viewOrderDetail() {
    const o = selectedOrder();
    if (!o) return emptyState('list', '订单不存在', '可能已被删除，返回列表看看。');
    const room = roomName(o.roomId);
    const roomObj = enabledRooms().find((r) => r.id === o.roomId);
    const roomOpt = roomOptions(o.date, o.time, o.partySize, o.id).find((x) => x.room.id === o.roomId);
    const roomProblem = roomOpt && (roomOpt.conflict ? '该时段已有 ' + roomOpt.conflict : (roomOpt.fit === 'small' ? '坐不下 ' + (o.partySize || 0) + ' 人' : (roomOpt.fit === 'big' ? '偏大，' + (o.partySize || 0) + ' 人坐 ' + roomCapText(roomObj) : ''))) || '';
    const cust = orderCustomer(o);
    const total = D.orderTotal(o);
    const canManage = can('orderManage');
    const isBoss = session.role === 'boss';
    const guests = o.guests || [];
    const attend = guests.filter((g) => g.attend !== false);
    const guestDiet = Array.from(new Set(guests.flatMap((g) => g.dietary || [])));
    const stage = orderFlow(o);
    const actions = [];
    if (canManage) {
      if (stage === 'new') actions.push('<button class="btn primary" data-act="flow-manager">' + I.share + ' 转给店长配菜</button>');
      if (stage === 'manager') actions.push('<button class="btn gold block" data-act="ai-menu">' + I.spark + ' AI 自动配菜 + 排包厢</button>');
      if (stage === 'menu') actions.push('<button class="btn primary" data-act="flow-boss">' + I.share + ' 发给老板确认</button><button class="btn soft" data-act="ai-menu">重新配菜</button>');
      if (stage === 'boss') actions.push('<button class="btn primary" data-act="flow-customer">' + I.share + ' 转发给客户确认</button>');
      if (stage === 'customer') actions.push('<button class="btn primary" data-act="flow-confirm">' + I.check + ' 客户已确认菜品</button><button class="btn soft" data-act="flow-customer">再发一次</button>');
      if (stage === 'confirmed' && o.status !== 'cancelled') actions.push('<button class="btn gold block" data-act="open-invite">' + I.share + ' 生成/发送邀请函</button>');
      else if (o.status !== 'cancelled') actions.push('<button class="btn soft" data-act="open-invite">' + I.share + ' 邀请函（客户未确认菜单）</button>');
      if (o.status === 'pending') actions.push('<button class="btn primary" data-act="confirm-order">审核通过并通知</button>');
      if (o.status === 'confirmed') actions.push('<button class="btn primary" data-act="notify-order">通知后厨 / 服务员</button>');
      if (o.status === 'notified') actions.push('<button class="btn primary" data-act="complete-order">标记已完成</button>');
      if (['pending', 'confirmed', 'notified'].includes(o.status)) {
        actions.push('<button class="btn soft" data-act="edit-order">修改</button>');
        actions.push('<button class="btn danger" data-act="cancel-order">取消</button>');
      }
    }
    if (o.status === 'done') actions.push('<button class="btn soft" data-act="duplicate-order">再来一单</button>');
    actions.push('<button class="btn soft" data-act="copy-order">复制订单</button>');
    if (isBoss && !o.deleted) actions.push('<button class="btn danger" data-act="delete-order">删除</button>');
    return '<div class="detail-hero"><div class="dh-top"><div class="dh-code">' + esc(o.code) + '</div>' + statusBadge(o) + '</div>' +
      '<div class="dh-name">' + esc(orderName(o)) + '</div>' +
      '<div class="dh-meta"><span>' + esc(D.relativeDay(o.date)) + ' ' + esc(o.time) + '</span><span>' + esc(room || '包厢待定') + '</span><span>' + (o.partySize || '?') + ' 位</span></div>' +
      '<div class="dh-tags chips">' + (o.dietary || []).filter((x) => x !== '无忌口').map((x) => chip(x, 'red')).join('') + (o.occasion ? chip(o.occasion, 'gold') : '') + (o.budget ? chip(D.money(o.budget) + (o.budgetMode === 'person' ? '/位' : '/桌'), 'green') : '') + ((o.tasteHints || []).length ? chip('口味 ' + o.tasteHints.slice(0, 3).join('、'), 'outline') : '') + '</div></div>' +
      '<div class="detail-body">' +
      '<div class="card pad flow-card">' + flowBar(o) + '</div>' +
      '<div class="card pad"><div class="info-grid">' +
        info('日期', D.fmtDateCN(o.date) + ' ' + D.weekdayCN(o.date)) +
        info('时间', o.time) +
        info('包厢', (room || '待定') + (roomObj ? '（' + roomCapText(roomObj) + '）' : '')) +
        info('人数', (o.partySize || '?') + ' 位') +
        info('电话', o.phone || '—') +
        info('微信', o.wechat || '—') +
        info('场景', o.occasion || '—') +
        info('餐标', o.budget ? D.money(o.budget) + (o.budgetMode === 'person' ? '/位' : '/桌') : '—') +
        info('预定提前', (D.dayDiff(D.todayStr(), o.date) >= 0 ? D.dayDiff(D.todayStr(), o.date) + ' 天' : '已过')) +
      '</div>' + (roomProblem ? '<div class="alert-line">' + I.alert + '<div><b>包厢提示：</b>' + esc(roomProblem) + (canManage ? '，可在「修改」里换包厢，或先生成菜单让 AI 自动排。' : '') + '</div></div>' : '') + '</div>' +
      (['confirmed', 'notified', 'done'].includes(o.status) ? '<div class="section"><div class="sec-head"><div class="sec-title">开台准备 · ' + (o.partySize || 0) + ' 人</div><button class="sec-action" data-act="copy-prep-one" data-id="' + o.id + '">复制准备单</button></div><div class="card pad">' + serviceCheckHtml(o, false, true) + '</div></div>' : '') +
      '<div class="section"><div class="sec-head"><div class="sec-title">菜单 · ' + (o.dishes || []).length + ' 道' + (total ? ' · ' + D.money(total) : '') + '</div>' +
        (can('aiMenu') && o.status !== 'cancelled' ? '<button class="sec-action" data-act="ai-menu">' + I.spark + ' ' + ((o.dishes || []).length ? 'AI 重新配菜' : 'AI 配菜') + '</button>' : '') + '</div><div class="card pad"><div class="dish-list">' +
        ((o.dishes || []).length ? o.dishes.map((x) => {
          const dishName = typeof x === 'string' ? x : x.name;
          const d = typeof x === 'object' ? x : null;
          const status = d && d.status === 'preorder' ? '<span class="st preorder">需提前' + (d.leadDays || '') + '天</span>' : (d && d.status === 'off' ? '<span class="st off">已下市</span>' : '');
          const price = d && d.price ? '<span class="muted small">' + D.money(d.price) + '</span>' : '';
          return '<div class="dish-line"><span>' + esc(dishName) + ' ' + status + '</span><span class="row">' + price + '</span></div>';
        }).join('') : '<div class="muted small">还没点菜。修改订单里可以按餐标智能配菜。</div>') +
      '</div>' + (total && o.budget ? '<div class="between mt8"><span class="small muted">餐标 ' + D.money(D.budgetTotalOf(o.budget, o.budgetMode, o.partySize)) + '</span><span class="small ' + (total > D.budgetTotalOf(o.budget, o.budgetMode, o.partySize) ? 'red' : 'gold') + '">菜品合计 ' + D.money(total) + ' · 人均 ' + D.money(Math.round(total / (o.partySize || 1))) + ' · ' + budgetBalance(o, total) + '</span></div>' : '') + '</div></div>' +
      ((o.dietary && o.dietary.length) || o.special || o.notes || guestDiet.length ? '<div class="section"><div class="sec-head"><div class="sec-title">忌口与特殊安排</div></div><div class="card pad">' +
        ((o.dietary || []).length ? '<div class="alert-line">' + I.alert + '<div><b>忌口：</b>' + esc(o.dietary.join('、')) + '</div></div>' : '') +
        (guestDiet.length ? '<div class="alert-line">' + I.alert + '<div><b>亲友回执忌口：</b>' + esc(guestDiet.join('、')) + '</div></div>' : '') +
        (o.special ? '<div class="alert-line gold">' + I.spark + '<div><b>特殊安排：</b>' + esc(o.special) + '</div></div>' : '') +
        (o.notes ? '<div class="notice mt8">' + esc(o.notes) + '</div>' : '') + '</div></div>' : '') +
      (guests.length ? '<div class="section"><div class="sec-head"><div class="sec-title">亲友到访记录 · ' + (attend.length ? attend.reduce((n, g) => n + (g.partySize || 1), 0) : 0) + ' 人确认到场</div>' +
        (canManage ? '<button class="sec-action" data-act="open-invite">邀请函</button>' : '') + '</div><div class="card pad">' +
        guests.map((g) => '<div class="info-row"><span class="k">' + esc(g.name || '亲友') + (g.attend === false ? '（缺席）' : '') + '</span><span class="v">' + (g.dietary && g.dietary.length ? esc(g.dietary.join('、')) : '无特殊忌口') + '</span></div>').join('') + '</div></div>' : '') +
      (cust ? '<div class="section"><div class="sec-head"><div class="sec-title">熟客档案</div><button class="sec-action" data-act="open-customer" data-id="' + cust.id + '">查看</button></div><div class="card pad">' +
        '<div class="row"><div class="avatar">' + esc(cust.name.slice(0, 1)) + '</div><div class="grow"><div class="cust-name">' + esc(custLabel(cust)) + (cust.tags || []).map((t) => chip(t, 'gold')).join('') + '</div>' +
        '<div class="cust-sub">' + (cust.dietary && cust.dietary.length ? '忌口：' + esc(cust.dietary.join('、')) + ' · ' : '') + (cust.tasteTags && cust.tasteTags.length ? '口味：' + esc(cust.tasteTags.slice(0, 4).join('、')) : '') + '</div></div></div>' +
        (customerFavs(cust).length ? '<div class="chips mt8">' + customerFavs(cust).map((x) => chip('常点 ' + x.name + '×' + x.count, 'outline')).join('') + '</div>' : '') +
        '</div></div>' : '') +
      '<div class="section"><div class="sec-head"><div class="sec-title">操作记录</div></div><div class="card pad"><div class="kv">' +
        (o.changeLog || []).slice().reverse().map((l) => '<div><b>' + esc(l.by || '') + '</b> · ' + esc(l.text) + '<span class="tiny muted"> ' + esc((l.at || '').replace('T', ' ').slice(0, 16)) + '</span></div>').join('') + '</div></div></div>' +
      (actions.length ? '<div class="btn-row mt16">' + actions.join('') + '</div>' : '') +
      '<div style="height:14px"></div></div>';
  }
  function info(k, v) { return '<div class="info-row"><span class="k">' + esc(k) + '</span><span class="v">' + esc(v) + '</span></div>'; }
  function budgetBalance(o, total) {
    const b = D.budgetTotalOf(o.budget, o.budgetMode, o.partySize);
    if (!b || !total) return '';
    const diff = b - total;
    return diff >= 0 ? '余 ' + D.money(diff) : '超 ' + D.money(-diff);
  }

  /* ---------- 审核 / 通知 / 完成 / 取消 ---------- */
  function doConfirmOrder(id) {
    const o = alive(S.orders).find((x) => x.id === id); if (!o) return;
    const proceed = () => {
      o.status = 'notified';
      o.audit = o.audit || {};
      o.audit.confirmedAt = o.audit.confirmedAt || D.nowISO();
      o.audit.notifiedAt = D.nowISO();
      o.audit.updatedAt = D.nowISO(); o.audit.updatedBy = roleName();
      o.changePending = false;
      addLog(o, '审核通过，已通知后厨和服务员');
      touch(o); saveState({ snap: true }); closeSheet(); render({ scroll: false }); toast('已确认，看板已同步');
    };
    const c = findConflict(o);
    if (c) {
      confirmSheet('包厢时间有冲突', (roomName(o.roomId) || '该包厢') + ' 当天 ' + c.time + ' 已有 ' + (c.customerName || '另一桌') + ' 的预定（' + STATUS[c.status].label + '）。仍要确认吗？', '仍然确认', proceed);
      return;
    }
    proceed();
  }
  function doNotifyOrder(id) {
    const o = alive(S.orders).find((x) => x.id === id); if (!o) return;
    o.status = 'notified'; o.audit = o.audit || {}; o.audit.notifiedAt = D.nowISO();
    addLog(o, '已通知后厨和服务员'); touch(o); saveState({ snap: true }); render({ scroll: false }); toast('已通知');
  }
  function doCompleteOrder(id) {
    const o = alive(S.orders).find((x) => x.id === id); if (!o) return;
    confirmSheet('确认这桌已完成？', '完成后会更新熟客到店记录，并学习这次的口味和常点菜。', '确认完成', () => {
      o.status = 'done'; o.audit = o.audit || {}; o.audit.doneAt = D.nowISO();
      addLog(o, '标记已完成'); touch(o);
      const c = orderCustomer(o);
      if (c) {
        c.visitCount = (c.visitCount || 0) + 1;
        c.lastVisit = o.date;
        D.learnCustomer(c, o);
      }
      saveState({ snap: true }); closeSheet(); render({ scroll: false }); toast('已完成，熟客档案已更新');
    });
  }
  function doCancelOrder(id) {
    const o = alive(S.orders).find((x) => x.id === id); if (!o) return;
    openSheet('<h3>取消预定</h3><p class="sheet-sub">' + esc(o.date) + ' ' + esc(o.time) + ' · ' + esc(orderName(o)) + ' · ' + (o.partySize || '?') + ' 位</p>' +
      '<div class="field"><label>取消原因（选填）</label><input id="cancelReason" type="text" placeholder="如：客人临时改期"></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="close-sheet">返回</button><button class="btn danger" data-act="cancel-order-confirm" data-id="' + id + '">确认取消</button></div>');
  }
  function addLog(o, text) { o.changeLog = o.changeLog || []; o.changeLog.push({ at: D.nowISO(), by: roleName(), text }); }

  /* ---------- 菜单流转话术 ---------- */
  function menuLines(o) {
    return (o.dishes || []).map((d, i) => (i + 1) + '. ' + (d.name || d) + (Number(d.price) ? '  ' + D.money(d.price) : '')).join('\n');
  }
  function handoffText(o) {
    const c = orderCustomer(o);
    const ro = enabledRooms().find((r) => r.id === o.roomId);
    const L = [];
    L.push('【转店长 · 配菜】' + (S.settings.shopName || '长季鲜'));
    L.push(o.code + ' · ' + D.fmtDateCN(o.date) + ' ' + D.weekdayCN(o.date) + ' ' + o.time);
    L.push('客人：' + orderName(o) + ' · ' + (o.partySize || '?') + ' 位' + (o.occasion ? ' · ' + o.occasion : ''));
    L.push('餐标：' + (o.budget ? D.money(o.budget) + (o.budgetMode === 'person' ? '/位' : '/桌') : '未定'));
    L.push('包厢：' + (roomName(o.roomId) || '待定') + (ro ? '（' + roomCapText(ro) + '）' : ''));
    L.push('忌口：' + ((o.dietary || []).filter((x) => x && x !== '无忌口').join('、') || '待确认'));
    if (c && (c.tasteTags || []).length) L.push('口味偏好：' + c.tasteTags.slice(0, 5).join('、'));
    if (c && customerFavs(c).length) L.push('常点：' + customerFavs(c).map((x) => x.name).join('、'));
    if (o.special) L.push('特殊安排：' + o.special);
    if (o.notes) L.push('备注：' + o.notes);
    if (o.phone) L.push('电话：' + o.phone);
    L.push('');
    L.push('请按人数 + 餐标出一版菜单，顺手把包厢排好。');
    return L.join('\n');
  }
  function menuTextForBoss(o) {
    const ro = enabledRooms().find((r) => r.id === o.roomId);
    const total = D.orderTotal(o);
    const budgetTotal = D.budgetTotalOf(o.budget, o.budgetMode, o.partySize);
    const pre = (o.dishes || []).filter((d) => d.status === 'preorder');
    const L = [];
    L.push('【菜单已生成 · 待老板确认】' + o.code);
    L.push(orderName(o) + ' · ' + (o.partySize || '?') + ' 位 · ' + (ro ? ro.name + '（' + roomCapText(ro) + '）' : '包厢待定'));
    L.push('');
    L.push(menuLines(o));
    L.push('');
    if (total) L.push('菜品合计 ' + D.money(total) + ' · 人均 ' + D.money(Math.round(total / (o.partySize || 1))) + (budgetTotal ? ' · 餐标 ' + D.money(budgetTotal) + '（' + budgetBalance(o, total) + '）' : ''));
    if (pre.length) L.push('需提前预订：' + pre.map((d) => d.name + '（提前' + (d.leadDays || 1) + '天）').join('、'));
    L.push('忌口已避开：' + ((o.dietary || []).filter((x) => x && x !== '无忌口').join('、') || '无'));
    L.push('');
    L.push('确认没问题就转给客户；要改菜我这边直接调。');
    return L.join('\n');
  }
  function menuTextForCustomer(o) {
    const ro = enabledRooms().find((r) => r.id === o.roomId);
    const total = D.orderTotal(o);
    const L = [];
    L.push((orderName(o) || '您好') + '，' + (S.settings.shopName || '长季鲜') + ' 为您安排的菜单：');
    L.push('');
    L.push(D.fmtDateCN(o.date) + ' ' + D.weekdayCN(o.date) + ' ' + o.time + ' · ' + (o.partySize || '') + ' 位 · ' + (ro ? ro.name : '包厢待定'));
    L.push('');
    L.push(menuLines(o));
    L.push('');
    if (total && o.partySize) L.push('共 ' + (o.dishes || []).length + ' 道 · 人均 ' + D.money(Math.round(total / (o.partySize || 1))));
    L.push('忌口已备注：' + ((o.dietary || []).filter((x) => x && x !== '无忌口').join('、') || '无'));
    L.push('');
    L.push('您看要不要加菜或换菜？直接回复我就行。确认后我把邀请函发您，方便转发给同席亲友。');
    if (S.settings.address) L.push('门店地址：' + S.settings.address);
    if (S.settings.phone) L.push('订座电话：' + S.settings.phone);
    return L.join('\n');
  }
  function openForwardSheet(o, stage, title, sub, text) {
    openSheet('<h3>' + esc(title) + '</h3><p class="sheet-sub">' + esc(sub) + '</p>' +
      '<div class="share-text">' + esc(text) + '</div>' +
      '<div class="btn-row mt8"><button class="btn primary" data-act="copy-forward" data-id="' + o.id + '" data-stage="' + stage + '" data-text="' + esc(text) + '">复制并标记已发送</button><button class="btn ghost" data-act="close-sheet">取消</button></div>' +
      '<div class="hint">复制后粘贴到微信发给对方。标记后流程会前进一步，对方处理完再往下走。</div>');
  }

  /* ---------- 日历 ---------- */
  function viewCalendar() {
    const date = ui.calDate || D.todayStr();
    const orders = alive(S.orders).filter((o) => o.date === date && o.status !== 'cancelled');
    const rooms = enabledRooms();
    const activeTables = orders.filter((o) => ['confirmed', 'notified', 'pending'].includes(o.status)).length;
    return '<div class="view-head"><div><div class="view-title">包厢日历</div><div class="view-sub">' + rooms.length + ' 个包厢 · 当日 ' + activeTables + ' 桌</div></div></div>' +
      '<div class="cal-nav"><button class="btn sm soft" data-act="cal-prev">' + I.back + '</button><div class="cal-date">' + D.fmtDateCN(date) + '<small>' + D.weekdayCN(date) + ' · ' + D.relativeDay(date) + '</small></div><button class="btn sm soft" data-act="cal-next">' + I.arrow + '</button></div>' +
      '<div class="between mb12"><input type="date" id="calDatePick" value="' + date + '" style="border:1px solid var(--line-2);border-radius:9px;padding:6px 9px;background:#fffdf9;font-size:13px">' +
      '<button class="btn sm soft" data-act="cal-today">回到今天</button></div>' +
      '<div class="cal-grid">' + rooms.map((r) => {
        const list = orders.filter((o) => o.roomId === r.id).sort((a, b) => a.time.localeCompare(b.time));
        return '<div class="cal-room-label"><b>' + esc(r.name) + '</b><span>' + r.seats + '座</span></div><div class="cal-slot">' +
          (list.length ? list.map((o) => '<div class="cal-booking ' + o.status + '" data-act="open-order" data-id="' + o.id + '"><div class="cb-top"><span class="cb-time">' + esc(o.time) + '</span>' + statusBadge(o) + '</div><div class="cb-name">' + esc(orderName(o)) + ' · ' + (o.partySize || '?') + '位</div><div class="cb-sub">' + esc(o.occasion || roomName(o.roomId)) + (findConflict(o) ? ' · <span class="red">时间冲突</span>' : '') + '</div></div>').join('') +
            '<button class="cal-free" data-act="new-order" data-date="' + date + '" data-room="' + r.id + '">+ 加一桌</button>' :
            '<button class="cal-free" data-act="new-order" data-date="' + date + '" data-room="' + r.id + '">空闲 · 点击预定</button>') +
          '</div>';
      }).join('') + '</div>' +
      '<div class="hint">同一包厢前后 2.5 小时内有两桌时，系统会提示冲突。</div>';
  }

  /* ---------- 熟客 ---------- */
  function viewCustomers() {
    let list = alive(S.customers).slice();
    const q = ui.custSearch.trim().toLowerCase();
    if (q) list = list.filter((c) => [c.name, c.phone, c.wechat, (c.aliases || []).join(' '), (c.tags || []).join(' '), (c.dietary || []).join(' ')].join(' ').toLowerCase().includes(q));
    list.sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || '') || (b.visitCount || 0) - (a.visitCount || 0));
    return '<div class="view-head"><div><div class="view-title">熟客档案</div><div class="view-sub">' + alive(S.customers).length + ' 位熟客 · 口味和忌口会自动积累</div></div><button class="btn sm soft" data-act="add-customer">' + I.plus + ' 新增</button></div>' +
      '<div class="searchbar">' + I.search + '<input id="custSearch" placeholder="搜姓名、电话、标签、忌口" value="' + esc(ui.custSearch) + '"></div>' +
      (list.length ? '<div class="list">' + list.map((c) => {
        const st = customerStats(c);
        return '<div class="cust-card" data-act="open-customer" data-id="' + c.id + '"><div class="avatar ' + ((c.tags || []).some((t) => /VIP|老友/.test(t)) ? 'gold' : '') + '">' + esc((c.name || '客').slice(0, 1)) + '</div>' +
          '<div class="cust-main"><div class="cust-name">' + esc(custLabel(c)) + (c.aliases || []).slice(0, 1).map((a) => '<span class="small muted">' + esc(a) + '</span>').join('') + (c.tags || []).slice(0, 2).map((t) => chip(t, 'gold')).join('') + '</div>' +
          '<div class="cust-sub">' + [(c.dietary || []).join('、'), (c.tasteTags || []).slice(0, 3).join('、'), st.lastVisit ? '上次 ' + D.relativeDay(st.lastVisit) : '新客', st.list.length ? st.list.length + ' 单' : ''].filter(Boolean).join(' · ') + '</div></div>' +
          '<span class="go">' + I.arrow + '</span></div>';
      }).join('') + '</div>' : emptyState('users', '还没有熟客档案', '录第一张预定后，系统会自动建档。')) + '<div style="height:12px"></div>';
  }
  function viewCustomerDetail() {
    const c = alive(S.customers).find((x) => x.id === ui.params.custId);
    if (!c) return emptyState('users', '档案不存在', '返回熟客列表看看。');
    const st = customerStats(c);
    const favs = customerFavs(c);
    return '<div class="profile-banner" style="padding:16px"><div class="row"><div class="avatar gold" style="width:52px;height:52px;font-size:22px">' + esc(c.name.slice(0, 1)) + '</div><div class="grow"><div class="pb-name">' + esc(custLabel(c)) + (c.aliases || []).map((a) => chip(a, 'outline')).join('') + (c.tags || []).map((t) => chip(t, 'gold')).join('') + '</div>' +
      '<div class="pb-meta">' + (c.phone ? '电话 ' + esc(c.phone) + '　' : '') + (c.wechat ? '微信 ' + esc(c.wechat) : '') + '</div></div></div>' +
      '<div class="pb-meta mt8">' + (c.dietary && c.dietary.length ? '<b>忌口：</b>' + esc(c.dietary.join('、')) + '　' : '') + (c.prefRoom ? '偏好包厢：' + esc(roomName(c.prefRoom)) + '　' : '') + '到店 ' + (c.visitCount || 0) + ' 次' + (st.lastVisit ? ' · 上次 ' + D.relativeDay(st.lastVisit) : '') + '</div>' +
      (c.notes ? '<div class="pb-notes">' + esc(c.notes) + '</div>' : '') + '</div>' +
      '<div class="btn-row"><button class="btn primary" data-act="new-for-customer" data-id="' + c.id + '">' + I.plus + ' 给他/她开一桌</button><button class="btn soft" data-act="edit-customer" data-id="' + c.id + '">编辑档案</button></div>' +
      '<div class="section"><div class="sec-head"><div class="sec-title">口味与常点</div></div><div class="card pad">' +
        ((c.tasteTags || []).length ? '<div class="chips">' + c.tasteTags.map((t) => chip(t, 'green')).join('') + '</div>' : '<div class="muted small">还没有口味记录，完成一次预定后会自动学习。</div>') +
        (favs.length ? '<div class="chips mt8">' + favs.map((x) => chip(x.name + ' ×' + x.count, 'gold')).join('') + '</div>' : '') +
        (c.budgetPref ? '<div class="hint">常餐标：' + D.money(c.budgetPref) + (c.budgetMode === 'person' ? '/位' : '/桌') + '</div>' : '') + '</div></div>' +
      '<div class="section"><div class="sec-head"><div class="sec-title">预定记录 · ' + st.list.length + ' 单</div><div class="sec-title small muted">累计 ' + D.money(st.spend) + '</div></div>' +
        (st.list.length ? st.list.map((o) => orderCard(o, true)).join('') : emptyState('list', '还没有到店记录', '开一桌后就会出现在这里。')) + '</div>' +
      '<div style="height:12px"></div>';
  }
  function openCustomerSheet(c) {
    const edit = !!c;
    const data = c || { name: '', phone: '', wechat: '', tags: [], dietary: [], tasteTags: [], notes: '', prefRoom: '' };
    openSheet('<h3>' + (edit ? '编辑熟客档案' : '新增熟客') + '</h3><p class="sheet-sub">标签、忌口、口味用中文逗号分隔。</p>' +
      '<div class="field"><label>姓名 / 称呼</label><input id="cName" type="text" value="' + esc(data.name) + '" placeholder="如 王建国 / 王总"></div>' +
      '<div class="field-row"><div class="field"><label>电话</label><input id="cPhone" type="tel" value="' + esc(data.phone) + '"></div><div class="field"><label>微信</label><input id="cWechat" type="text" value="' + esc(data.wechat) + '"></div></div>' +
      '<div class="field"><label>标签</label><input id="cTags" type="text" value="' + esc((data.tags || []).join('，')) + '" placeholder="老友、VIP、商务、素食"></div>' +
      '<div class="field"><label>忌口</label><input id="cDiet" type="text" value="' + esc((data.dietary || []).join('，')) + '" placeholder="海鲜过敏、不吃辣"></div>' +
      '<div class="field"><label>口味偏好</label><input id="cTaste" type="text" value="' + esc((data.tasteTags || []).join('，')) + '" placeholder="清淡、鲜、滋补"></div>' +
      '<div class="field"><label>偏好包厢</label><select id="cRoom"><option value="">无</option>' + enabledRooms().map((r) => '<option value="' + r.id + '" ' + (data.prefRoom === r.id ? 'selected' : '') + '>' + esc(r.name) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label>备注</label><textarea id="cNotes" placeholder="如：太太不吃香菜、孩子 6 岁">' + esc(data.notes) + '</textarea></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn primary" data-act="save-customer" data-id="' + (edit ? c.id : '') + '">保存</button></div>');
  }
  function saveCustomer(id) {
    const name = ($('#cName') || {}).value || '';
    if (!name.trim()) { toast('请填姓名或称呼'); return; }
    const c = id ? alive(S.customers).find((x) => x.id === id) : null;
    const target = c || { id: D.uid('c_'), name: '', aliases: [], wechat: '', phone: '', tags: [], dietary: [], tasteTags: [], tasteScores: {}, dishCounts: {}, prefRoom: '', notes: '', visitCount: 0, lastVisit: '', budgetPref: null, budgetMode: 'table', updatedAt: D.nowISO(), deleted: false, _dirty: true };
    target.name = name.trim();
    target.phone = ($('#cPhone') || {}).value || '';
    target.wechat = ($('#cWechat') || {}).value || '';
    target.tags = splitList(($('#cTags') || {}).value);
    target.dietary = splitList(($('#cDiet') || {}).value);
    target.tasteTags = splitList(($('#cTaste') || {}).value);
    target.prefRoom = ($('#cRoom') || {}).value || '';
    target.notes = ($('#cNotes') || {}).value || '';
    touch(target);
    if (!c) S.customers.push(target);
    S.meta.rev++;
    saveState({ snap: true }); closeSheet();
    if (ui.view === 'customerDetail') { render({ scroll: false }); } else { render(); }
    toast('熟客档案已保存');
  }
  function splitList(v) { return String(v || '').split(/[，,、\s]+/).map((x) => x.trim()).filter(Boolean); }

  /* ---------- 菜品 ---------- */
  function viewDishes() {
    const canEdit = can('menuShelf');
    const canAdd = can('menuEdit');
    const all = alive(S.dishes);
    const q = ui.dishSearch.trim().toLowerCase();
    const list = q ? all.filter((d) => [d.name, d.category, d.note, (d.tags || []).join(' '), (d.flavor || []).join(' ')].join(' ').toLowerCase().includes(q)) : all;
    const groups = [
      ['on', '在售', list.filter((d) => d.status === 'on')],
      ['preorder', '需提前预订', list.filter((d) => d.status === 'preorder')],
      ['off', '已下市', list.filter((d) => d.status === 'off')]
    ];
    return '<div class="view-head"><div><div class="view-title">时令菜品</div><div class="view-sub">' + all.filter((d) => d.status === 'on').length + ' 道在售 · ' + all.filter((d) => d.status === 'preorder').length + ' 道需预订</div></div>' +
      (canAdd ? '<button class="btn sm soft" data-act="add-dish">' + I.plus + ' 加菜</button>' : '') + '</div>' +
      '<div class="notice">' + (canEdit ? '老板 / 店长维护：上下架、改价、加新菜。后厨和服务员只能看，不能改。' : '时令菜单由店长维护，这里只能查看；有下市或断货的菜，直接跟店长说。') + '</div>' +
      '<div class="searchbar mt12">' + I.search + '<input id="dishSearch" placeholder="客人问菜？搜菜名、做法、口味" value="' + esc(ui.dishSearch) + '"></div>' +
      '<div class="btn-row mt12"><button class="btn soft" data-act="share-menu">' + I.share + ' 分享时令菜单</button><button class="btn soft" data-act="copy-menu-text">复制菜单文字</button></div>' +
      (!list.length ? emptyState('dish', '没有找到这道菜', '换个关键词，或点「加菜」录入。') : '') +
      groups.map((g) => (g[2].length ? '<div class="section"><div class="sec-head"><div class="sec-title">' + g[1] + ' · ' + g[2].length + '</div></div><div class="list">' +
        g[2].sort((a, b) => D.CATEGORIES.indexOf(a.category) - D.CATEGORIES.indexOf(b.category) || a.price - b.price).map((d) => '<div class="dish-row ' + (d.status === 'off' ? 'off' : '') + '"><div class="d-main"><div class="d-name">' + esc(d.name) + ' ' +
          (Number(d.price) > 0 ? '<span class="small muted">' + D.money(d.price) + '</span>' : '<span class="chip gold">待店长定价</span>') +
          (d.classic ? ' <span class="chip red">招牌</span>' : '') + '</div>' +
          '<div class="d-meta">' + esc(d.category) + (d.note ? ' · ' + esc(d.note) : '') + (d.status === 'preorder' ? ' · 提前' + d.leadDays + '天' : '') + ' · ' + esc((d.updatedAt || '').slice(5, 10)) + ' 更新</div></div>' +
          (canEdit ? '<div class="ds-toggle"><button class="' + (d.status === 'on' ? 'on on' : '') + '" data-act="set-dish-status" data-id="' + d.id + '" data-status="on">在售</button><button class="' + (d.status === 'preorder' ? 'on pre' : '') + '" data-act="set-dish-status" data-id="' + d.id + '" data-status="preorder">预订</button><button class="' + (d.status === 'off' ? 'on off' : '') + '" data-act="set-dish-status" data-id="' + d.id + '" data-status="off">下市</button><button class="ds-edit" data-act="edit-dish" data-id="' + d.id + '" aria-label="编辑">' + I.edit + '</button></div>' : '<span class="status ' + (d.status === 'on' ? 'notified' : d.status === 'preorder' ? 'pending' : 'done') + '">' + (d.status === 'on' ? '在售' : d.status === 'preorder' ? '需预订' : '下市') + '</span>') +
          '</div>').join('') + '</div></div>' : '')).join('') +
      '<div style="height:12px"></div>';
  }
  function openDishSheet(d) {
    if (!can('menuEdit')) { toast('菜单由老板 / 店长维护'); return; }
    const edit = !!d;
    const canPrice = can('menuPrice');
    const data = d || { name: '', category: '热菜', price: '', status: 'on', leadDays: 1, tags: [], flavor: [], note: '', classic: false };
    openSheet('<h3>' + (edit ? '编辑菜品' : '新增菜品') + '</h3><p class="sheet-sub">价格用于餐标配菜；' + (canPrice ? '改价会立刻影响 AI 配菜结果。' : '菜价只有店长能改。') + '</p>' +
      '<div class="field"><label>菜名</label><input id="dName" type="text" value="' + esc(data.name) + '"></div>' +
      '<div class="field-row"><div class="field"><label>类别</label><select id="dCat">' + D.CATEGORIES.map((c) => '<option ' + (data.category === c ? 'selected' : '') + '>' + c + '</option>').join('') + '</select></div><div class="field"><label>价格（元）</label><input id="dPrice" type="number" inputmode="numeric" value="' + esc(data.price) + '" ' + (canPrice ? '' : 'readonly') + ' placeholder="' + (canPrice ? '' : '店长定价') + '"></div></div>' +
      (canPrice ? '' : '<div class="hint" style="margin:-4px 0 8px">' + I.lock + ' 你只能改菜名、分类、做法和状态；价格字段已锁定，需店长修改。</div>') +
      '<div class="field-row"><div class="field"><label>状态</label><select id="dStatus"><option value="on" ' + (data.status === 'on' ? 'selected' : '') + '>在售</option><option value="preorder" ' + (data.status === 'preorder' ? 'selected' : '') + '>需预订</option><option value="off" ' + (data.status === 'off' ? 'selected' : '') + '>下市</option></select></div><div class="field"><label>提前天数</label><input id="dLead" type="number" min="0" value="' + esc(data.leadDays || 0) + '"></div></div>' +
      '<div class="field"><label>风味标签</label><input id="dFlavor" type="text" value="' + esc((data.flavor || []).join('，')) + '" placeholder="清淡、鲜、红糟、滋补"></div>' +
      '<div class="field"><label>约束标签</label><input id="dTags" type="text" value="' + esc((data.tags || []).join('，')) + '" placeholder="海鲜、素、猪、牛、辣、蛋、坚果"></div>' +
      '<div class="field"><label>备注</label><input id="dNote" type="text" value="' + esc(data.note) + '" placeholder="产地、做法、提示"></div>' +
      '<label class="row small" style="margin:6px 0 12px"><input id="dClassic" type="checkbox" ' + (data.classic ? 'checked' : '') + ' style="width:18px;height:18px">设为招牌 / 经典菜（邀请函上展示）</label>' +
      '<div class="btn-row"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn primary" data-act="save-dish" data-id="' + (edit ? d.id : '') + '">保存</button></div>');
  }
  function saveDish(id) {
    const name = ($('#dName') || {}).value || '';
    if (!name.trim()) { toast('请填菜名'); return; }
    const d = id ? alive(S.dishes).find((x) => x.id === id) : null;
    const target = d || { id: D.uid('d_'), name: '', category: '热菜', price: 0, status: 'on', leadDays: 0, tags: [], flavor: [], note: '', updatedAt: D.nowISO(), deleted: false, _dirty: true };
    const canPrice = can('menuPrice');
    const oldPrice = Number(target.price) || 0;
    target.name = name.trim();
    target.category = ($('#dCat') || {}).value || '热菜';
    if (canPrice) target.price = Number(($('#dPrice') || {}).value) || 0;
    target.status = ($('#dStatus') || {}).value || 'on';
    target.leadDays = Number(($('#dLead') || {}).value) || 0;
    target.flavor = splitList(($('#dFlavor') || {}).value);
    target.tags = splitList(($('#dTags') || {}).value);
    target.note = ($('#dNote') || {}).value || '';
    target.classic = !!($('#dClassic') || {}).checked;
    touch(target);
    if (!d) S.dishes.push(target);
    S.meta.rev++;
    saveState({ snap: true }); closeSheet(); render({ scroll: false });
    if (!canPrice && target.price <= 0) toast('已提交，等店长定价后才会进入 AI 配菜');
    else if (!canPrice && Number(($('#dPrice') || {}).value) !== oldPrice) toast('已保存（菜价未变，改价需店长）');
    else toast('菜品已保存');
  }
  function setDishStatus(id, status) {
    if (!can('menuShelf')) { toast('上下架由老板 / 店长操作'); return; }
    const d = alive(S.dishes).find((x) => x.id === id); if (!d) return;
    if (status === 'on' && !(Number(d.price) > 0) && !can('menuPrice')) { toast('这道菜还没定价，等店长定价后再上架'); return; }
    d.status = status; touch(d); S.meta.rev++;
    saveState(); render({ scroll: false }); toast('已更新为「' + (status === 'on' ? '在售' : status === 'preorder' ? '需提前预订' : '下市') + '」');
  }

  /* ---------- 备货 ---------- */
  function prepOrders(date) {
    return alive(S.orders).filter((o) => o.date === date && ['confirmed', 'notified'].includes(o.status)).sort((a, b) => a.time.localeCompare(b.time));
  }
  function prepSummary(date) {
    const orders = prepOrders(date);
    const dishMap = {};
    orders.forEach((o) => (o.dishes || []).forEach((x) => {
      const name = typeof x === 'string' ? x : x.name;
      if (!name) return;
      if (!dishMap[name]) dishMap[name] = { name, count: 0, rooms: [], price: (x && x.price) || 0, status: (x && x.status) || 'on', leadDays: (x && x.leadDays) || 0 };
      dishMap[name].count++;
      const rn = roomName(o.roomId);
      if (rn && dishMap[name].rooms.indexOf(rn) < 0) dishMap[name].rooms.push(rn);
    }));
    return { orders, dishes: Object.keys(dishMap).map((k) => dishMap[k]).sort((a, b) => a.category - b.category), guests: orders.reduce((n, o) => n + (Number(o.partySize) || 0), 0) };
  }
  function viewPrep() {
    if (!can('prepView')) return emptyState('clipboard', '备货单由店长查看', '服务员请用「看板」按包厢做开台准备。');
    const canManage = can('prepManage');
    const date = ui.prepDate || D.todayStr();
    const sum = prepSummary(date);
    const preorder = sum.dishes.filter((d) => d.status === 'preorder');
    const onsite = sum.dishes.filter((d) => d.status !== 'preorder');
    const dietLines = [];
    sum.orders.forEach((o) => { if ((o.dietary || []).length) dietLines.push({ room: roomName(o.roomId), time: o.time, name: orderName(o), text: (o.dietary || []).join('、') }); (o.guests || []).forEach((g) => { if ((g.dietary || []).length) dietLines.push({ room: roomName(o.roomId), time: o.time, name: g.name + '（亲友）', text: g.dietary.join('、') }); }); });
    return '<div class="view-head"><div><div class="view-title">备货清单</div><div class="view-sub">只统计已确认 / 已通知的订单' + (canManage ? '' : ' · 只读') + '</div></div></div>' +
      '<div class="cal-nav"><button class="btn sm soft" data-act="prep-prev">' + I.back + '</button><div class="cal-date">' + D.fmtDateCN(date) + '<small>' + D.weekdayCN(date) + ' · ' + D.relativeDay(date) + '</small></div><button class="btn sm soft" data-act="prep-next">' + I.arrow + '</button></div>' +
      '<div class="stat-row"><div class="stat-cell"><b>' + sum.orders.length + '</b><span>桌数</span></div><div class="stat-cell"><b>' + sum.guests + '</b><span>人数</span></div><div class="stat-cell"><b>' + sum.dishes.length + '</b><span>菜品数</span></div></div>' +
      (canManage ?
        '<div class="btn-row mt12"><button class="btn primary" data-act="copy-prep">' + I.clipboard + ' 复制发给厨师</button><button class="btn soft" data-act="export-prep">导出 CSV</button></div>' +
        '<button class="btn ghost block mt8" data-act="print-prep">打印备货单</button>' :
        '<div class="notice mt12">备货单由店长维护：复制、导出、打印都在店长端。后厨可以随时查看当天需求。</div>') +
      '<div class="section"><div class="sec-head"><div class="sec-title">需提前预订 · ' + preorder.length + '</div></div><div class="card pad">' +
        (preorder.length ? preorder.map((d) => '<div class="dish-line"><span><b>' + esc(d.name) + '</b> <span class="small muted">' + esc(d.rooms.join('、')) + '</span></span><span class="row"><span class="chip gold">× ' + d.count + ' 桌</span>' + (d.leadDays ? '<span class="tiny muted">提前' + d.leadDays + '天</span>' : '') + '</span></div>').join('') : '<div class="muted small">暂无需要提前预订的菜。</div>') + '</div></div>' +
      '<div class="section"><div class="sec-head"><div class="sec-title">在售菜品 · ' + onsite.length + '</div></div><div class="card pad">' +
        (onsite.length ? onsite.map((d) => '<div class="dish-line"><span>' + esc(d.name) + '</span><span class="row"><span class="chip">× ' + d.count + ' 桌</span><span class="tiny muted">' + esc(d.rooms.join('、')) + '</span></span></div>').join('') : '<div class="muted small">这一天还没有确认的菜单。</div>') + '</div></div>' +
      '<div class="section"><div class="sec-head"><div class="sec-title">忌口与特殊提醒</div></div><div class="card pad">' +
        (dietLines.length ? dietLines.map((x) => '<div class="alert-line">' + I.alert + '<div><b>' + esc(x.room) + ' ' + esc(x.time) + ' ' + esc(x.name) + '：</b>' + esc(x.text) + '</div></div>').join('') : '<div class="muted small">暂无特别忌口。</div>') +
        sum.orders.filter((o) => o.special).map((o) => '<div class="alert-line gold">' + I.spark + '<div><b>' + esc(roomName(o.roomId)) + ' ' + esc(o.time) + '：</b>' + esc(o.special) + '</div></div>').join('') + '</div></div>' +
      '<div style="height:12px"></div>';
  }
  function prepText(date) {
    const sum = prepSummary(date);
    const lines = [S.settings.shopName + ' · ' + D.fmtDateCN(date) + ' ' + D.weekdayCN(date) + ' 备货清单', '共 ' + sum.orders.length + ' 桌 / ' + sum.guests + ' 人', ''];
    lines.push('【需提前预订】');
    const pre = sum.dishes.filter((d) => d.status === 'preorder');
    if (!pre.length) lines.push('（无）');
    pre.forEach((d) => lines.push('· ' + d.name + ' × ' + d.count + ' 桌（' + d.rooms.join('、') + '）' + (d.leadDays ? ' 提前' + d.leadDays + '天' : '')));
    lines.push('', '【在售菜品】');
    sum.dishes.filter((d) => d.status !== 'preorder').forEach((d) => lines.push('· ' + d.name + ' × ' + d.count + ' 桌（' + d.rooms.join('、') + '）'));
    lines.push('', '【忌口 / 特殊安排】');
    let any = false;
    sum.orders.forEach((o) => {
      if ((o.dietary || []).length) { any = true; lines.push('· ' + roomName(o.roomId) + ' ' + o.time + ' ' + orderName(o) + '：' + o.dietary.join('、')); }
      if (o.special) { any = true; lines.push('· ' + roomName(o.roomId) + ' ' + o.time + ' ' + orderName(o) + '：' + o.special); }
      (o.guests || []).forEach((g) => { if ((g.dietary || []).length) { any = true; lines.push('· ' + roomName(o.roomId) + ' ' + g.name + '（亲友）：' + g.dietary.join('、')); } });
    });
    if (!any) lines.push('（无）');
    lines.push('', '—— 长季鲜 · ' + (S.settings.cuisine || ''));
    return lines.join('\n');
  }
  function exportPrepCsv(date) {
    const sum = prepSummary(date);
    const rows = [['日期', '包厢', '时间', '客人', '人数', '餐标', '菜品', '忌口', '特殊安排']];
    sum.orders.forEach((o) => {
      rows.push([o.date, roomName(o.roomId), o.time, orderName(o), o.partySize, o.budget || '', (o.dishes || []).map((d) => d.name || d).join('、'), (o.dietary || []).join('、'), o.special || '']);
    });
    const csv = '﻿' + rows.map((r) => r.map((c) => '"' + String(c === null || c === undefined ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    download('长季鲜备货-' + date + '.csv', csv, 'text/csv;charset=utf-8');
    toast('已导出 CSV');
  }

  /* ---------- 服务看板 ---------- */
  function viewBoard() {
    const date = ui.boardDate || D.todayStr();
    const orders = alive(S.orders).filter((o) => o.date === date && ['confirmed', 'notified'].includes(o.status)).sort((a, b) => a.time.localeCompare(b.time));
    const guests = orders.reduce((n, o) => n + (Number(o.partySize) || 0), 0);
    const prepDone = orders.reduce((n, o) => n + serviceCheckState(o).done, 0);
    const prepTotal = orders.length * SERVICE_CHECKS.length;
    const prepLine = prepTotal ? ' · 开台准备 ' + prepDone + '/' + prepTotal : '';
    return '<div class="board-head"><div><div class="view-title">接待看板</div><div class="view-sub">' + D.fmtDateCN(date) + ' ' + D.weekdayCN(date) + ' · ' + orders.length + ' 桌 / ' + guests + ' 人' + prepLine + '</div></div>' +
      '<button class="icon-btn" style="background:#f1ece1;color:var(--ink)" data-act="refresh-now" aria-label="刷新">' + I.refresh + '</button></div>' +
      '<div class="seg mb12"><button class="' + (date === D.todayStr() ? 'on' : '') + '" data-act="board-date" data-date="' + D.todayStr() + '">今天</button><button class="' + (date === D.addDays(D.todayStr(), 1) ? 'on' : '') + '" data-act="board-date" data-date="' + D.addDays(D.todayStr(), 1) + '">明天</button></div>' +
      (orders.length ? '<button class="btn soft block mb12" data-act="copy-board-prep">' + I.clipboard + ' 复制今日开台准备单（包厢 + 算量）</button>' : '') +
      (orders.length ? orders.map((o) => {
        const diet = (o.dietary || []).filter((x) => x && x !== '无忌口');
        const guestDiet = Array.from(new Set((o.guests || []).flatMap((g) => g.dietary || [])));
        const special = o.special || '';
        const soon = o.date === D.todayStr() && toMinutes(o.time) - (new Date().getHours() * 60 + new Date().getMinutes()) <= 120 && toMinutes(o.time) >= (new Date().getHours() * 60 + new Date().getMinutes());
        return '<div class="board-card ' + (diet.length || guestDiet.length ? 'alert' : (soon ? 'soon' : '')) + '" data-act="open-order" data-id="' + o.id + '">' +
          '<div class="bc-top"><div class="bc-time">' + esc(o.time) + '<small>' + esc(roomName(o.roomId)) + '</small></div><div class="grow"><div class="bc-title">' + esc(orderName(o)) + ' · ' + (o.partySize || '?') + '位</div><div class="bc-sub">' + esc(roomName(o.roomId) || '包厢待定') + ' · ' + esc(roomCapText(enabledRooms().find((r) => r.id === o.roomId) || {})) + ' · ' + esc(o.occasion || '到店') + (o.budget ? ' · ' + D.money(o.budget) : '') + '</div></div>' + statusBadge(o) + '</div>' +
          (diet.length ? '<div class="bc-alert">忌口：' + esc(diet.join('、')) + '</div>' : '') +
          (guestDiet.length ? '<div class="bc-alert">亲友忌口：' + esc(guestDiet.join('、')) + '</div>' : '') +
          (special ? '<div class="bc-special">特殊安排：' + esc(special) + '</div>' : '') +
          serviceCheckHtml(o, true) +
          '<div class="chips">' + (o.dishes || []).slice(0, 6).map((d) => '<span class="chip">' + esc(d.name || d) + '</span>').join('') + ((o.dishes || []).length > 6 ? '<span class="chip outline">+' + ((o.dishes || []).length - 6) + '</span>' : '') + '</div>' +
          ((o.guests || []).length ? '<div class="hint">亲友回执：' + (o.guests || []).filter((g) => g.attend !== false).length + ' 位到场' + (guestDiet.length ? ' · 忌口已标注' : '') + '</div>' : '') +
          '<button class="btn xs soft mt8" data-act="copy-prep-one" data-id="' + o.id + '">复制本桌准备单</button>' +
          '</div>';
      }).join('') : emptyState('bell', '这一天没有已确认的预定', '订单经店长确认后会自动出现在看板。')) +
      '<div class="board-refresh">每 30 秒自动刷新' + (ui.lastSyncAt ? ' · 最近同步 ' + ui.lastSyncAt : '') + '</div>';
  }

  /* ---------- 台账 ---------- */
  function viewLedger() {
    let list = alive(S.orders).filter((o) => ['done', 'cancelled'].includes(o.status));
    if (ui.ledgerFilter === 'done') list = list.filter((o) => o.status === 'done');
    if (ui.ledgerFilter === 'cancelled') list = list.filter((o) => o.status === 'cancelled');
    const q = ui.ledgerSearch.trim().toLowerCase();
    if (q) list = list.filter((o) => [o.customerName, o.phone, roomName(o.roomId), o.date, o.occasion, o.special].join(' ').toLowerCase().includes(q) || (o.dishes || []).some((d) => String(d.name || d).toLowerCase().includes(q)));
    list.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
    const done = alive(S.orders).filter((o) => o.status === 'done');
    const guests = done.reduce((n, o) => n + (Number(o.partySize) || 0), 0);
    return '<div class="view-head"><div><div class="view-title">历史台账</div><div class="view-sub">' + done.length + ' 桌已完成 · 累计 ' + guests + ' 人次 · 只显示已完成/已取消</div></div></div>' +
      '<div class="searchbar">' + I.search + '<input id="ledgerSearch" placeholder="搜客人、电话、菜品、日期" value="' + esc(ui.ledgerSearch) + '"></div>' +
      '<div class="seg mb12"><button class="' + (ui.ledgerFilter === 'all' ? 'on' : '') + '" data-act="ledger-filter" data-filter="all">全部</button><button class="' + (ui.ledgerFilter === 'done' ? 'on' : '') + '" data-act="ledger-filter" data-filter="done">已完成</button><button class="' + (ui.ledgerFilter === 'cancelled' ? 'on' : '') + '" data-act="ledger-filter" data-filter="cancelled">已取消</button></div>' +
      (list.length ? '<div class="list">' + list.map((o) => '<div class="ledger-item" data-act="open-order" data-id="' + o.id + '"><div class="ledger-date"><b>' + esc(o.date.slice(8)) + '</b><span>' + esc(D.weekdayCN(o.date)) + '</span></div>' +
        '<div class="ledger-main"><div class="l1">' + esc(orderName(o)) + ' · ' + esc(roomName(o.roomId)) + ' · ' + (o.partySize || '?') + '位 ' + statusBadge(o) + '</div><div class="l2">' + esc(o.date) + ' ' + esc(o.time) + ' · ' + esc((o.dishes || []).map((d) => d.name || d).slice(0, 3).join('、')) + '</div></div><span class="muted small">' + (o.budget ? D.money(o.budget) : '') + '</span></div>').join('') + '</div>' :
        emptyState('list', '还没有历史记录', '已完成的订单会归档到这里，方便查老客。')) +
      '<div style="height:12px"></div>';
  }

  /* ---------- 更多 ---------- */
  function viewMore() {
    const role = session.role;
    const tools = [];
    if (can('orderManage')) {
      tools.push(['ledger', '历史台账', '查老客消费和常点菜', 'list', '']);
      tools.push(['customers', '熟客档案', '口味、忌口、到店记录', 'users', '']);
      tools.push(['dishes', '时令菜品', '上下架、改菜、改菜价', 'dish', '']);
      tools.push(['prep', '备货清单', '按日汇总给厨师', 'clipboard', 'gold']);
    }
    if (role === 'kitchen') {
      tools.push(['dishes', '时令菜单', '只看在售 / 预订 / 下市', 'dish', '']);
      tools.push(['prep', '备货单', '看当日要备什么（只读）', 'clipboard', 'gold']);
      tools.push(['orders', '今日需求', '看每桌点了什么', 'list', '']);
      tools.push(['ledger', '历史台账', '回看老菜单', 'list', '']);
    }
    if (role === 'service') {
      tools.push(['dishes', '时令菜单', '当前在售和需预订', 'dish', '']);
      tools.push(['ledger', '历史台账', '查老客记录', 'list', '']);
    }
    return '<div class="view-head"><div><div class="view-title">更多</div><div class="view-sub">' + esc(S.settings.shopName) + ' · ' + esc(S.settings.cuisine || '') + '</div></div></div>' +
      '<div class="card pad' + (syncReady() ? '' : '') + '"><div class="between"><div class="row"><span class="lr-ico ' + (syncReady() ? '' : 'gold') + '">' + I.cloud + '</span><div><div class="lr-title">' + (syncReady() ? '多人同步已连接' : (cloudConfigured() ? '同步待登录' : '本地模式')) + '</div><div class="lr-sub">' + (syncReady() ? '老板/店长/后厨/服务员共享数据' : '数据只在这台设备，设置里可接云端') + '</div></div></div><button class="btn sm ' + (syncReady() ? 'soft' : 'gold') + '" data-act="cloud-sync">' + (syncReady() ? '同步' : '设置') + '</button></div></div>' +
      '<div class="tool-grid mt12">' + tools.map((t) => '<button class="tool" data-act="go" data-view="' + t[0] + '"><span class="t-ico ' + t[4] + '">' + I[t[3]] + '</span><span class="t-title">' + t[1] + '</span><span class="t-sub">' + t[2] + '</span></button>').join('') +
        '<button class="tool" data-act="share-menu"><span class="t-ico blue">' + I.share + '</span><span class="t-title">时令菜单链接</span><span class="t-sub">发给熟客自己看</span></button>' +
        '<button class="tool" data-act="settings"><span class="t-ico">' + I.settings + '</span><span class="t-title">设置与备份</span><span class="t-sub">店名、包厢、密码、数据</span></button>' +
        '<button class="tool" data-act="help"><span class="t-ico gold">' + I.help + '</span><span class="t-title">使用说明</span><span class="t-sub">一页纸看懂</span></button>' +
        (role === 'boss' || role === 'manager' ? '<button class="tool" data-act="role-qr"><span class="t-ico blue">' + I.users + '</span><span class="t-title">角色入口二维码</span><span class="t-sub">老板/店长/后厨/服务员各一张</span></button>' : '') +
        '<button class="tool" data-act="switch-role"><span class="t-ico red">' + I.swap + '</span><span class="t-title">切换角色</span><span class="t-sub">当前：' + roleName() + '</span></button>' +
      '</div>' +
      '<div class="section"><div class="notice"><b>多端同步说明</b><br>同一台手机固定用一种方式打开（桌面图标或微信），数据才一致。换手机前先在设置里导出备份。</div></div>' +
      '<div class="center tiny muted mt16">长季鲜 v' + D.APP_VERSION + ' · 数据存本机 + 可选云端</div>' +
      '<div style="height:12px"></div>';
  }

  /* ---------- 设置 ---------- */
  function viewSettings() {
    const sync = window.CJXSync ? window.CJXSync.status() : { configured: false, authed: false };
    return '<div class="view-head"><div><div class="view-title">设置</div><div class="view-sub">店名、包厢、密码、数据备份</div></div></div>' +
      '<div class="form-card"><h3>门店信息</h3>' +
        '<div class="field"><label>店名</label><input id="setShopName" type="text" value="' + esc(S.settings.shopName) + '"></div>' +
        '<div class="field"><label>菜系</label><input id="setCuisine" type="text" value="' + esc(S.settings.cuisine || '') + '" placeholder="福安菜 × 厦门海鲜"></div>' +
        '<div class="field"><label>营业时间</label><input id="setHours" type="text" value="' + esc(S.settings.businessHours || '') + '"></div>' +
        '<div class="field"><label>门店地址（邀请函定位 / 导航用）</label><input id="setAddress" type="text" value="' + esc(S.settings.address || '') + '" placeholder="厦门市湖里区天地建材城综合楼东侧二楼"></div>' +
        '<div class="field"><label>电话</label><input id="setPhone" type="tel" value="' + esc(S.settings.phone || '') + '"></div>' +
        '<div class="field"><label>店招广告语</label><input id="setSlogan" type="text" value="' + esc(S.settings.slogan || '') + '" placeholder="时令海鲜 · 私厨家宴"></div>' +
        '<div class="field"><label>店招广告位文案（选填）</label><input id="setAdText" type="text" value="' + esc(S.settings.adText || '') + '" placeholder="本月主打：下白石鲟 / 承接寿宴"></div>' +
        '<div class="field-row"><div class="field"><label>服务经理姓名（选填）</label><input id="setManagerName" type="text" value="' + esc(S.settings.managerName || '') + '" placeholder="如：小陈"></div><div class="field"><label>服务经理电话（选填）</label><input id="setManagerPhone" type="tel" value="' + esc(S.settings.managerPhone || '') + '" placeholder="邀请函上可一键拨打"></div></div>' +
        '<div class="hint" style="margin:-4px 0 10px">填了之后，邀请函会出现「专属服务经理」版块，客人一键拨打电话。</div>' +
        '<div class="field-row"><div class="field"><label>纬度（选填）</label><input id="setLat" type="text" inputmode="decimal" value="' + esc(S.settings.lat || '') + '" placeholder="24.49"></div><div class="field"><label>经度（选填）</label><input id="setLng" type="text" inputmode="decimal" value="' + esc(S.settings.lng || '') + '" placeholder="118.13"></div></div>' +
        '<div class="hint" style="margin:-4px 0 10px">填了经纬度，邀请函里的导航按钮直接定位到门口；只填地址则按「店名 + 地址」搜索。</div>' +
        '<button class="btn primary sm" data-act="save-shop">保存门店信息</button></div>' +
      '<div class="form-card"><h3>包厢 · ' + enabledRooms().length + '</h3>' +
        alive(S.rooms).sort((a, b) => (a.sort || 0) - (b.sort || 0)).map((r) => '<div class="room-edit"><div class="field" style="margin:0"><label>名称</label><input id="roomName_' + r.id + '" type="text" value="' + esc(r.name) + '"></div>' +
          '<div class="field" style="margin:0"><label>最少</label><input id="roomMin_' + r.id + '" type="number" min="1" value="' + esc(r.minSeats || '') + '"></div>' +
          '<div class="field" style="margin:0"><label>最多</label><input id="roomMax_' + r.id + '" type="number" min="1" value="' + esc(r.maxSeats || r.seats) + '"></div>' +
          '<label class="row small muted" style="padding-bottom:12px"><input id="roomOn_' + r.id + '" type="checkbox" ' + (r.enabled !== false ? 'checked' : '') + ' style="width:18px;height:18px">启用</label></div>').join('') +
        '<div class="btn-row"><button class="btn soft sm" data-act="add-room">+ 加包厢</button><button class="btn primary sm" data-act="save-rooms">保存包厢</button></div>' +
        '<div class="hint">默认 VIP1 / VIP2 坐 10–12 人、VIP3 坐 15–18 人。AI 配菜会按人数自动排到「刚好坐得下」的包厢。</div></div>' +
      '<div class="form-card"><h3>角色密码（选填）</h3><p class="hint" style="margin-top:-6px;margin-bottom:10px">4 位数字，防止店员误进老板端；不是账号安全体系。</p>' +
        Object.keys(ROLES).map((k) => '<div class="field"><label>' + ROLES[k].name + '</label><input id="pin_' + k + '" type="password" inputmode="numeric" maxlength="4" value="' + esc((S.settings.pins || {})[k] || '') + '" placeholder="不设则留空"></div>').join('') +
        '<button class="btn primary sm" data-act="save-pins">保存密码</button></div>' +
      '<div class="form-card"><h3>多人同步</h3>' +
        '<div class="notice">' + (sync.authed ? '<b>已登录：</b>' + esc(window.CJXSync.getConfig().email) + '<br>数据会同步到云端，多人共享。' : (sync.configured ? '<b>已配置，未登录。</b>重新登录后开始同步。' : '<b>当前是本地模式。</b>数据只在这台设备。多人同步需要 Supabase 免费库，按 README 建好表后在这里登录。')) + '</div>' +
        '<div class="btn-row mt8"><button class="btn ' + (sync.authed ? 'soft' : 'gold') + '" data-act="cloud-setup">' + (sync.authed ? '同步设置' : '配置多人同步') + '</button>' +
        (sync.authed ? '<button class="btn soft" data-act="cloud-sync">立即同步</button>' : '') + '</div>' +
        (sync.lastSyncAt ? '<div class="hint">最近同步：' + esc(String(sync.lastSyncAt).replace('T', ' ').slice(0, 16)) + '</div>' : '') + '</div>' +
      '<div class="form-card"><h3>数据安全</h3>' +
        '<div class="btn-row"><button class="btn soft" data-act="export-data">' + I.download + ' 导出备份</button><button class="btn soft" data-act="import-data">' + I.upload + ' 导入备份</button></div>' +
        '<div class="btn-row mt8"><button class="btn soft" data-act="restore-snap">恢复快照</button><button class="btn soft" data-act="import-dishes">导入新菜系</button></div>' +
        '<div class="btn-row mt8"><button class="btn soft" data-act="reload-demo">载入示例数据</button><button class="btn danger" data-act="reset-all">清空所有数据</button></div>' +
        '<input type="file" id="importFile" accept="application/json,.json" class="hidden"><input type="file" id="dishFile" accept="application/json,.json" class="hidden">' +
        '<div class="hint">系统自动保留最近 10 份快照。换手机、清理浏览器缓存前一定要导出备份。导入新菜系会替换全部菜品，做成其他菜系时用。</div></div>' +
      '<div class="form-card"><h3>AI 整理订单</h3><p class="hint" style="margin-top:-6px">把这段提示词和客人聊天记录一起发给 AI，拿到 JSON 后粘到「新建预定 → 粘贴 AI 订单 JSON」。</p>' +
        '<div class="code-box">' + esc(S.settings.aiPrompt) + '</div><button class="btn soft sm mt8" data-act="copy-ai-prompt">复制提示词</button></div>' +
      '<div class="center tiny muted mt16">长季鲜 v' + D.APP_VERSION + ' · schema ' + (S.meta.schemaVersion || 2) + '</div>' +
      '<div style="height:12px"></div>';
  }

  /* ---------- 弹层 / 确认 ---------- */
  function openSheet(html) {
    const root = $('#modalRoot');
    if (!root) return;
    root.innerHTML = '<div class="veil"><div class="sheet"><div class="sheet-handle"></div>' + html + '</div></div>';
    const veil = root.querySelector('.veil');
    if (veil) veil.addEventListener('click', (e) => { if (e.target === veil) closeSheet(); });
    const first = root.querySelector('input,textarea,select');
    if (first) setTimeout(() => { try { first.focus(); } catch (e) { } }, 80);
  }
  function closeSheet() { const root = $('#modalRoot'); if (root) root.innerHTML = ''; ui.pendingAction = null; }
  function confirmSheet(title, msg, okLabel, onOk, danger) {
    ui.pendingAction = onOk;
    openSheet('<h3>' + esc(title) + '</h3><p class="sheet-sub">' + esc(msg) + '</p><div class="btn-row"><button class="btn ghost" data-act="sheet-cancel">先不</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" data-act="sheet-ok">' + esc(okLabel) + '</button></div>');
  }

  /* ---------- 邀请函 ---------- */
  // v4：短字段名 + 不带云端回执配置，链接能短一半以上，微信里转发不再像"一堆代码"
  // 导航链接由 invite.html 根据店名+地址现算，不占链接体积
  function invitePayload(o) {
    const s = S.settings;
    const mgr = (s.managerName || s.managerPhone) ? { n: s.managerName || '', p: s.managerPhone || s.phone || '', t: s.managerTitle || '包厢服务经理' } : null;
    return {
      v: 4, t: 'invite',
      s: { n: s.shopName, c: s.cuisine, h: s.businessHours, p: s.phone, a: s.address || '', g: s.slogan || '', ad: s.adText || '', m: mgr },
      c: D.classicDishes(S, 6).map((d) => ({ n: d.name, pr: Number(d.price) || 0, no: d.note || '' })),
      o: { d: o.date, t: o.time, r: roomName(o.roomId), h: o.customerName, s: o.partySize, c: o.occasion, sp: o.special || '', ds: (o.dishes || []).map((d) => d.name || d) }
    };
  }
  const SERIF = '"Songti SC","STSong","SimSun",serif';
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function makeQrCanvas(text, size) {
    return new Promise((resolve) => {
      if (typeof QRCode === 'undefined') return resolve(null);
      const box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + size + 'px;height:' + size + 'px';
      document.body.appendChild(box);
      try {
        new QRCode(box, { text: text, width: size, height: size, colorDark: '#1f3a32', colorLight: '#fffdf9', correctLevel: QRCode.CorrectLevel.L });
      } catch (e) { box.remove(); return resolve(null); }
      setTimeout(() => {
        try {
          const cv = box.querySelector('canvas');
          if (cv) {
            const out = document.createElement('canvas'); out.width = size; out.height = size;
            out.getContext('2d').drawImage(cv, 0, 0, size, size);
            box.remove(); return resolve(out);
          }
          const img = box.querySelector('img');
          if (img) {
            const out = document.createElement('canvas'); out.width = size; out.height = size;
            const draw = () => { try { out.getContext('2d').drawImage(img, 0, 0, size, size); } catch (e) { } box.remove(); resolve(out); };
            if (img.complete) draw(); else img.onload = draw;
            return;
          }
        } catch (e) { }
        box.remove(); resolve(null);
      }, 60);
    });
  }
  function wrapLines(ctx, text, maxWidth, maxLines) {
    const chars = String(text || '').split('');
    const lines = [];
    let cur = '';
    chars.forEach((ch) => {
      const test = cur + ch;
      if (ctx.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = ch; }
      else cur = test;
    });
    if (cur) lines.push(cur);
    if (lines.length > (maxLines || 2)) { lines.length = maxLines || 2; lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…'; }
    return lines;
  }
  /* 门店照片：把真实照片放进 photos/ 目录同名替换即生效；
     文件不存在时用渐变占位块，不影响生成 */
  function loadImg(src, timeout) {
    return new Promise((resolve) => {
      const img = new Image();
      let done = false;
      const fin = (im) => { if (done) return; done = true; resolve(im); };
      img.onload = () => fin(img);
      img.onerror = () => fin(null);
      img.src = src;
      setTimeout(() => fin(null), timeout || 2200);
    });
  }
  function photoSrc(kind, key) {
    const q = kind === 'env' ? ('env-' + key) : (kind === 'manager' ? 'manager' : ('dish-' + key));
    return 'photos/' + encodeURIComponent(q) + '.jpg';
  }
  function drawCover(ctx, img, x, y, w, h) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function drawPhotoBox(ctx, img, x, y, w, h, r, label, caption) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r); ctx.clip();
    if (img) { drawCover(ctx, img, x, y, w, h); }
    else {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#2c5345'); g.addColorStop(1, '#162d27');
      ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(231,214,174,.30)';
      ctx.font = '600 ' + Math.round(Math.min(w, h) * 0.34) + 'px "Songti SC","STSong","SimSun",serif';
      ctx.fillText(String(label || '鲜').slice(0, 1), x + w / 2, y + h / 2 - (caption ? 6 : 0));
      if (caption) {
        ctx.fillStyle = 'rgba(231,214,174,.55)'; ctx.font = '16px sans-serif';
        ctx.fillText(caption, x + w / 2, y + h - 18);
      }
      ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
    roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = 'rgba(217,189,133,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  /* 高端私宴风格邀请函：墨绿 + 烫金，谨订措辞；高度按内容动态裁剪 */
  function ornament(ctx, cx, cy, halfW) {
    ctx.strokeStyle = 'rgba(217,189,133,.62)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - halfW, cy); ctx.lineTo(cx - 16, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 16, cy); ctx.lineTo(cx + halfW, cy); ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = '#d9bd85'; ctx.strokeRect(-5, -5, 10, 10); ctx.restore();
  }
  function secTitle(ctx, W, y, text) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#c9a45c'; ctx.font = '600 26px ' + SERIF;
    ctx.fillText(text, W / 2, y + 20);
    const tw = ctx.measureText(text).width;
    ctx.strokeStyle = 'rgba(217,189,133,.38)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(140, y + 12); ctx.lineTo(W / 2 - tw / 2 - 26, y + 12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + tw / 2 + 26, y + 12); ctx.lineTo(W - 140, y + 12); ctx.stroke();
    return y + 48;
  }
  function scrimLabel(ctx, text, x, y, w, h) {
    const g = ctx.createLinearGradient(0, y + h - 86, 0, y + h);
    g.addColorStop(0, 'rgba(10,22,18,0)'); g.addColorStop(1, 'rgba(10,22,18,.78)');
    ctx.fillStyle = g; ctx.fillRect(x, y + h - 86, w, 86);
    ctx.textAlign = 'center'; ctx.fillStyle = '#f2e6c9'; ctx.font = '600 22px ' + SERIF;
    ctx.fillText(text, x + w / 2, y + h - 26);
  }
  async function buildInvitePoster(o) {
    const W = 1080, HMAX = 4800;
    const c = document.createElement('canvas'); c.width = W; c.height = HMAX;
    const ctx = c.getContext('2d');
    const shop = S.settings;
    const bg = ctx.createLinearGradient(0, 0, W, HMAX);
    bg.addColorStop(0, '#14261f'); bg.addColorStop(.5, '#1f3d33'); bg.addColorStop(1, '#0f1f1a');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, HMAX);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#d9bd85'; ctx.font = '600 24px sans-serif';
    ctx.fillText('I N V I T A T I O N', W / 2, 128);
    ctx.fillStyle = '#f2e6c9'; ctx.font = '700 74px ' + SERIF;
    ctx.fillText(shop.shopName || '长季鲜', W / 2, 218);
    ctx.fillStyle = 'rgba(231,214,174,.72)'; ctx.font = '23px sans-serif';
    ctx.fillText(shop.cuisine || '', W / 2, 260);
    ornament(ctx, W / 2, 300, 320);

    let y = 346;
    ctx.fillStyle = '#c9a45c'; ctx.font = '26px ' + SERIF;
    ctx.fillText('谨 呈', W / 2, y + 30);
    ctx.fillStyle = '#fbf8f1'; ctx.font = '600 42px ' + SERIF;
    ctx.fillText(truncate(orderName(o) || '贵客', 12) + ' 及同席亲友 台鉴', W / 2, y + 92);
    ctx.fillStyle = '#f2e6c9'; ctx.font = '600 90px ' + SERIF;
    ctx.fillText('诚 邀 赴 宴', W / 2, y + 212);
    ctx.fillStyle = '#c9a45c'; ctx.font = '28px ' + SERIF;
    ctx.fillText('敬 备 菲 酌 · 恭 候 台 光', W / 2, y + 262);
    ctx.fillStyle = '#fbf8f1'; ctx.font = '600 48px ' + SERIF;
    ctx.fillText('谨订于 ' + D.fmtDateCN(o.date) + ' ' + D.weekdayCN(o.date) + ' ' + (o.time || ''), W / 2, y + 336);
    ctx.fillStyle = 'rgba(247,243,234,.78)'; ctx.font = '27px ' + SERIF;
    ctx.fillText('席设 ' + (roomName(o.roomId) || '包厢待定') + ' · ' + (o.partySize || '') + ' 位' + (o.occasion ? ' · ' + truncate(o.occasion, 12) : ''), W / 2, y + 386);
    if (o.special) {
      ctx.fillStyle = '#e0b264'; ctx.font = '23px sans-serif';
      ctx.fillText('特殊安排 · ' + truncate(o.special, 32), W / 2, y + 424);
    }
    y += 462;
    ornament(ctx, W / 2, y, 360);
    y += 36;

    // 当日菜单
    const dishes = (o.dishes || []).map((d) => (typeof d === 'string' ? d : d.name)).filter(Boolean);
    if (dishes.length) {
      y = secTitle(ctx, W, y, '当 日 菜 单');
      ctx.textAlign = 'left';
      dishes.slice(0, 12).forEach((name, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 170 + col * 440, yy = y + 16 + row * 52;
        ctx.fillStyle = '#c9a45c'; ctx.beginPath(); ctx.arc(x - 20, yy - 9, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f7f3ea'; ctx.font = '28px ' + SERIF;
        ctx.fillText(truncate(name, 11), x, yy);
      });
      y += 16 + Math.ceil(Math.min(dishes.length, 12) / 2) * 52 + 10;
      if (dishes.length > 12) {
        ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(231,214,174,.6)'; ctx.font = '22px sans-serif';
        ctx.fillText('共 ' + dishes.length + ' 道菜 · 以到店时令为准', W / 2, y); y += 34;
      }
      y += 18; ornament(ctx, W / 2, y, 360); y += 36;
    }

    // 菜品展示：两列大图
    const classic = D.classicDishes(S, 6);
    if (classic.length) {
      y = secTitle(ctx, W, y, '菜 品 展 示');
      const imgs = await Promise.all(classic.map((d) => loadImg(photoSrc('dish', d.name))));
      const gap = 20, cw = (W - 220 - gap) / 2, ih = 250;
      classic.forEach((d, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = 110 + col * (cw + gap), yy = y + row * (ih + 96 + gap);
        drawPhotoBox(ctx, imgs[i], x, yy, cw, ih, 14, d.name.slice(0, 1), '');
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f2e6c9'; ctx.font = '600 29px ' + SERIF;
        ctx.fillText(truncate(d.name, 10), x + cw / 2, yy + ih + 40);
        ctx.fillStyle = '#c9a45c'; ctx.font = '20px sans-serif';
        ctx.fillText(d.price ? ('¥ ' + d.price + ' / 份') : truncate(d.note || '招牌必点', 12), x + cw / 2, yy + ih + 72);
      });
      y += Math.ceil(classic.length / 2) * (ih + 96 + gap);
      y += 20; ornament(ctx, W / 2, y, 360); y += 36;
    }

    // 环境展示：一宽两半
    y = secTitle(ctx, W, y, '环 境 展 示');
    const envImgs = await Promise.all([1, 2, 3].map((i) => loadImg(photoSrc('env', i))));
    const ex = 110, ew = W - 220;
    drawPhotoBox(ctx, envImgs[0], ex, y, ew, 300, 16, '厅', '');
    scrimLabel(ctx, '大厅环境', ex, y, ew, 300);
    const hw = (ew - 20) / 2;
    drawPhotoBox(ctx, envImgs[1], ex, y + 318, hw, 230, 14, '厢', '');
    scrimLabel(ctx, 'VIP 包厢', ex, y + 318, hw, 230);
    drawPhotoBox(ctx, envImgs[2], ex + hw + 20, y + 318, hw, 230, 14, '茶', '');
    scrimLabel(ctx, '茶歇卡座', ex + hw + 20, y + 318, hw, 230);
    y += 318 + 230 + 44;
    ornament(ctx, W / 2, y, 360); y += 36;

    // 专属服务经理
    const mgrName = shop.managerName || '';
    const mgrPhone = shop.managerPhone || shop.phone || '';
    const mx = 110, mw = W - 220, mh = 148;
    roundRect(ctx, mx, y, mw, mh, 18);
    ctx.fillStyle = 'rgba(251,248,241,.97)'; ctx.fill();
    ctx.strokeStyle = '#d9bd85'; ctx.lineWidth = 1.5; ctx.stroke();
    const mgrImg = await loadImg(photoSrc('manager'));
    drawPhotoBox(ctx, mgrImg, mx + 26, y + 24, 100, 100, 50, (mgrName || shop.shopName || '鲜').slice(0, 1), '');
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b8893f'; ctx.font = '17px sans-serif';
    ctx.fillText('YOUR PRIVATE MANAGER', mx + 150, y + 42);
    ctx.fillStyle = '#1f3a32'; ctx.font = '600 35px ' + SERIF;
    ctx.fillText((mgrName || shop.shopName || '长季鲜') + ' · ' + (shop.managerTitle || '包厢服务经理'), mx + 150, y + 86);
    ctx.fillStyle = '#a9721c'; ctx.font = '22px sans-serif';
    ctx.fillText(mgrPhone ? ('订座 / 服务专线：' + mgrPhone) : '全程一对一服务，预订事宜随叫随到', mx + 150, y + 124);
    y += mh + 22;

    // 店招广告位
    roundRect(ctx, mx, y, mw, 138, 18);
    ctx.fillStyle = '#0e221b'; ctx.fill();
    ctx.strokeStyle = '#c9a45c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7d6ae'; ctx.font = '700 42px ' + SERIF;
    ctx.fillText(shop.shopName || '长季鲜', W / 2, y + 54);
    ctx.fillStyle = 'rgba(231,214,174,.85)'; ctx.font = '22px sans-serif';
    ctx.fillText((shop.slogan || '时令海鲜 · 私厨家宴') + (shop.adText ? '　|　' + truncate(shop.adText, 18) : ''), W / 2, y + 90);
    ctx.fillStyle = 'rgba(231,214,174,.5)'; ctx.font = '16px sans-serif';
    ctx.fillText('店招广告位 · 可替换为门店实景 / 合作广告', W / 2, y + 118);
    y += 138 + 22;

    // 地址
    roundRect(ctx, mx, y, mw, 128, 18);
    ctx.fillStyle = 'rgba(251,248,241,.97)'; ctx.fill();
    ctx.strokeStyle = 'rgba(217,189,133,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4f4a40'; ctx.font = '26px ' + SERIF;
    const addrLines = wrapLines(ctx, shop.address || (shop.shopName + '（设置里填门店地址）'), W - 280, 2);
    addrLines.forEach((line, i) => { ctx.fillText(line, W / 2, y + 46 + i * 36); });
    ctx.fillStyle = '#8a8070'; ctx.font = '20px sans-serif';
    ctx.fillText('打开电子邀请函可一键导航（高德 / 百度）', W / 2, y + 112);
    y += 128 + 28;

    // 电子邀请函二维码（替代原回执码：扫码打开手机版邀请函，可点导航）
    const qrSize = 210;
    const qr = await makeQrCanvas(pageLink('invite.html', { d: b64e(JSON.stringify(invitePayload(o))) }), qrSize);
    if (qr) {
      roundRect(ctx, W / 2 - 125, y, 250, 250, 16);
      ctx.fillStyle = '#fffdf9'; ctx.fill(); ctx.strokeStyle = '#d9bd85'; ctx.lineWidth = 2; ctx.stroke();
      ctx.drawImage(qr, W / 2 - qrSize / 2, y + 20, qrSize, qrSize);
      y += 258;
      ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(247,243,234,.85)'; ctx.font = '21px sans-serif';
      ctx.fillText('扫码打开电子邀请函 · 手机上可一键导航', W / 2, y + 8);
      y += 40;
    } else { y += 30; }

    // 页脚
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(231,214,174,.8)'; ctx.font = '23px ' + SERIF;
    ctx.fillText((shop.phone ? '订座 ' + shop.phone + '（' + (mgrName || '陈锦长') + '）　' : '') + (shop.businessHours || ''), W / 2, y + 6);
    ctx.fillStyle = '#c9a45c'; ctx.font = '600 27px ' + SERIF;
    ctx.fillText((shop.shopName || '长季鲜') + ' · 敬约', W / 2, y + 48);
    y += 74;

    // 按内容裁剪
    const out = document.createElement('canvas'); out.width = W; out.height = Math.max(1200, Math.ceil(y));
    out.getContext('2d').drawImage(c, 0, 0);
    return out.toDataURL('image/png');
  }
  async function openInvitePoster(id) {
    const o = alive(S.orders).find((x) => x.id === id);
    if (!o) return;
    if (!o.inviteCode) {
      o.inviteCode = 'INV-' + D.uid('').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      o.inviteAt = D.nowISO(); touch(o); S.meta.rev++; saveState();
    }
    toast('正在生成微信邀请函…');
    try {
      const data = await buildInvitePoster(o);
      const safeName = String(o.customerName || '贵客').replace(/[\\/:*?"<>|]/g, '');
      const host = location.hostname || '';
      const badHost = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
      openSheet('<h3>邀请函图片</h3><p class="sheet-sub">保存后像请柬一样直接转发微信；客人扫图里的码可打开手机版，一键导航到店。</p>' +
        (badHost ? '<div class="alert-line" style="margin-bottom:10px">' + I.alert + '<div><b>当前是本地地址，图里二维码手机扫不到。</b>正式部署后重新生成，或改用局域网 IP 打开再生成。</div></div>' : '') +
        '<img src="' + data + '" alt="邀请函" style="width:100%;border-radius:12px;border:1px solid var(--line);display:block">' +
        '<div class="btn-row mt8"><a class="btn primary" download="长季鲜邀请函-' + esc(safeName) + '-' + o.date + '.png" href="' + data + '">保存图片</a><button class="btn soft" data-act="close-sheet">关闭</button></div>' +
        '<div class="hint">在微信里长按图片 → 保存图片 / 转发给朋友。亲友的忌口可以直接在微信里回复，店长在订单里备注即可。</div>');
    } catch (e) {
      toast('邀请函图片生成失败，请重试');
    }
  }
  async function shareInviteLink(link, msg) {
    if (navigator.share) {
      try {
        await navigator.share({ title: (S.settings.shopName || '长季鲜') + ' 邀请函', text: msg, url: link });
        return;
      } catch (e) { }
    }
    copyText(msg);
  }
  function openInviteSheet(id) {
    if (!can('invite')) { toast('邀请函由老板 / 店长发送'); return; }
    const o = alive(S.orders).find((x) => x.id === id); if (!o) return;
    if (orderFlow(o) !== 'confirmed') {
      confirmSheet('菜单还没确认', '客户还没确认菜品。现在发邀请函，之后改菜要重发一份。仍要生成吗？', '继续生成', () => doOpenInvite(o));
      return;
    }
    doOpenInvite(o);
  }
  function doOpenInvite(o) {
    if (!o.inviteCode) {
      o.inviteCode = 'INV-' + D.uid('').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      o.inviteAt = D.nowISO(); touch(o); S.meta.rev++;
      saveState();
    }
    const link = pageLink('invite.html', { d: b64e(JSON.stringify(invitePayload(o))) });
    const s = S.settings;
    const L = [];
    L.push('【' + (s.shopName || '长季鲜') + ' · 邀请函】');
    L.push((orderName(o) || '您好') + '，谨订于 ' + D.fmtDateCN(o.date) + ' ' + D.weekdayCN(o.date) + ' ' + (o.time || '') + '，在 ' + (s.shopName || '长季鲜') + ' ' + (roomName(o.roomId) || '') + ' 敬备菲酌，恭候台光。');
    if (s.address) L.push('地址：' + s.address + '（高德 / 百度地图搜「' + (s.shopName || '长季鲜') + '」可导航）');
    if (s.managerPhone) L.push('订座：' + s.managerPhone + (s.managerName ? '（' + s.managerName + '）' : ''));
    L.push('电子邀请函（手机打开可一键导航）：');
    L.push(link);
    L.push('欢迎转发给同席亲友。');
    const msg = L.join('\n');
    openSheet('<h3>预定邀请函</h3><p class="sheet-sub">最推荐发图片版：像一张请柬，微信里直接转发；链接版手机打开可一键导航。</p>' +
      '<button class="btn primary block mt8" data-act="invite-poster">' + I.share + ' 生成邀请函图片（微信直接转发）</button>' +
      '<div class="hint" style="margin:8px 0 12px">点「保存图片」后，在微信里长按图片 → 转发给朋友，客人不用点任何链接。</div>' +
      '<button class="btn gold block" data-act="share-invite" data-link="' + esc(link) + '" data-msg="' + esc(msg) + '">' + I.share + ' 转发链接版（手机上弹出微信）</button>' +
      '<div class="btn-row mt8"><button class="btn soft" data-act="preview-invite" data-link="' + esc(link) + '">预览链接版</button><button class="btn soft" data-act="copy-invite-msg" data-msg="' + esc(msg) + '">复制邀请文案</button></div>' +
      '<button class="btn ghost block mt8" data-act="copy-invite" data-link="' + esc(link) + '">复制链接</button>' +
      '<button class="btn ghost block mt8" data-act="close-sheet">关闭</button>' +
      '<div class="share-link" id="inviteLinkText" style="position:absolute;left:-9999px;top:0">' + esc(link) + '</div>');
  }
  function buildMenuPayload() {
    const sync = (window.CJXSync && window.CJXSync.isAuthed()) ? window.CJXSync.getConfig() : null;
    // 云端模式只带同步配置，菜单页实时读取，链接短；本地模式把菜单快照塞进链接
    // 本地模式用短字段名（n/c/p/s/l/e），链接能短一半以上，微信里更不容易被截断
    const dishes = sync ? [] : alive(S.dishes).map((d) => {
      const it = { n: d.name, c: d.category || '', p: Number(d.price) || 0 };
      if (d.status && d.status !== 'on') it.s = d.status;
      if (d.leadDays) it.l = d.leadDays;
      if (d.note) it.e = d.note;
      return it;
    });
    return {
      v: 2, t: 'menu',
      shop: { n: S.settings.shopName, c: S.settings.cuisine, h: S.settings.businessHours, p: S.settings.phone },
      dishes: dishes, updatedAt: D.nowISO(),
      sync: sync ? { url: sync.url, anonKey: sync.anonKey } : null
    };
  }
  function roleEntryUrl(role) {
    try {
      // 用当前地址克隆，保留 sharecode（托管平台的访问凭证），只换 role
      const u = new URL(location.href);
      u.hash = '';
      ['reset', 'demo', 'd', 'role'].forEach((k) => u.searchParams.delete(k));
      u.searchParams.set('role', role);
      const sc = shareCode();
      if (sc) u.searchParams.set('sharecode', sc);
      return u.href;
    } catch (e) {
      return 'index.html?role=' + role;
    }
  }
  const ROLE_PERMS_TEXT = {
    boss: ['接单 · 审核 · 改菜单', 'AI 配菜 · 自动排包厢', '发客户 · 邀请函', '菜价只看，改价找店长'],
    manager: ['上下架 · 改菜 · 改菜价', 'AI 配菜 · 自动排包厢', '备货单 · 审核 · 邀请函'],
    kitchen: ['只看时令菜，不可修改', '看当日备货单', '看每桌点了什么'],
    service: ['接待看板 · 包厢开台准备', '碗碟 / 酒壶 / 水 / 饮料勾选', '只看菜单，不可修改']
  };
  function saveRoleQr(role) {
    const el = document.getElementById('qr_' + role);
    const cv = el && el.querySelector('canvas');
    if (!cv) { toast('二维码还没生成好，稍等一秒再点'); return; }
    const W = 600, H = 760;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d');
    g.fillStyle = '#fffdf9'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#e8dfcf'; g.lineWidth = 4; g.strokeRect(12, 12, W - 24, H - 24);
    g.textAlign = 'center';
    g.fillStyle = '#1f3a32'; g.font = '600 40px "Songti SC","STSong","SimSun",serif';
    g.fillText(S.settings.shopName || '长季鲜', W / 2, 74);
    g.fillStyle = '#8a8070'; g.font = '24px sans-serif';
    g.fillText(ROLES[role].name + ' · 扫码进入', W / 2, 116);
    g.drawImage(cv, 60, 142, 480, 480);
    g.fillStyle = '#8a8070'; g.font = '19px sans-serif';
    g.fillText('用手机相机 / 微信扫码', W / 2, 668);
    const shownUrl = roleEntryUrl(role).replace(/^https?:\/\//, '').split('?')[0] + '?role=' + role;
    g.fillText(shownUrl.slice(0, 44), W / 2, 702);
    const a = document.createElement('a');
    a.download = (S.settings.shopName || '长季鲜') + '-' + ROLES[role].name + '-入口.png';
    a.href = out.toDataURL('image/png');
    a.click();
    toast('二维码已保存到相册/下载');
  }
  function openRoleQrSheet() {
    if (!can('roleQr')) { toast('角色入口二维码由老板 / 店长生成'); return; }
    const host = location.hostname || '';
    const badHost = location.protocol === 'file:' || host === 'localhost' || host === '127.0.0.1';
    const cards = Object.keys(ROLES).map((r) => {
      const pin = (S.settings.pins || {})[r];
      const url = roleEntryUrl(r);
      return '<div class="qr-card"><div class="qr-box" id="qr_' + r + '"></div><h4>' + ROLES[r].name + '</h4>' +
        '<p>' + (pin ? '已设密码' : '未设密码') + '</p>' +
        '<div class="perm-lines">' + ROLE_PERMS_TEXT[r].map((t) => '<span>' + esc(t) + '</span>').join('') + '</div>' +
        '<div class="btn-row" style="gap:6px;margin-top:8px"><button class="btn xs soft grow" data-act="copy-role-link" data-url="' + esc(url) + '">复制链接</button><button class="btn xs soft grow" data-act="save-role-qr" data-role="' + r + '">保存图片</button></div></div>';
    }).join('');
    openSheet('<h3>角色入口二维码</h3><p class="sheet-sub">4 个角色 4 张码，各进各的权限。老板 / 店长可改菜单，后厨与服务员只读。</p>' +
      (badHost ? '<div class="alert-line" style="margin-bottom:10px">' + I.alert + '<div><b>当前地址手机扫不到。</b>请先部署到线上，或用电脑局域网 IP 打开本应用后再生成二维码。</div></div>' : '') +
      '<div class="qr-grid">' + cards + '</div>' +
      '<div class="perm-table"><div class="pt-head"><span>权限</span><span>老板</span><span>店长</span><span>后厨</span><span>服务员</span></div>' +
        [['修改菜单', 1, 1, 0, 0], ['上下架时令菜', 1, 1, 0, 0], ['修改菜价', 0, 1, 0, 0], ['AI 配菜 + 排包厢', 1, 1, 0, 0], ['备货单', 1, 1, 1, 0], ['开台准备勾选', 1, 1, 0, 1], ['邀请函 / 发客户', 1, 1, 0, 0]].map((row) =>
          '<div class="pt-row"><span>' + row[0] + '</span>' + row.slice(1).map((v) => '<span class="' + (v ? 'yes' : 'no') + '">' + (v ? '✓' : '—') + '</span>').join('') + '</div>').join('') +
      '</div>' +
      '<div class="hint">这是角色入口，不是实名认证。谁拿到链接都能进对应角色；老板 / 店长建议在设置里设 4 位密码。店员扫码后建议在微信里收藏，下次直接打开。</div>' +
      '<button class="btn ghost block mt8" data-act="close-sheet">关闭</button>');
    if (typeof QRCode === 'undefined') {
      document.querySelectorAll('.qr-box').forEach((el) => { el.innerHTML = '<span class="tiny muted">二维码库未加载</span>'; });
      return;
    }
    Object.keys(ROLES).forEach((r) => {
      const el = document.getElementById('qr_' + r);
      if (!el) return;
      try {
        new QRCode(el, { text: roleEntryUrl(r), width: 140, height: 140, colorDark: '#1f3a32', colorLight: '#fffdf9', correctLevel: QRCode.CorrectLevel.M });
      } catch (e) { el.innerHTML = '<span class="tiny muted">生成失败</span>'; }
    });
  }
  function openMenuShareSheet() {
    const link = pageLink('menu.html', { d: b64e(JSON.stringify(buildMenuPayload())) });
    const longLink = link.length > 3000;
    openSheet('<h3>时令菜单链接</h3><p class="sheet-sub">发给熟客，客人自己看在售、需预订和下市，不用老板反复传话。</p>' +
      '<div class="share-link">' + esc(link) + '</div><div class="btn-row mt8"><button class="btn primary" data-act="copy-menu-link" data-link="' + esc(link) + '">复制链接</button><button class="btn soft" data-act="copy-menu-text">复制文字版</button></div>' +
      '<button class="btn ghost block mt8" data-act="close-sheet">关闭</button>' +
      (longLink ? '<div class="alert-line" style="margin-top:10px">' + I.alert + '<div><b>本地模式链接较长（' + Math.round(link.length / 1024) + 'KB）。</b>微信里发长链接偶尔会被截断，重要客人建议先发「复制文字版」，或把应用部署到线上用云端模式（链接只有几百字符）。</div></div>' : '') +
      '<div class="hint">链接里只有菜名、价格和状态，不含任何客人信息。' + (syncReady() ? '云端模式下菜单页会实时读取最新菜品。' : '本地模式下是生成时的快照，菜品变动后重新生成一次。') + '</div>');
  }
  function menuText() {
    const on = alive(S.dishes).filter((d) => d.status === 'on');
    const pre = alive(S.dishes).filter((d) => d.status === 'preorder');
    return S.settings.shopName + ' · ' + (S.settings.cuisine || '') + ' 时令菜单\n\n【在售】\n' + on.map((d) => '· ' + d.name + ' ' + D.money(d.price)).join('\n') + '\n\n【需提前预订】\n' + pre.map((d) => '· ' + d.name + ' ' + D.money(d.price) + '（提前' + d.leadDays + '天）').join('\n') + '\n\n订座请联系：' + (S.settings.phone || '长季鲜');
  }
  function openRsvpSheet(id) {
    openSheet('<h3>录入亲友回执</h3><p class="sheet-sub">把亲友发来的回执码整段粘进来；没有云端时用这个方式回写。</p>' +
      '<div class="field"><textarea id="rsvpCode" placeholder="CJXRSVP1:..."></textarea></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn primary" data-act="save-rsvp" data-id="' + id + '">录入</button></div>');
  }
  function saveRsvpCode(orderId) {
    const raw = (($('#rsvpCode') || {}).value || '').trim();
    if (!raw) { toast('请先粘贴回执码'); return; }
    try {
      const payload = JSON.parse(b64d(raw.replace(/^CJXRSVP1:/, '')));
      const r = {
        id: payload.id || D.uid('rs_'), orderId, inviteCode: payload.inviteCode || '', guestName: payload.name || payload.guestName || '亲友',
        phone: payload.phone || '', attend: payload.attend !== false, dietary: payload.dietary || [], partySize: payload.partySize || 1,
        submittedAt: payload.submittedAt || D.nowISO(), source: payload.source || 'code', _dirty: true
      };
      if (!S.rsvps.some((x) => x.id === r.id)) S.rsvps.push(r);
      attachRsvps(); S.meta.rev++;
      saveState(); closeSheet(); render({ scroll: false }); toast('回执已录入');
    } catch (e) { toast('回执码识别失败，请确认复制完整'); }
  }

  /* ---------- 复制订单 / 备份 / 恢复 ---------- */
  function orderText(o) {
    const total = D.orderTotal(o);
    return S.settings.shopName + ' · 预定单\n' + o.code + '\n' + D.fmtDateCN(o.date) + ' ' + D.weekdayCN(o.date) + ' ' + o.time + ' · ' + (roomName(o.roomId) || '包厢待定') + '\n' +
      (o.customerName || '未称呼') + ' · ' + (o.partySize || '?') + ' 位' + (o.occasion ? ' · ' + o.occasion : '') + '\n' +
      (o.phone ? '电话：' + o.phone + '\n' : '') + (o.wechat ? '微信：' + o.wechat + '\n' : '') +
      (o.budget ? '餐标：' + D.money(o.budget) + (o.budgetMode === 'person' ? '/位' : '/桌') + '\n' : '') +
      '菜品：' + ((o.dishes || []).map((d) => d.name || d).join('、') || '未点') + (total ? '（' + D.money(total) + '）' : '') + '\n' +
      '忌口：' + ((o.dietary || []).join('、') || '无') + '\n' +
      ((o.tasteHints || []).length ? '口味：' + o.tasteHints.join('、') + '\n' : '') +
      (o.special ? '特殊：' + o.special + '\n' : '') +
      (o.notes ? '备注：' + o.notes + '\n' : '') +
      '状态：' + (STATUS[o.status] || {}).label;
  }
  function exportData() {
    const data = { app: 'changji-xian', version: D.APP_VERSION, exportedAt: D.nowISO(), state: S };
    download('长季鲜备份-' + D.todayStr() + '-' + new Date().toTimeString().slice(0, 5).replace(':', '') + '.json', JSON.stringify(data, null, 2), 'application/json');
    toast('备份已导出');
  }
  function importDataFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const st = data.state || data;
        if (!st || !st.orders) throw new Error('不是长季鲜备份文件');
        confirmSheet('导入备份？', '会覆盖这台设备当前的 ' + alive(S.orders).length + ' 张订单和 ' + alive(S.customers).length + ' 位熟客。', '确认导入', () => {
          S = migrate(st); S.meta.rev++; S.meta.updatedAt = D.nowISO();
          saveState({ noPush: true, snap: true }); closeSheet(); render(); toast('备份已导入');
        });
      } catch (e) { toast('导入失败：' + e.message); }
    };
    reader.readAsText(file);
  }
  function importDishFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const arr = Array.isArray(data) ? data : (data.dishes || []);
        if (!arr.length) throw new Error('没有找到菜品数组');
        const dishes = arr.map((x, i) => ({ id: x.id || ('d' + String(i + 1).padStart(2, '0')), name: x.name, category: x.category || '热菜', price: Number(x.price) || 0, status: x.status || 'on', leadDays: Number(x.leadDays) || 0, tags: x.tags || [], flavor: x.flavor || [], note: x.note || '', updatedAt: D.nowISO(), deleted: false, _dirty: true }));
        if (dishes.some((d) => !d.name)) throw new Error('有菜品缺少 name');
        confirmSheet('导入新菜系？', '会替换现有 ' + alive(S.dishes).length + ' 道菜为 ' + dishes.length + ' 道。历史订单里的菜名和价格不会变。', '确认替换', () => {
          S.dishes = dishes; S.meta.rev++; saveState(); closeSheet(); render(); toast('菜系已导入');
        });
      } catch (e) { toast('导入失败：' + e.message); }
    };
    reader.readAsText(file);
  }
  function restoreSnapshotSheet() {
    const snaps = snapshots();
    if (!snaps.length) { toast('还没有快照'); return; }
    openSheet('<h3>恢复快照</h3><p class="sheet-sub">系统在每次保存时自动留一份，最多 10 份。</p>' +
      snaps.slice().reverse().map((s, i) => '<button class="list-row" style="border:1px solid var(--line);border-radius:10px;margin-bottom:8px" data-act="restore-snap-ok" data-idx="' + (snaps.length - 1 - i) + '"><div class="lr-ico">' + I.refresh + '</div><div class="lr-main"><div class="lr-title">' + esc(String(s.at).replace('T', ' ').slice(0, 16)) + '</div><div class="lr-sub">rev ' + s.rev + ' · ' + (s.state && s.state.orders ? s.state.orders.length : 0) + ' 张订单</div></div>' + I.arrow + '</button>').join('') +
      '<button class="btn ghost block" data-act="close-sheet">取消</button>');
  }

  /* ---------- 导航 ---------- */
  function go(view, params, push) {
    if (push === undefined) push = true;
    if (push && ui.view) ui.stack.push({ view: ui.view, params: ui.params });
    ui.view = view; ui.params = params || {};
    window.scrollTo(0, 0);
    render();
  }
  function goTab(view) {
    ui.stack = [];
    ui.view = view; ui.params = {};
    render();
  }
  function back() {
    const prev = ui.stack.pop();
    if (prev) { ui.view = prev.view; ui.params = prev.params || {}; }
    else { ui.view = TABS[session.role][0][0]; ui.params = {}; }
    render();
  }

  /* ---------- 事件 ---------- */
  function handleAction(el) {
    const act = el.dataset.act;
    const id = el.dataset.id;
    switch (act) {
      case 'load-demo': loadDemoScript().then(function () {
        seedDemo(S); S.meta.onboarded = true;
        saveState({ noPush: true, snap: true });
        ui.view = 'gate'; render(); toast('示例数据已载入，选择角色体验');
      }).catch(function () { toast('示例数据没加载成功，请连网后重试'); }); break;
      case 'start-blank': S.meta.onboarded = true; S.orders = []; S.customers = []; S.rsvps = []; S.rooms = D.defaultRooms(); S.dishes = D.defaultDishes(); saveState({ noPush: true, snap: true }); ui.view = 'gate'; render(); break;
      case 'pick-role': requestRole(el.dataset.role); break;
      case 'pin-ok': {
        const role = el.dataset.role; const v = (($('#pinInput') || {}).value || '').trim();
        if (v === ((S.settings.pins || {})[role] || '')) { closeSheet(); enterRole(role); }
        else toast('密码不对');
        break;
      }
      case 'switch-role': session = null; localStorage.removeItem(LS_SESSION); ui.view = 'gate'; ui.stack = []; render(); break;
      case 'tab': goTab(el.dataset.tab); break;
      case 'back': back(); break;
      case 'go': go(el.dataset.view); break;
      case 'go-orders': ui.orderFilter = el.dataset.filter || 'today'; ui.stack = []; ui.view = 'orders'; render(); break;
      case 'go-dishes': goTab('dishes'); break;
      case 'go-prep': goTab('prep'); break;
      case 'go-calendar': ui.calDate = el.dataset.date || D.todayStr(); goTab('calendar'); break;
      case 'new-order': {
        const prefill = {};
        if (el.dataset.date) prefill.date = el.dataset.date;
        if (el.dataset.room) prefill.roomId = el.dataset.room;
        if (ui.view === 'calendar' && el.dataset.date === undefined) prefill.date = ui.calDate;
        startNewOrder(prefill); break;
      }
      case 'import-order': startNewOrder(); setTimeout(() => { const t = $('#chatInput'); if (t) t.focus(); }, 300); break;
      case 'open-order': go('orderDetail', { orderId: id }); break;
      case 'edit-order': editOrder(ui.params.orderId); break;
      case 'confirm-order': doConfirmOrder(ui.params.orderId); break;
      case 'notify-order': doNotifyOrder(ui.params.orderId); break;
      case 'complete-order': doCompleteOrder(ui.params.orderId); break;
      case 'cancel-order': doCancelOrder(ui.params.orderId); break;
      case 'cancel-order-confirm': {
        const o = alive(S.orders).find((x) => x.id === id); if (!o) break;
        o.status = 'cancelled'; o.audit = o.audit || {}; o.audit.cancelledAt = D.nowISO(); o.audit.cancelReason = (($('#cancelReason') || {}).value || '').trim();
        addLog(o, '取消预定' + (o.audit.cancelReason ? '：' + o.audit.cancelReason : '')); touch(o); S.meta.rev++;
        saveState({ snap: true }); closeSheet(); render({ scroll: false }); toast('订单已取消'); break;
      }
      case 'delete-order': {
        const o = alive(S.orders).find((x) => x.id === ui.params.orderId); if (!o) break;
        confirmSheet('删除这张订单？', '删除后不会出现在台账里，建议优先用「取消」。', '确认删除', () => { o.deleted = true; touch(o); S.meta.rev++; saveState({ snap: true }); closeSheet(); ui.stack = [{ view: 'orders', params: {} }]; go('orders'); toast('已删除'); }, true); break;
      }
      case 'duplicate-order': {
        const o = alive(S.orders).find((x) => x.id === ui.params.orderId); if (!o) break;
        startNewOrder({ date: D.todayStr(), time: o.time, partySize: o.partySize, roomId: o.roomId, customerName: o.customerName, phone: o.phone, wechat: o.wechat, occasion: o.occasion, dishes: JSON.parse(JSON.stringify(o.dishes || [])), dietary: (o.dietary || []).slice(), special: o.special, budget: o.budget, budgetMode: o.budgetMode, notes: o.notes }); break;
      }
      case 'copy-order': copyText(orderText(selectedOrder())); break;
      case 'parse-chat': { const t = (($('#chatInput') || {}).value || '').trim(); if (!t) { toast('先把聊天记录粘进来'); break; } if (t.trim().charAt(0) === '{') parseJsonIntoForm(t); else parseChatIntoForm(t); break; }
      case 'paste-json': { const t = (($('#chatInput') || {}).value || '').trim(); if (t.indexOf('{') >= 0) parseJsonIntoForm(t); else { openSheet('<h3>粘贴 AI 订单 JSON</h3><p class="sheet-sub">把 AI 整理好的 JSON 粘进来。</p><div class="field"><textarea id="jsonInput" placeholder="{&quot;date&quot;:&quot;2026-11-02&quot;,&quot;time&quot;:&quot;18:30&quot;,...}"></textarea></div><div class="btn-row"><button class="btn ghost" data-act="close-sheet">取消</button><button class="btn primary" data-act="json-ok">填入</button></div>'); } break; }
      case 'json-ok': { const t = (($('#jsonInput') || {}).value || '').trim(); closeSheet(); if (t) parseJsonIntoForm(t); break; }
      case 'toggle-dish': {
        const f = ui.form; if (!f) break;
        const dsh = alive(S.dishes).find((x) => x.id === id); if (!dsh || dsh.status === 'off') break;
        const arr = f.data.dishes || (f.data.dishes = []);
        const idx = arr.findIndex((x) => (x.name || x) === dsh.name);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push({ id: dsh.id, name: dsh.name, price: dsh.price, category: dsh.category, status: dsh.status, leadDays: dsh.leadDays, flavor: dsh.flavor || [] });
        el.classList.toggle('on');
        refreshFormSummary();
        break;
      }
      case 'toggle-diet': {
        const f = ui.form; if (!f) break;
        const val = el.dataset.value;
        let arr = f.data.dietary || (f.data.dietary = []);
        if (val === '无忌口') { arr = []; f.data.dietary = arr; f.data.dietaryConfirmed = true; }
        else {
          const i = arr.indexOf(val);
          if (i >= 0) arr.splice(i, 1); else { arr = arr.filter((x) => x !== '无忌口'); arr.push(val); }
          f.data.dietary = arr; f.data.dietaryConfirmed = true;
        }
        document.querySelectorAll('[data-act="toggle-diet"]').forEach((b) => {
          const v = b.dataset.value;
          b.classList.toggle('on', v === '无忌口' ? (f.data.dietary || []).length === 0 : (f.data.dietary || []).includes(v));
          if (v !== '无忌口') b.classList.toggle('red', b.classList.contains('on'));
        });
        refreshFormSummary();
        break;
      }
      case 'toggle-service-check': {
        const o = alive(S.orders).find((x) => x.id === el.dataset.id);
        if (!o) break;
        if (!['service', 'boss', 'manager'].includes(session.role)) { toast('只有服务员、店长或老板可以勾选'); break; }
        const key = el.dataset.key;
        const item = SERVICE_CHECKS.find((k) => k.key === key);
        if (!item) break;
        o.serviceChecks = Object.assign({ tableware: false, pitcher: false, water: false, drink: false }, o.serviceChecks || {});
        o.serviceChecks[key] = !o.serviceChecks[key];
        addLog(o, '开台准备：' + item.label + (o.serviceChecks[key] ? ' 已备好' : ' 取消'));
        touch(o); S.meta.rev++; saveState(); render({ scroll: false });
        toast(item.label + (o.serviceChecks[key] ? ' 已备好' : ' 已取消'));
        break;
      }
      case 'toggle-taste': {
        const f = ui.form; if (!f) break;
        const val = el.dataset.value;
        const arr = f.data.tasteHints || (f.data.tasteHints = []);
        const i = arr.indexOf(val);
        if (i >= 0) arr.splice(i, 1); else arr.push(val);
        el.classList.toggle('on', arr.includes(val));
        el.classList.toggle('gold', arr.includes(val));
        break;
      }
      case 'customer-menu': {
        const f = ui.form; if (!f) break;
        const c = D.findCustomer(S, { phone: f.data.phone, name: f.data.customerName, wechat: f.data.wechat });
        if (!c || !c.budgetPref) { toast('这位熟客还没有记住的餐标，先填餐标'); break; }
        f.data.budget = c.budgetPref;
        f.data.budgetMode = c.budgetMode || 'table';
        f.data.tasteHints = Array.from(new Set([].concat(f.data.tasteHints || [], c.tasteTags || [])));
        const bi = document.querySelector('[data-ff="budget"]');
        if (bi) bi.value = c.budgetPref;
        document.querySelectorAll('[data-act="budget-mode"]').forEach((b) => b.classList.toggle('on', b.dataset.mode === f.data.budgetMode));
        document.querySelectorAll('[data-act="toggle-taste"]').forEach((b) => {
          const on = f.data.tasteHints.includes(b.dataset.value);
          b.classList.toggle('on', on); b.classList.toggle('gold', on);
        });
        openMenuPlanner();
        break;
      }
      case 'toggle-special': {
        const f = ui.form; if (!f) break;
        const val = el.dataset.value;
        let s = f.data.special || '';
        if (s.indexOf(val) >= 0) s = s.replace(new RegExp('(^|、)' + val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=、|$)', ''), '').replace(/^、|、$/g, '');
        else s = s ? s + '、' + val : val;
        f.data.special = s;
        const ta = document.querySelector('[data-ff="special"]'); if (ta) ta.value = s;
        el.classList.toggle('on');
        refreshFormSummary();
        break;
      }
      case 'pick-occasion': {
        const f = ui.form; if (!f) break;
        const v = el.dataset.value;
        f.data.occasion = f.data.occasion === v ? '' : v;
        document.querySelectorAll('[data-act="pick-occasion"]').forEach((b) => b.classList.toggle('on', b.dataset.value === f.data.occasion));
        break;
      }
      case 'budget-mode': {
        const f = ui.form; if (!f) break;
        f.data.budgetMode = el.dataset.mode;
        document.querySelectorAll('[data-act="budget-mode"]').forEach((b) => b.classList.toggle('on', b.dataset.mode === f.data.budgetMode));
        break;
      }
      case 'confirm-field': {
        const f = ui.form; if (!f) break;
        f.data[el.dataset.key] = true;
        refreshFormSummary();
        toast('已记录');
        break;
      }
      case 'apply-customer': {
        const f = ui.form; if (!f) break;
        const c = D.findCustomer(S, { phone: f.data.phone, name: f.data.customerName, wechat: f.data.wechat });
        if (!c) { toast('还没匹配到熟客'); break; }
        const mode = el.dataset.mode;
        if (mode === 'diet' || mode === 'all') { f.data.dietary = Array.from(new Set([].concat(f.data.dietary || [], c.dietary || []))); f.data.dietaryConfirmed = true; }
        if (mode === 'fav' || mode === 'all') {
          const names = customerFavs(c).map((x) => x.name);
          const objs = D.dishObjs(S, names);
          const have = new Set((f.data.dishes || []).map((x) => x.name || x));
          objs.forEach((x) => { if (!have.has(x.name)) f.data.dishes.push(x); });
        }
        if (mode === 'budget' && c.budgetPref) { f.data.budget = c.budgetPref; f.data.budgetMode = c.budgetMode || 'table'; }
        render({ scroll: false }); toast('已带入熟客信息');
        break;
      }
      case 'gen-menu': closeSheet(); openMenuPlanner(ui.menuTarget === 'order' ? 'order' : 'form'); break;
      case 'ai-menu': openMenuPlanner('order'); break;
      case 'adopt-menu': adoptMenu(el.dataset.key); break;
      case 'flow-manager': {
        const o = alive(S.orders).find((x) => x.id === ui.params.orderId); if (!o) break;
        openForwardSheet(o, 'manager', '转给店长配菜', '复制这段话发给店长，订单会自动进入店长的「待我配菜」。', handoffText(o));
        break;
      }
      case 'flow-boss': {
        const o = alive(S.orders).find((x) => x.id === ui.params.orderId); if (!o) break;
        if (!(o.dishes || []).length) { toast('还没有菜单，先 AI 配菜'); break; }
        openForwardSheet(o, 'boss', '菜单发给老板确认', '老板看完没问题，再转发给客户确认。', menuTextForBoss(o));
        break;
      }
      case 'flow-customer': {
        const o = alive(S.orders).find((x) => x.id === ui.params.orderId); if (!o) break;
        if (!(o.dishes || []).length) { toast('还没有菜单，先 AI 配菜'); break; }
        openForwardSheet(o, 'customer', '菜单发给客户确认', '客户看完回复「可以」或提出改菜，再点「客户已确认」。', menuTextForCustomer(o));
        break;
      }
      case 'copy-forward': {
        const o = alive(S.orders).find((x) => x.id === el.dataset.id); if (!o) break;
        copyText(el.dataset.text || '');
        setFlow(o, el.dataset.stage || 'manager');
        S.meta.rev++;
        saveState({ snap: true });
        closeSheet(); render({ scroll: false });
        toast('已复制，流程已前进一步');
        break;
      }
      case 'flow-confirm': {
        const o = alive(S.orders).find((x) => x.id === ui.params.orderId); if (!o) break;
        confirmSheet('客户已确认菜单？', '确认后流程走到「已确认」，就可以生成邀请函发给客户了。', '确认已确认', () => {
          o.menuConfirmed = true;
          o.menuConfirmedAt = D.nowISO();
          setFlow(o, 'confirmed');
          S.meta.rev++;
          saveState({ snap: true });
          closeSheet(); render({ scroll: false });
          toast('已确认，可以发邀请函了');
        });
        break;
      }
      case 'save-role-qr': saveRoleQr(el.dataset.role); break;
      case 'copy-prep-one': {
        const o = alive(S.orders).find((x) => x.id === el.dataset.id); if (!o) break;
        copyText(servicePrepText(o));
        break;
      }
      case 'copy-board-prep': {
        const date = ui.boardDate || D.todayStr();
        const list = alive(S.orders).filter((o) => o.date === date && ['confirmed', 'notified'].includes(o.status)).sort((a, b) => a.time.localeCompare(b.time));
        if (!list.length) { toast('这一天没有已确认的预定'); break; }
        copyText(S.settings.shopName + ' · ' + D.fmtDateCN(date) + ' 开台准备\n\n' + list.map((o) => servicePrepText(o, true)).join('\n\n'));
        break;
      }
      case 'save-order': saveOrderForm(); break;
      case 'cancel-form': ui.form = null; back(); break;
      case 'open-invite': openInviteSheet(ui.params.orderId); break;
      case 'invite-poster': openInvitePoster(ui.params.orderId); break;
      case 'preview-invite': window.open(el.dataset.link, '_blank'); break;
      case 'share-invite': shareInviteLink(el.dataset.link, el.dataset.msg); break;
      case 'copy-invite': copyText(el.dataset.link); break;
      case 'copy-invite-msg': copyText(el.dataset.msg); break;
      case 'copy-menu-link': copyText(el.dataset.link); break;
      case 'import-rsvp': openRsvpSheet(ui.params.orderId); break;
      case 'save-rsvp': saveRsvpCode(el.dataset.id); break;
      case 'refresh-rsvp': syncPull(true); break;
      case 'cal-prev': ui.calDate = D.addDays(ui.calDate, -1); render({ scroll: false }); break;
      case 'cal-next': ui.calDate = D.addDays(ui.calDate, 1); render({ scroll: false }); break;
      case 'cal-today': ui.calDate = D.todayStr(); render({ scroll: false }); break;
      case 'order-filter': ui.orderFilter = el.dataset.filter; render({ scroll: false }); break;
      case 'ledger-filter': ui.ledgerFilter = el.dataset.filter; render({ scroll: false }); break;
      case 'open-customer': go('customerDetail', { custId: id }); break;
      case 'new-for-customer': { const c = alive(S.customers).find((x) => x.id === id); if (c) startNewOrder({ customer: c }); break; }
      case 'edit-customer': openCustomerSheet(alive(S.customers).find((x) => x.id === el.dataset.id)); break;
      case 'add-customer': openCustomerSheet(null); break;
      case 'save-customer': saveCustomer(el.dataset.id); break;
      case 'set-dish-status': setDishStatus(el.dataset.id, el.dataset.status); break;
      case 'add-dish': openDishSheet(null); break;
      case 'edit-dish': openDishSheet(alive(S.dishes).find((x) => x.id === el.dataset.id)); break;
      case 'save-dish': saveDish(el.dataset.id); break;
      case 'share-menu': openMenuShareSheet(); break;
      case 'copy-menu-text': copyText(menuText()); break;
      case 'role-qr': openRoleQrSheet(); break;
      case 'copy-role-link': copyText(el.dataset.url); break;
      case 'prep-prev': ui.prepDate = D.addDays(ui.prepDate, -1); render({ scroll: false }); break;
      case 'prep-next': ui.prepDate = D.addDays(ui.prepDate, 1); render({ scroll: false }); break;
      case 'copy-prep': copyText(prepText(ui.prepDate)); break;
      case 'export-prep': exportPrepCsv(ui.prepDate); break;
      case 'print-prep': window.print(); break;
      case 'board-date': ui.boardDate = el.dataset.date; render({ scroll: false }); break;
      case 'refresh-now': syncPull(true); if (!syncReady()) { render({ scroll: false }); toast('已刷新'); } break;
      case 'settings': go('settings'); break;
      case 'help': openHelpSheet(); break;
      case 'save-shop': {
        S.settings.shopName = (($('#setShopName') || {}).value || '').trim() || '长季鲜';
        S.settings.cuisine = (($('#setCuisine') || {}).value || '').trim();
        S.settings.businessHours = (($('#setHours') || {}).value || '').trim();
        S.settings.address = (($('#setAddress') || {}).value || '').trim();
        S.settings.phone = (($('#setPhone') || {}).value || '').trim();
        S.settings.slogan = (($('#setSlogan') || {}).value || '').trim();
        S.settings.adText = (($('#setAdText') || {}).value || '').trim();
        S.settings.managerName = (($('#setManagerName') || {}).value || '').trim();
        S.settings.managerPhone = (($('#setManagerPhone') || {}).value || '').trim();
        S.settings.lat = (($('#setLat') || {}).value || '').trim();
        S.settings.lng = (($('#setLng') || {}).value || '').trim();
        touchSettings(); S.meta.rev++; saveState({ snap: true }); render({ scroll: false }); toast('门店信息已保存');
        break;
      }
      case 'save-rooms': {
        alive(S.rooms).forEach((r) => {
          const n = $('#roomName_' + r.id); const mn = $('#roomMin_' + r.id); const mx = $('#roomMax_' + r.id); const e = $('#roomOn_' + r.id);
          if (n) r.name = n.value.trim() || r.name;
          if (mx) r.maxSeats = Math.max(1, Number(mx.value) || r.maxSeats || r.seats || 10);
          if (mn) r.minSeats = Math.max(1, Number(mn.value) || r.minSeats || 1);
          if (r.minSeats && r.maxSeats && r.minSeats > r.maxSeats) { const t = r.minSeats; r.minSeats = r.maxSeats; r.maxSeats = t; }
          r.seats = r.maxSeats || r.seats;
          if (e) r.enabled = e.checked;
          touch(r);
        });
        S.meta.rev++; saveState({ snap: true }); render({ scroll: false }); toast('包厢已保存');
        break;
      }
      case 'add-room': {
        if (alive(S.rooms).length >= 6) { toast('最多 6 个包厢'); break; }
        S.rooms.push({ id: D.uid('r_'), name: 'VIP' + (alive(S.rooms).length + 1), minSeats: 10, maxSeats: 12, seats: 12, sort: alive(S.rooms).length + 1, enabled: true, note: '', updatedAt: D.nowISO(), deleted: false, _dirty: true });
        S.meta.rev++; saveState({ snap: true }); render({ scroll: false }); break;
      }
      case 'save-pins': {
        const pins = {};
        Object.keys(ROLES).forEach((k) => {
          const v = (($('#pin_' + k) || {}).value || '').trim();
          if (v && !/^\d{4}$/.test(v)) { toast(ROLES[k].name + '密码要 4 位数字'); pins.__bad = true; return; }
          pins[k] = v;
        });
        if (pins.__bad) break;
        S.settings.pins = pins; touchSettings(); S.meta.rev++; saveState({ snap: true }); toast('角色密码已保存');
        break;
      }
      case 'cloud-setup': openCloudSheet(); break;
      case 'cloud-guide': openCloudGuide(); break;
      case 'cloud-back': openCloudSheet(); break;
      case 'copy-sql': copySetupSql(); break;
      case 'cloud-login': doCloudLogin(); break;
      case 'cloud-logout': confirmSheet('退出同步账号？', '本机数据会保留，但不再和云端同步。', '退出', () => { window.CJXSync.logout(); resetPullCursor(); closeSheet(); render({ scroll: false }); toast('已退出同步'); }, true); break;
      case 'cloud-sync': syncPull(true); break;
      case 'export-data': exportData(); break;
      case 'import-data': { const f = $('#importFile'); if (f) f.click(); break; }
      case 'import-dishes': { const f = $('#dishFile'); if (f) f.click(); break; }
      case 'restore-snap': restoreSnapshotSheet(); break;
      case 'restore-snap-ok': {
        const snaps = snapshots(); const snap = snaps[Number(el.dataset.idx)];
        if (!snap) break;
        confirmSheet('恢复这份快照？', String(snap.at).replace('T', ' ').slice(0, 16) + ' · ' + (snap.state.orders || []).length + ' 张订单', '确认恢复', () => {
          S = migrate(JSON.parse(JSON.stringify(snap.state))); S.meta.rev++; saveState({ noPush: true, noSnap: true }); closeSheet(); render(); toast('已恢复快照');
        });
        break;
      }
      case 'reload-demo': confirmSheet('载入示例数据？', '会覆盖当前订单、熟客和菜品，用于演示和熟悉系统。', '载入示例', function () {
        loadDemoScript().then(function () {
          seedDemo(S); saveState({ noPush: true, snap: true }); closeSheet(); render(); toast('示例数据已载入');
        }).catch(function () { toast('示例数据没加载成功，请连网后重试'); });
      }, true); break;
      case 'reset-all': confirmSheet('清空所有数据？', '订单、熟客、菜品都会恢复默认，且不能撤销。建议先导出备份。', '确认清空', () => {
        localStorage.removeItem(LS_STATE); localStorage.removeItem(LS_SNAPS); localStorage.removeItem(LS_SESSION);
        localStorage.removeItem('cjx_sync_v1'); location.reload();
      }, true); break;
      case 'copy-ai-prompt': copyText(S.settings.aiPrompt); break;
      case 'close-sheet': closeSheet(); break;
      case 'sheet-cancel': closeSheet(); break;
      case 'sheet-ok': { const fn = ui.pendingAction; closeSheet(); if (fn) fn(); break; }
      default: break;
    }
  }
  function openCloudSheet() {
    const st = window.CJXSync ? window.CJXSync.status() : {};
    if (st.authed) {
      openSheet('<h3>多人同步</h3><p class="sheet-sub">已登录：' + esc(st.email) + '<br>' + (st.lastSyncAt ? '最近同步 ' + esc(String(st.lastSyncAt).replace('T', ' ').slice(0, 16)) : '尚未同步') + '</p>' +
        '<div class="notice">数据会实时同步。老板、店长、后厨、服务员在各自手机登录同一个账号即可共享。</div>' +
        '<div class="btn-row mt8"><button class="btn primary" data-act="cloud-sync">立即同步</button><button class="btn soft" data-act="cloud-logout">退出登录</button></div>');
      return;
    }
    const cfg = window.CJXSync ? window.CJXSync.getConfig() : {};
    openSheet('<h3>配置多人同步</h3><p class="sheet-sub">用 Supabase 免费数据库，5 分钟建好；SQL 和步骤见 README。登录后多台手机共享同一套数据。</p>' +
      '<div class="field"><label>Supabase 项目地址</label><input id="cloudUrl" type="text" value="' + esc(cfg.url || '') + '" placeholder="https://xxxx.supabase.co"></div>' +
      '<div class="field"><label>anon public key</label><textarea id="cloudKey" placeholder="eyJhbGciOi...（Project Settings → API）" style="min-height:70px">' + esc(cfg.anonKey || '') + '</textarea></div>' +
      '<div class="field"><label>同步账号邮箱</label><input id="cloudEmail" type="text" inputmode="email" value="' + esc(cfg.email || '') + '" placeholder="staff@changjixian.com"></div>' +
      '<div class="field"><label>密码</label><input id="cloudPassword" type="password" placeholder="Supabase 用户密码"></div>' +
      '<div class="btn-row"><button class="btn ghost" data-act="close-sheet">仅本地使用</button><button class="btn primary" data-act="cloud-login">登录并同步</button></div>' +
      '<button class="btn soft block mt8" data-act="cloud-guide">第一次开通？看 4 步指引</button>' +
      '<div class="hint">anon key 是公开密钥，可以安全放在前端；写权限由 Supabase 的 RLS 规则控制。</div>');
  }
  function openCloudGuide() {
    openSheet('<h3>开通多人同步 · 4 步</h3><p class="sheet-sub">用 Supabase 免费版，手机、店长、后厨、服务员共享同一套数据。</p>' +
      '<div class="notice" style="line-height:1.9">' +
        '<b>1.</b> 打开 supabase.com，注册并新建一个免费项目（区域选新加坡或东京）。<br>' +
        '<b>2.</b> 左侧 SQL Editor → New query → 运行建表 SQL。<br>' +
        '<b>3.</b> 左侧 Authentication → Users → Add user，建一个店员共用账号（邮箱+密码，勾选 <b>Auto Confirm User</b>）。<br>' +
        '<b>4.</b> 左侧 Project Settings → API，复制 Project URL 和 anon public key，回这里登录。</div>' +
      '<div class="btn-row mt12"><button class="btn primary" data-act="copy-sql">复制建表 SQL</button><button class="btn soft" data-act="cloud-back">回到登录</button></div>' +
      '<div class="hint">SQL 文件也在部署包的 <b>supabase-setup.sql</b>，用记事本打开也能复制。建表后再加店员账号。</div>' +
      '<button class="btn ghost block mt8" data-act="close-sheet">关闭</button>');
  }
  async function copySetupSql() {
    try {
      const res = await fetch('supabase-setup.sql', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      await copyText(text);
    } catch (e) {
      toast('请打开部署包里的 supabase-setup.sql 复制');
    }
  }
  async function doCloudLogin() {
    const url = (($('#cloudUrl') || {}).value || '').trim();
    const key = (($('#cloudKey') || {}).value || '').trim();
    const email = (($('#cloudEmail') || {}).value || '').trim();
    const password = (($('#cloudPassword') || {}).value || '');
    if (!url || !key || !email || !password) { toast('请把四项都填完'); return; }
    try {
      toast('正在登录…');
      await window.CJXSync.login(url, key, email, password);
      resetPullCursor();   // 换了账号/项目，游标作废，先全量对齐
      closeSheet();
      toast('登录成功，开始同步');
      await syncPull(false);
      render();
      toast('已连接云端');
    } catch (e) { toast('登录失败：' + e.message); }
  }
  function openHelpSheet() {
    openSheet('<h3>长季鲜 · 一页纸使用说明</h3>' +
      '<div class="notice" style="line-height:1.85"><b>一条预定的完整走法</b><br>' +
      '① 老板接单，把客人微信聊天粘到「新建预定 → 微信聊天一键识别」，核对后保存。<br>' +
      '② 订单里点「转给店长配菜」，复制话术发给店长；店长首页会出现「待我配菜」。<br>' +
      '③ 店长点「AI 自动配菜 + 排包厢」：只要有<b>人数 + 餐标</b>，系统出三套菜单，并按人数自动排包厢（VIP1/VIP2 坐 10–12 人，VIP3 坐 15–18 人）。<br>' +
      '④ 店长「发给老板确认」→ 老板「转发给客户确认」→ 客户回话后点「客户已确认菜品」。<br>' +
      '⑤ 老板或店长「生成/发送邀请函」：图片版像请柬一样转发微信，带地址、一键导航、店招广告位和招牌菜；亲友忌口微信里回复，店长在订单里备注。<br><br>' +
      '<b>权限</b><br>' +
      '老板：接单、审核、改菜单、上下架、AI 配菜、发客户、邀请函。<b>菜价只有店长能改</b>。<br>' +
      '店长：上下架、改菜、改菜价、AI 配菜、备货单、审核、邀请函。<br>' +
      '后厨：只看时令菜和备货单，不能改。<br>' +
      '服务员：看板看包厢、人数和忌口，碗碟 / 酒壶 / 矿泉水 / 饮料按人数自动算量，勾选即可。<br><br>' +
      '<b>熟客沉淀</b><br>每次预定和完成都会把忌口、口味、常点菜记进档案，下次配菜自动避开忌口。同姓客人按手机尾号区分，不会串档。</div>' +
      '<button class="btn primary block mt12" data-act="close-sheet">知道了</button>');
  }

  /* ---------- 输入事件 ---------- */
  document.addEventListener('input', function (e) {
    const t = e.target;
    if (t.id === 'orderSearch') { ui.orderSearch = t.value; updateOrderList(); return; }
    if (t.id === 'custSearch') {
      ui.custSearch = t.value;
      const view = $('#view');
      if (view && ui.view === 'customers') { render({ scroll: false }); const inp = $('#custSearch'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
      return;
    }
    if (t.id === 'ledgerSearch') {
      ui.ledgerSearch = t.value;
      render({ scroll: false });
      const inp = $('#ledgerSearch'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      return;
    }
    if (t.id === 'dishSearch') {
      ui.dishSearch = t.value;
      render({ scroll: false });
      const inp = $('#dishSearch'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      return;
    }
    if (t.dataset && t.dataset.ff && ui.view === 'orderForm' && ui.form) {
      let v = t.value;
      if (t.type === 'number') v = v === '' ? '' : Number(v);
      ui.form.data[t.dataset.ff] = v;
      refreshFormSummary();
    }
  });
  document.addEventListener('change', function (e) {
    const t = e.target;
    if (t.id === 'calDatePick') { ui.calDate = t.value || D.todayStr(); render({ scroll: false }); return; }
    if (t.id === 'importFile' && t.files && t.files[0]) { importDataFile(t.files[0]); t.value = ''; return; }
    if (t.id === 'dishFile' && t.files && t.files[0]) { importDishFile(t.files[0]); t.value = ''; return; }
    if (t.dataset && t.dataset.ff && ui.view === 'orderForm' && ui.form) {
      let v = t.value;
      if (t.type === 'number') v = v === '' ? '' : Number(v);
      ui.form.data[t.dataset.ff] = v;
      refreshFormSummary();
    }
  });
  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.closest('.sheet') && el.getAttribute('data-act') === 'close-sheet' && e.target.closest('.veil') !== el) {
      // 关闭按钮在弹层内时也执行
    }
    handleAction(el);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSheet();
    if (e.key === 'Enter' && e.target && e.target.id === 'pinInput') { const b = document.querySelector('[data-act="pin-ok"]'); if (b) b.click(); }
  });

  /* ---------- 启动 ---------- */
  async function bootQuery() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get('reset') === '1') {
        localStorage.removeItem(LS_STATE); localStorage.removeItem(LS_SNAPS); localStorage.removeItem(LS_SESSION);
        localStorage.removeItem(LS_CURSOR);
        pullCursor = '';
        S = loadState();
      }
      if (q.get('demo') === '1' && !S.meta.seeded) {
        try {
          await loadDemoScript();
          seedDemo(S); S.meta.onboarded = true;
          saveState({ noPush: true, noSnap: true });
        } catch (e) { toast('示例数据没加载成功，请连网后重试'); }
      }
      const r = q.get('role');
      if (r && ROLES[r]) {
        const pin = (S.settings.pins || {})[r];
        if (pin) {
          session = null;
          localStorage.removeItem(LS_SESSION);
          ui.view = 'gate';
          ui.autoPinRole = r;
          ui.stack = [];
        } else {
          session = { role: r, at: D.nowISO() };
          localStorage.setItem(LS_SESSION, JSON.stringify(session));
          ui.view = r === 'service' ? 'board' : (r === 'kitchen' ? 'dishes' : 'home');
          ui.stack = [];
        }
      }
    } catch (e) { }
  }
  function startApp() {
    attachRsvps();
    render();
    if (ui.autoPinRole) {
      const pinRole = ui.autoPinRole;
      ui.autoPinRole = null;
      setTimeout(() => openPinSheet(pinRole), 180);
    }
    if (syncReady()) setTimeout(() => syncPull(false), 700);
    setInterval(() => {
      if (session && ui.view === 'board') render({ scroll: false });
    }, 30000);
    setInterval(() => {
      if (session && syncReady() && document.visibilityState === 'visible' && !ui.busy) syncPull(false);
    }, 22000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && syncReady()) syncPull(false);
    });
    window.addEventListener('online', function () { if (syncReady()) { toast('网络已恢复，正在同步'); syncPull(false); } });
    window.addEventListener('offline', function () { toast('当前离线，数据先存在本机'); });
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('./sw.js').catch(() => { });
    }
  }
  bootQuery().then(startApp, startApp);
})();
