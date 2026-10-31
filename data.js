/* 长季鲜 · 数据、演示数据、聊天识别、餐标智能配菜 */
(function (global) {
  'use strict';

  const APP_VERSION = '1.2.2';
  const CATEGORIES = ['冷菜', '热菜', '汤', '主食', '甜品'];

  const DIET_OPTIONS = ['无忌口', '海鲜过敏', '不吃海鲜', '素食', '不吃辣', '不吃牛羊肉', '不吃猪肉', '不吃蛋', '坚果过敏', '不吃香菜', '少油少盐', '控糖'];
  const SPECIAL_OPTIONS = ['生日布置', '生日蛋糕', '长寿面', '鲜花', '商务接待', '家宴', '纪念日', '儿童座椅', '投影设备', '停车位', '代驾', '拍照'];
  const TASTE_OPTIONS = ['清淡', '鲜', '香辣', '浓', '滋补', '甜', '时令', '清蒸', '清爽', '家常', '商务', '红糟', '糟香', '酸辣', '沙茶'];

  /* ---------- 工具 ---------- */
  function uid(prefix) {
    const s = (global.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    return (prefix || '') + s.replace(/-/g, '').slice(0, 14);
  }
  function nowISO() { return new Date().toISOString(); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parseYMD(s) {
    if (!s) return new Date();
    const p = String(s).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(dateStr, n) {
    const d = parseYMD(dateStr || todayStr());
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  function dayDiff(fromStr, toStr) {
    const a = parseYMD(fromStr); const b = parseYMD(toStr);
    return Math.round((b - a) / 86400000);
  }
  function fmtDateCN(dateStr) {
    const d = parseYMD(dateStr);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function weekdayCN(dateStr) {
    return '周' + '日一二三四五六'[parseYMD(dateStr).getDay()];
  }
  function relativeDay(dateStr) {
    const diff = dayDiff(todayStr(), dateStr);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    if (diff === -1) return '昨天';
    if (diff === -2) return '前天';
    return fmtDateCN(dateStr);
  }
  function money(n) {
    if (n === null || n === undefined || n === '' || isNaN(Number(n))) return '—';
    return '¥' + Number(n).toLocaleString('zh-CN');
  }
  function timeText(t) {
    if (!t) return '';
    const [h, m] = String(t).split(':');
    return pad(h) + ':' + (m || '00');
  }

  /* ---------- 默认菜品 ---------- */
  function dish(id, name, category, price, status, leadDays, tags, flavor, note) {
    return {
      id, name, category, price, status: status || 'on', leadDays: leadDays || 0,
      tags: tags || [], flavor: flavor || [], note: note || '',
      updatedAt: nowISO(), deleted: false, _dirty: false
    };
  }
  function defaultDishes() {
    // 菜名来自 D:\长季鲜\福安特色菜.xls（33 道），价格/分类为参考值，可在「时令菜」里改。
    return [
      // 冷菜
      dish('d01', '生腌小白虾', '冷菜', 88, 'on', 0, ['海鲜', '生'], ['鲜', '清爽'], '福安特色生腌'),
      dish('d02', '闽东鱼干三拼', '冷菜', 98, 'on', 0, ['海鲜'], ['鲜', '家常'], '闽东鱼干'),
      dish('d03', '生腌虾菇', '冷菜', 98, 'on', 0, ['海鲜', '生'], ['鲜', '清爽'], '福安特色生腌'),
      dish('d04', '秘汁海蛰皮', '冷菜', 68, 'on', 0, ['海鲜'], ['清爽', '鲜']),
      dish('d05', '韩城二都蛤', '冷菜', 88, 'on', 0, ['海鲜'], ['鲜', '清爽'], '福安二都蛤'),
      // 热菜
      dish('d06', '醉排骨', '热菜', 78, 'on', 0, ['猪'], ['甜', '浓', '家常'], '闽菜经典'),
      dish('d07', '牛肉炒嫩姜', '热菜', 118, 'on', 0, ['牛'], ['鲜', '家常']),
      dish('d08', '焖河豚', '热菜', 588, 'preorder', 2, ['海鲜', '鱼'], ['鲜', '时令'], '需提前 2 天，厨师确认'),
      dish('d09', '炒麦螺', '热菜', 88, 'on', 0, ['海鲜'], ['鲜', '家常']),
      dish('d10', '原汁目鱼', '热菜', 268, 'on', 0, ['海鲜'], ['鲜', '清淡']),
      dish('d11', '鱿鱼焖豆腐', '热菜', 98, 'on', 0, ['海鲜'], ['鲜', '家常']),
      dish('d12', '美人鱼炒姜', '热菜', 388, 'on', 0, ['海鲜', '鱼'], ['鲜', '滋补']),
      dish('d13', '五花肉炒贡菜', '热菜', 68, 'on', 0, ['猪'], ['家常', '浓']),
      dish('d14', '土鲍炒荠菜梗', '热菜', 188, 'on', 0, ['海鲜'], ['鲜', '清淡']),
      dish('d15', '爆炒猪腰', '热菜', 78, 'on', 0, ['猪'], ['浓', '家常']),
      dish('d16', '荷叶蒸鳗鱼', '热菜', 288, 'preorder', 1, ['海鲜', '鱼'], ['清蒸', '鲜'], '提前 1 天'),
      dish('d17', '干煎黄鱼鲞', '热菜', 168, 'on', 0, ['海鲜', '鱼'], ['鲜', '浓']),
      dish('d18', '蒸大口鱼', '热菜', 268, 'on', 0, ['海鲜', '鱼'], ['清蒸', '鲜', '清淡']),
      dish('d19', '焖丝丁鱼', '热菜', 168, 'on', 0, ['海鲜', '鱼'], ['鲜', '浓']),
      dish('d20', '五花肉炒笋干', '热菜', 78, 'on', 0, ['猪'], ['家常', '浓']),
      dish('d21', '溪鱼煎焖酸菜', '热菜', 108, 'on', 0, ['海鲜', '鱼'], ['酸辣', '鲜']),
      dish('d22', '土鲍烩广芥', '热菜', 188, 'on', 0, ['海鲜'], ['鲜', '清淡']),
      dish('d23', '绿笋炒嫩姜', '热菜', 58, 'on', 0, ['素'], ['清淡', '时令']),
      // 汤
      dish('d24', '半酒炖蛏', '汤', 108, 'on', 0, ['海鲜'], ['鲜', '滋补'], '福安半酒做法'),
      dish('d25', '海竹酸辣汤', '汤', 68, 'on', 0, ['海鲜'], ['酸辣', '鲜']),
      dish('d26', '猪皮酸辣汤', '汤', 58, 'on', 0, ['猪'], ['酸辣', '家常']),
      dish('d27', '鱼泡酸辣汤', '汤', 88, 'on', 0, ['海鲜', '鱼'], ['酸辣', '鲜']),
      dish('d28', '海葵酸辣汤', '汤', 108, 'on', 0, ['海鲜'], ['酸辣', '鲜']),
      dish('d29', '目鱼蛋鸡腰生蚝半酒炖', '汤', 288, 'preorder', 1, ['海鲜'], ['滋补', '鲜'], '福安大补汤，提前 1 天'),
      // 主食
      dish('d30', '海鲜炒米粉', '主食', 58, 'on', 0, ['海鲜'], ['鲜', '家常']),
      dish('d31', '海鲜炒地瓜粉扣', '主食', 58, 'on', 0, ['海鲜'], ['鲜', '家常']),
      dish('d32', '穆阳花饺', '主食', 48, 'on', 0, ['猪'], ['鲜', '家常'], '福安穆阳特色'),
      dish('d33', '畲族乌米饭', '主食', 48, 'on', 0, ['素'], ['家常', '时令'], '畲族特色'),
      // 后补充的菜（Excel 第 34–40 道）
      dish('d34', '对半煎下白石鲟', '热菜', 388, 'on', 0, ['海鲜', '鱼'], ['鲜', '浓'], '下白石鲟，对半煎'),
      dish('d35', '清蒸海区大黄鱼', '热菜', 388, 'preorder', 1, ['海鲜', '鱼'], ['清蒸', '鲜', '时令'], '海区大黄鱼，提前 1 天'),
      dish('d36', '溪骨炖汤', '汤', 128, 'on', 0, ['海鲜', '鱼'], ['鲜', '滋补'], '福安溪骨炖汤'),
      dish('d37', '流蜞炒蛋', '热菜', 88, 'on', 0, ['海鲜', '蛋'], ['鲜', '家常'], '流蜞炒蛋'),
      dish('d38', '干煎凤尾鱼', '热菜', 88, 'on', 0, ['海鲜', '鱼'], ['鲜', '浓'], '干煎凤尾鱼'),
      dish('d39', '猪脚烧目鱼干', '热菜', 128, 'on', 0, ['猪', '海鲜'], ['浓', '滋补'], '猪脚烧目鱼干'),
      dish('d40', '清蒸下白石白赖', '热菜', 268, 'on', 0, ['海鲜', '鱼'], ['清蒸', '鲜', '清淡'], '下白石白赖'),
      // 基础配菜（菜单需要，可在时令菜里停用）
      dish('b01', '时令时蔬', '热菜', 38, 'on', 0, ['素'], ['清淡'], '基础配菜'),
      dish('b02', '蒜蓉时蔬', '热菜', 38, 'on', 0, ['素'], ['清淡'], '基础配菜'),
      dish('b03', '时令果盘', '甜品', 58, 'on', 0, ['素'], ['清爽'], '基础配菜')
    ];
  }

  function defaultRooms() {
    return [
      { id: 'r1', name: 'VIP1', seats: 12, sort: 1, enabled: true, note: '', updatedAt: nowISO(), deleted: false, _dirty: false },
      { id: 'r2', name: 'VIP2', seats: 10, sort: 2, enabled: true, note: '', updatedAt: nowISO(), deleted: false, _dirty: false },
      { id: 'r3', name: 'VIP3', seats: 16, sort: 3, enabled: true, note: '', updatedAt: nowISO(), deleted: false, _dirty: false }
    ];
  }

  function defaultSettings() {
    return {
      shopName: '长季鲜',
      subtitle: '私厨会所',
      cuisine: '福安菜 × 厦门海鲜',
      businessHours: '17:00–22:00',
      address: '',
      phone: '',
      pins: { boss: '', manager: '', kitchen: '', service: '' },
      backupReminderDays: 7,
      aiPrompt: '你是长季鲜私厨会所（福安菜 × 厦门海鲜融合）的预定助手。店里不卖福安炖罐，也没有一堆福安小吃，小吃只保留「穆阳花饺」一道。请从下面的微信聊天记录中提取预定信息，只输出 JSON，不要解释。字段：date（YYYY-MM-DD，相对日期按今天换算）、time（HH:MM）、partySize（数字）、customerName、phone、wechat、roomName、budget（餐标金额，数字）、budgetMode（table 每桌 / person 每位）、occasion、dietary（数组）、special、dishes（数组）、notes。缺失的字段留空字符串或空数组。',
      updatedAt: nowISO()
    };
  }

  function defaultState() {
    return {
      meta: {
        schemaVersion: 2,
        rev: 0,
        updatedAt: nowISO(),
        deviceId: uid('dev_'),
        onboarded: false,
        settingsUpdatedAt: nowISO()
      },
      settings: defaultSettings(),
      rooms: defaultRooms(),
      dishes: defaultDishes(),
      customers: [],
      orders: [],
      rsvps: []
    };
  }

  /* ---------- 演示数据 ---------- */
  function findDishByName(S, name) {
    return (S.dishes || []).find((d) => d.name === name) ||
      (S.dishes || []).find((d) => name && d.name.indexOf(name) >= 0);
  }
  function dishObjs(S, names) {
    return names.map((n) => findDishByName(S, n)).filter(Boolean).map((d) => ({
      id: d.id, name: d.name, price: d.price, category: d.category,
      status: d.status, leadDays: d.leadDays, flavor: d.flavor || []
    }));
  }
  function seedDemo(S) {
    const t = todayStr();
    S.dishes = defaultDishes();
    S.rooms = defaultRooms();
    S.settings = defaultSettings();
    S.settings.shopName = '长季鲜';
    S.settings.subtitle = '私厨会所';

    const customers = [
      { id: 'c1', name: '王建国', aliases: ['王总'], wechat: 'wangjg', phone: '13805920001', tags: ['老友', 'VIP'], dietary: [], tasteTags: ['鲜', '时令', '清蒸', '清淡'], tasteScores: { '鲜': 5, '时令': 4, '清蒸': 2, '清淡': 2 }, dishCounts: { '生腌虾菇': 2, '原汁目鱼': 2, '蒸大口鱼': 1, '美人鱼炒姜': 1 }, prefRoom: 'r1', notes: '熟客，喜欢福安海鲜和时令鱼；太太不吃香菜。', visitCount: 3, lastVisit: addDays(t, -1), budgetPref: 3880, budgetMode: 'table' },
      { id: 'c2', name: '林雅', aliases: ['林女士'], wechat: 'linya', phone: '13905920002', tags: ['素食'], dietary: ['素食'], tasteTags: ['清淡', '甜', '清爽'], tasteScores: { '清淡': 4, '甜': 3, '清爽': 2 }, dishCounts: { '绿笋炒嫩姜': 2, '畲族乌米饭': 2, '时令时蔬': 1 }, prefRoom: 'r2', notes: '全素，不吃葱蒜；可让厨房单做素菜。', visitCount: 2, lastVisit: addDays(t, -1), budgetPref: 2000, budgetMode: 'table' },
      { id: 'c3', name: '张宏伟', aliases: ['张总'], wechat: 'zhanghw', phone: '13605920003', tags: ['商务', 'VIP'], dietary: ['不吃辣'], tasteTags: ['浓', '滋补', '商务'], tasteScores: { '浓': 4, '滋补': 3, '商务': 2 }, dishCounts: { '焖河豚': 2, '荷叶蒸鳗鱼': 1, '目鱼蛋鸡腰生蚝半酒炖': 1 }, prefRoom: 'r3', notes: '商务接待为主，要面子，喜欢河豚和半酒炖。', visitCount: 2, lastVisit: addDays(t, -7), budgetPref: 5000, budgetMode: 'table' },
      { id: 'c4', name: '陈志远', aliases: ['陈先生'], wechat: 'chenzy', phone: '13705920004', tags: ['家宴'], dietary: [], tasteTags: ['鲜', '浓'], tasteScores: { '鲜': 3, '浓': 2 }, dishCounts: { '醉排骨': 1, '炒麦螺': 1, '海鲜炒米粉': 1 }, prefRoom: 'r1', notes: '一家老小，孩子 6 岁。', visitCount: 1, lastVisit: addDays(t, -30), budgetPref: 3000, budgetMode: 'table' },
      { id: 'c5', name: '李敏', aliases: ['李女士'], wechat: 'limin', phone: '13505920005', tags: ['朋友'], dietary: ['不吃牛羊肉'], tasteTags: ['清淡', '甜'], tasteScores: { '清淡': 2, '甜': 2 }, dishCounts: {}, prefRoom: 'r2', notes: '', visitCount: 0, lastVisit: '', budgetPref: 1500, budgetMode: 'table' },
      { id: 'c6', name: '周文', aliases: ['周先生'], wechat: 'zhouwen', phone: '13405920006', tags: ['纪念日'], dietary: [], tasteTags: ['鲜', '清蒸'], tasteScores: { '鲜': 2, '清蒸': 1 }, dishCounts: {}, prefRoom: 'r3', notes: '纪念日喜欢安静包厢。', visitCount: 0, lastVisit: '', budgetPref: 2200, budgetMode: 'table' }
    ];
    customers.forEach((c) => { c.updatedAt = nowISO(); c.deleted = false; c._dirty = false; });
    S.customers = customers;

    function mk(o) {
      const dishes = dishObjs(S, o.dishNames || []);
      const cust = customers.find((c) => c.id === o.customerId);
      const id = o.id || uid('o_');
      return {
        id, code: 'CJX-' + o.date.replace(/-/g, '') + '-' + (o.seq || '01'),
        status: o.status, date: o.date, time: o.time, partySize: o.partySize,
        roomId: o.roomId || '', customerId: o.customerId || '', customerName: o.customerName || (cust ? cust.name : ''),
        phone: o.phone || (cust ? cust.phone : ''), wechat: o.wechat || (cust ? cust.wechat : ''),
        occasion: o.occasion || '', dishes,
        dietary: o.dietary || (cust ? cust.dietary.slice() : []),
        special: o.special || '', hostName: o.hostName || '', notes: o.notes || '',
        budget: o.budget || null, budgetMode: o.budgetMode || 'table', menuSource: o.menuSource || 'manual',
        guests: o.guests || [], inviteCode: o.inviteCode || '', inviteAt: o.inviteAt || '',
        serviceChecks: Object.assign({ tableware: false, pitcher: false, water: false }, o.serviceChecks || {}),
        missing: o.missing || [], changeLog: o.changeLog || [{ at: nowISO(), by: o.createdBy || '老板', text: '创建预定' }],
        audit: Object.assign({ createdAt: nowISO(), createdBy: o.createdBy || '老板', updatedAt: nowISO(), updatedBy: o.createdBy || '老板' }, o.audit || {}),
        updatedAt: o.updatedAt || nowISO(), deleted: false, _dirty: false,
        changePending: false
      };
    }

    const orders = [
      mk({ id: 'o1', seq: '01', status: 'notified', date: t, time: '18:00', partySize: 10, roomId: 'r1', customerId: 'c3', customerName: '张总', occasion: '商务宴请', dishNames: ['醉排骨', '生腌小白虾', '闽东鱼干三拼', '焖河豚', '荷叶蒸鳗鱼', '美人鱼炒姜', '蒸大口鱼', '土鲍炒荠菜梗', '爆炒猪腰', '目鱼蛋鸡腰生蚝半酒炖', '海鲜炒米粉', '时令果盘'], dietary: ['不吃辣'], special: '商务接待，准备茶室', budget: 5000, budgetMode: 'table', serviceChecks: { tableware: true, pitcher: true, water: true }, createdBy: '店长', audit: { confirmedAt: nowISO(), notifiedAt: nowISO() } }),
      mk({ id: 'o2', seq: '02', status: 'notified', date: t, time: '18:30', partySize: 8, roomId: 'r2', customerId: 'c1', customerName: '王总', occasion: '生日', dishNames: ['生腌虾菇', '韩城二都蛤', '原汁目鱼', '美人鱼炒姜', '蒸大口鱼', '干煎黄鱼鲞', '五花肉炒贡菜', '绿笋炒嫩姜', '半酒炖蛏', '土鲍炒荠菜梗', '海鲜炒地瓜粉扣', '穆阳花饺', '畲族乌米饭', '时令果盘'], special: '生日蛋糕、包厢简单布置', budget: 3880, budgetMode: 'table', serviceChecks: { tableware: true, pitcher: true, water: false }, inviteCode: 'INV-WANG88', inviteAt: nowISO(), createdBy: '老板', audit: { confirmedAt: nowISO(), notifiedAt: nowISO() }, guests: [{ id: 'rs1', name: '王太太', attend: true, dietary: ['不吃香菜'], partySize: 1, submittedAt: nowISO(), source: 'invite' }] }),
      mk({ id: 'o3', seq: '03', status: 'pending', date: t, time: '19:30', partySize: 6, roomId: 'r3', customerId: 'c2', customerName: '林女士', occasion: '朋友小聚', dishNames: ['绿笋炒嫩姜', '时令时蔬', '蒜蓉时蔬', '畲族乌米饭', '时令果盘'], dietary: ['素食'], special: '', phone: '', budget: 2000, budgetMode: 'table', createdBy: '老板', missing: ['电话', '忌口确认', '时令菜确认', '特殊安排确认'] }),
      mk({ id: 'o4', seq: '01', status: 'confirmed', date: addDays(t, 1), time: '18:30', partySize: 12, roomId: 'r1', customerId: 'c4', customerName: '陈先生', occasion: '家宴', dishNames: ['醉排骨', '牛肉炒嫩姜', '炒麦螺', '鱿鱼焖豆腐', '五花肉炒笋干', '绿笋炒嫩姜', '半酒炖蛏', '焖丝丁鱼', '蒸大口鱼', '土鲍烩广芥', '海鲜炒米粉', '穆阳花饺', '时令果盘'], dietary: [], special: '儿童座椅 1 个', budget: 3000, budgetMode: 'table', serviceChecks: { tableware: true, pitcher: false, water: false }, createdBy: '老板', audit: { confirmedAt: nowISO() } }),
      mk({ id: 'o5', seq: '02', status: 'pending', date: addDays(t, 1), time: '19:00', partySize: 4, roomId: 'r2', customerId: 'c5', customerName: '李女士', occasion: '朋友聚会', dishNames: ['生腌小白虾', '醉排骨', '鱿鱼焖豆腐', '绿笋炒嫩姜', '原汁目鱼', '蒸大口鱼', '海竹酸辣汤', '海鲜炒米粉'], dietary: ['不吃牛羊肉'], special: '', budget: 1500, budgetMode: 'table', createdBy: '老板', missing: ['电话', '特殊安排确认'] }),
      mk({ id: 'o6', seq: '01', status: 'confirmed', date: addDays(t, 2), time: '18:00', partySize: 8, roomId: 'r3', customerId: 'c6', customerName: '周先生', occasion: '结婚纪念日', dishNames: ['生腌虾菇', '闽东鱼干三拼', '原汁目鱼', '干煎黄鱼鲞', '绿笋炒嫩姜', '半酒炖蛏', '土鲍炒荠菜梗', '蒸大口鱼', '海鲜炒地瓜粉扣', '时令果盘'], dietary: [], special: '鲜花布置，安静包厢', budget: 2200, budgetMode: 'table', createdBy: '老板', audit: { confirmedAt: nowISO() } }),
      mk({ id: 'o7', seq: '01', status: 'done', date: addDays(t, -1), time: '18:00', partySize: 10, roomId: 'r1', customerId: 'c1', customerName: '王总', occasion: '老友聚餐', dishNames: ['生腌虾菇', '原汁目鱼', '美人鱼炒姜', '蒸大口鱼', '绿笋炒嫩姜', '半酒炖蛏', '海鲜炒米粉', '时令果盘'], dietary: [], special: '', budget: 3880, budgetMode: 'table', createdBy: '店长', audit: { confirmedAt: addDays(t, -2) + 'T10:00:00.000Z', notifiedAt: addDays(t, -2) + 'T10:00:00.000Z', doneAt: nowISO() } }),
      mk({ id: 'o8', seq: '02', status: 'done', date: addDays(t, -1), time: '19:00', partySize: 6, roomId: 'r2', customerId: 'c2', customerName: '林女士', occasion: '朋友小聚', dishNames: ['绿笋炒嫩姜', '时令时蔬', '蒜蓉时蔬', '畲族乌米饭', '时令果盘'], dietary: ['素食'], special: '', budget: 2000, budgetMode: 'table', createdBy: '老板', audit: { confirmedAt: addDays(t, -3) + 'T10:00:00.000Z', notifiedAt: addDays(t, -3) + 'T10:00:00.000Z', doneAt: nowISO() } }),
      mk({ id: 'o9', seq: '01', status: 'done', date: addDays(t, -7), time: '18:30', partySize: 6, roomId: 'r1', customerId: 'c1', customerName: '王总', occasion: '家宴', dishNames: ['生腌虾菇', '原汁目鱼', '美人鱼炒姜', '蒸大口鱼', '绿笋炒嫩姜', '半酒炖蛏', '海鲜炒米粉', '时令果盘'], dietary: [], special: '', budget: 2800, budgetMode: 'table', createdBy: '老板', audit: { confirmedAt: addDays(t, -8) + 'T10:00:00.000Z', notifiedAt: addDays(t, -8) + 'T10:00:00.000Z', doneAt: nowISO() } }),
      mk({ id: 'o10', seq: '02', status: 'done', date: addDays(t, -7), time: '19:00', partySize: 10, roomId: 'r3', customerId: 'c3', customerName: '张总', occasion: '商务接待', dishNames: ['焖河豚', '荷叶蒸鳗鱼', '目鱼蛋鸡腰生蚝半酒炖', '醉排骨', '生腌小白虾', '闽东鱼干三拼', '土鲍炒荠菜梗', '爆炒猪腰', '海鲜炒米粉', '时令果盘'], dietary: ['不吃辣'], special: '', budget: 4200, budgetMode: 'table', createdBy: '店长', audit: { confirmedAt: addDays(t, -8) + 'T10:00:00.000Z', notifiedAt: addDays(t, -8) + 'T10:00:00.000Z', doneAt: nowISO() } }),
      mk({ id: 'o11', seq: '01', status: 'pending', date: addDays(t, 7), time: '18:00', partySize: 10, roomId: 'r2', customerId: 'c4', customerName: '陈先生', occasion: '公司聚餐', dishNames: ['醉排骨', '炒麦螺', '蒸大口鱼', '五花肉炒笋干', '绿笋炒嫩姜', '海竹酸辣汤', '海鲜炒地瓜粉扣', '时令果盘'], dietary: [], special: '', budget: 3500, budgetMode: 'table', createdBy: '老板', missing: ['忌口确认', '时令菜确认', '特殊安排确认'] })
    ];
    orders.forEach((o) => { o.updatedAt = nowISO(); });
    S.orders = orders;
    S.rsvps = [{
      id: 'rs1', orderId: 'o2', inviteCode: 'INV-WANG88', guestName: '王太太',
      phone: '', attend: true, dietary: ['不吃香菜'], partySize: 1, submittedAt: nowISO(), source: 'invite'
    }];
    S.meta.onboarded = true;
    S.meta.seeded = true;
    S.meta.rev = 1;
    S.meta.updatedAt = nowISO();
    return S;
  }

  /* ---------- 熟客匹配 ---------- */
  function findCustomer(S, opts) {
    const phone = String((opts && opts.phone) || '').replace(/\s/g, '');
    const wechat = String((opts && opts.wechat) || '').trim().toLowerCase();
    const name = String((opts && opts.name) || '').trim();
    const list = (S.customers || []).filter((c) => !c.deleted);
    if (phone) {
      const c = list.find((x) => x.phone && x.phone.replace(/\s/g, '') === phone);
      if (c) return c;
    }
    if (wechat) {
      const c = list.find((x) => (x.wechat || '').toLowerCase() === wechat);
      if (c) return c;
    }
    if (name) {
      const c = list.find((x) => x.name === name || (x.aliases || []).includes(name));
      if (c) return c;
      const c2 = list.find((x) => (x.name.indexOf(name) >= 0 || name.indexOf(x.name) >= 0) && name.length >= 2);
      if (c2) return c2;
    }
    return null;
  }

  function favDishesOf(customer, limit) {
    const counts = customer && customer.dishCounts ? customer.dishCounts : {};
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, limit || 5)
      .map((name) => ({ name, count: counts[name] }));
  }

  function learnCustomer(customer, order) {
    if (!customer || !order) return;
    customer.dishCounts = customer.dishCounts || {};
    (order.dishes || []).forEach((d) => {
      const name = typeof d === 'string' ? d : d.name;
      if (name) customer.dishCounts[name] = (customer.dishCounts[name] || 0) + 1;
    });
    customer.tasteScores = customer.tasteScores || {};
    (order.dishes || []).forEach((d) => {
      (d.flavor || []).forEach((f) => { customer.tasteScores[f] = (customer.tasteScores[f] || 0) + 1; });
    });
    customer.tasteTags = Object.keys(customer.tasteScores)
      .sort((a, b) => customer.tasteScores[b] - customer.tasteScores[a]).slice(0, 6);
    if (order.budget) { customer.budgetPref = order.budget; customer.budgetMode = order.budgetMode || 'table'; }
    customer.updatedAt = nowISO();
    customer._dirty = true;
  }

  /* ---------- 聊天识别 ---------- */
  const CN_DIGITS = { '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9 };
  function cnNum(s) {
    if (!s) return NaN;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (s === '十') return 10;
    if (s.indexOf('十') >= 0) {
      const p = s.split('十');
      const tens = p[0] ? (CN_DIGITS[p[0]] || 0) : 1;
      const ones = p[1] ? (CN_DIGITS[p[1]] || 0) : 0;
      return tens * 10 + ones;
    }
    return CN_DIGITS[s] !== undefined ? CN_DIGITS[s] : NaN;
  }
  function nextWeekday(target, base) {
    const d = parseYMD(base || todayStr());
    const cur = d.getDay();
    let diff = target - cur;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return ymd(d);
  }
  function parseChat(text, S) {
    text = String(text || '');
    const out = {
      date: '', time: '', partySize: null, customerName: '', phone: '', wechat: '',
      roomName: '', roomId: '', occasion: '', dietary: [], special: '', dishes: [],
      budget: null, budgetMode: 'table', notes: '', taste: [], confidence: {}
    };
    const today = todayStr();
    // 日期
    let m;
    if ((m = text.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})[日号]?/))) {
      out.date = m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    } else if ((m = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/))) {
      const d = new Date(parseYMD(today).getFullYear(), Number(m[1]) - 1, Number(m[2]));
      if (d < parseYMD(today)) d.setFullYear(d.getFullYear() + 1);
      out.date = ymd(d);
    } else if (/大后天/.test(text)) out.date = addDays(today, 3);
    else if (/后天/.test(text)) out.date = addDays(today, 2);
    else if (/明天|明日|明晚/.test(text)) out.date = addDays(today, 1);
    else if (/今天|今晚|今日/.test(text)) out.date = today;
    else if ((m = text.match(/(下)?(?:周|星期)([一二三四五六日天])/))) {
      const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
      let target = nextWeekday(map[m[2]], today);
      if (m[1] && dayDiff(today, target) < 7) target = addDays(target, 7);
      out.date = target;
    } else if ((m = text.match(/(\d{1,2})[/-](\d{1,2})(?!\d)/))) {
      const d = new Date(parseYMD(today).getFullYear(), Number(m[1]) - 1, Number(m[2]));
      if (d < parseYMD(today)) d.setFullYear(d.getFullYear() + 1);
      out.date = ymd(d);
    }
    if (out.date) out.confidence.date = 'high';

    // 时间
    if ((m = text.match(/(?:晚上|傍晚|晚|下午|中午|上午|早上)?\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:[:：点时])\s*(半|[0-9]{1,2}|[一二三四五六七八九十]{1,3})?\s*分?/))) {
      let h = cnNum(m[1]);
      let mi = m[2] === '半' ? 30 : (m[2] ? cnNum(m[2]) : 0);
      if (!isNaN(h)) {
        if (/下午|傍晚|晚上|晚/.test(m[0]) && h < 12) h += 12;
        if (/中午/.test(m[0]) && h <= 1) h += 12;
        if (h >= 0 && h <= 23 && mi >= 0 && mi < 60) out.time = pad(h) + ':' + pad(mi);
      }
    }
    if (out.time) out.confidence.time = 'high';

    // 人数
    if ((m = text.match(/(?:一桌|1桌)?\s*([0-9]{1,2}|[一二两三四五六七八九十]{1,3})\s*(?:位|人|个人|口人)/))) {
      const n = cnNum(m[1]);
      if (n >= 1 && n <= 40) out.partySize = n;
    }
    if (!out.partySize && (m = text.match(/([0-9]{1,2}|[一二两三四五六七八九十]{1,3})\s*位/))) {
      const n = cnNum(m[1]); if (n >= 1 && n <= 40) out.partySize = n;
    }
    if (out.partySize) out.confidence.partySize = 'high';

    // 电话 / 微信
    if ((m = text.match(/1[3-9]\d{9}/))) out.phone = m[0];
    if ((m = text.match(/(?:微信|VX|vx|v信|加我)\s*[：:]?\s*([A-Za-z][A-Za-z0-9_-]{4,20})/))) out.wechat = m[1];

    // 包厢
    const rooms = (S && S.rooms) || [];
    if ((m = text.match(/VIP\s*([0-9一二三四五六])/i))) {
      const idx = /^\d$/.test(m[1]) ? Number(m[1]) : cnNum(m[1]);
      const r = rooms.find((x) => x.name.toLowerCase().replace(/\s/g, '') === 'vip' + idx) || rooms[idx - 1];
      if (r) { out.roomId = r.id; out.roomName = r.name; }
    } else if ((m = text.match(/(?:包厢|包间|房间)\s*([0-9一二三四五六]|VIP\s*[0-9])/i))) {
      const raw = m[1];
      if (/vip/i.test(raw)) {
        const idx = Number(raw.replace(/\D/g, ''));
        const r = rooms[idx - 1]; if (r) { out.roomId = r.id; out.roomName = r.name; }
      } else {
        const idx = /^\d$/.test(raw) ? Number(raw) : cnNum(raw);
        const r = rooms[idx - 1]; if (r) { out.roomId = r.id; out.roomName = r.name; }
      }
    }
    if (out.roomId) out.confidence.room = 'high';

    // 餐标
    if ((m = text.match(/人均\s*[¥￥]?\s*([0-9]{2,5})/)) || (m = text.match(/([0-9]{2,5})\s*(?:元|块)?\s*[/／]\s*人/))) {
      out.budget = Number(m[1]); out.budgetMode = 'person';
    } else if ((m = text.match(/(?:餐标|标准|预算)\s*[：:]?\s*[¥￥]?\s*([0-9]{2,6})/)) ||
               (m = text.match(/([0-9]{2,6})\s*(?:元|块)?\s*(?:餐标|一桌|[/／]桌)/)) ||
               (m = text.match(/一桌\s*[¥￥]?\s*([0-9]{2,6})/))) {
      out.budget = Number(m[1]); out.budgetMode = 'table';
    }
    if (out.budget) out.confidence.budget = 'high';

    // 称呼
    if ((m = text.match(/(?:我是|我叫|称呼我|叫我)\s*([一-龥A-Za-z]{1,8})/))) out.customerName = m[1];
    if (!out.customerName && (m = text.match(/([一-龥]{1,3}(?:总|先生|女士|小姐|老师|老板|阿姨|叔叔))/))) out.customerName = m[1];
    if (!out.customerName && (m = text.match(/^([一-龥]{2,4})(?:[，,：:]|\s|$)/))) out.customerName = m[1];
    if (out.customerName) out.confidence.name = 'medium';

    // 场景
    const occasions = ['生日', '寿宴', '满月', '纪念日', '商务宴请', '商务接待', '家宴', '家庭聚餐', '朋友聚会', '朋友小聚', '公司聚餐', '团建', '订婚', '答谢宴'];
    out.occasion = occasions.find((x) => text.indexOf(x) >= 0) || '';

    // 忌口
    const dietMap = [
      ['海鲜过敏', /海鲜过敏|过敏.*海鲜|海鲜.*过敏/],
      ['不吃海鲜', /不吃海鲜|不能吃海鲜|忌海鲜/],
      ['素食', /素食|吃素|全素/],
      ['不吃辣', /不吃辣|忌辣|不能吃辣/],
      ['不吃牛羊肉', /不吃牛|不吃羊|忌牛羊肉/],
      ['不吃猪肉', /不吃猪|忌猪肉/],
      ['不吃蛋', /不吃蛋|鸡蛋过敏/],
      ['坚果过敏', /坚果过敏|花生过敏|腰果过敏/],
      ['不吃香菜', /不吃香菜|不要香菜/],
      ['少油少盐', /少油少盐|清淡一点|不要太油/],
      ['控糖', /控糖|糖尿病|血糖高/]
    ];
    out.dietary = dietMap.filter((x) => x[1].test(text)).map((x) => x[0]);

    // 口味偏好（客户主动说的）
    const tasteMap = [
      ['清淡', /口味清淡|吃得清淡|喜欢清淡|清淡为主/],
      ['鲜', /爱吃海鲜|喜欢海鲜|喜欢鲜|鲜为主/],
      ['香辣', /爱吃辣|喜欢辣|无辣不欢|口味偏辣/],
      ['浓', /口味重|重口|喜欢浓|浓油赤酱/],
      ['滋补', /爱喝汤|喜欢喝汤|喜欢炖|滋补/],
      ['甜', /爱吃甜|喜欢甜|偏甜/],
      ['红糟', /喜欢红糟|爱吃红糟|红糟口味/],
      ['沙茶', /喜欢沙茶|爱吃沙茶/],
      ['清蒸', /喜欢清蒸|清蒸为主/],
      ['时令', /喜欢时令|吃当季|当季食材/]
    ];
    out.taste = tasteMap.filter((x) => x[1].test(text)).map((x) => x[0]);

    // 特殊安排
    const specials = ['生日蛋糕', '生日布置', '长寿面', '鲜花', '气球', '商务接待', '儿童座椅', '投影', '停车', '代驾', '拍照', '茶室', '麻将'];
    out.special = specials.filter((x) => text.indexOf(x) >= 0).join('、');

    // 菜品
    const dishPool = (S && S.dishes) || [];
    const seen = {};
    dishPool.forEach((d) => {
      if (d.deleted || d.status === 'off') return;
      if (text.indexOf(d.name) >= 0 && !seen[d.id]) { seen[d.id] = 1; out.dishes.push(d.name); }
    });
    // 常见俗称
    const alias = { '黄鱼': '干煎黄鱼鲞', '花饺': '穆阳花饺', '乌米饭': '畲族乌米饭', '河豚': '焖河豚', '二都蛤': '韩城二都蛤', '虾菇': '生腌虾菇', '小白虾': '生腌小白虾' };
    Object.keys(alias).forEach((k) => {
      if (text.indexOf(k) >= 0) {
        const d = dishPool.find((x) => x.name === alias[k] && !x.deleted);
        if (d && !seen[d.id]) { seen[d.id] = 1; out.dishes.push(d.name); }
      }
    });

    // 备注
    if ((m = text.match(/(?:备注|注意|另外|要求)\s*[：:]?\s*([^\n。；;]{2,60})/))) out.notes = m[1].trim();

    return out;
  }

  /* ---------- 餐标智能配菜 ---------- */
  function budgetTotalOf(budget, mode, partySize) {
    const b = Number(budget);
    if (!b || b <= 0) return null;
    return mode === 'person' ? b * (Number(partySize) || 1) : b;
  }
  function dietExcludes(d, dietary) {
    const list = (dietary || []).join(' ');
    if (/素食|吃素|全素/.test(list)) return !(d.tags || []).includes('素');
    if (/海鲜过敏|不吃海鲜|忌海鲜/.test(list) && (d.tags || []).includes('海鲜')) return true;
    if (/牛羊肉|不吃牛/.test(list) && ((d.tags || []).includes('牛') || (d.tags || []).includes('羊'))) return true;
    if (/不吃猪|忌猪肉/.test(list) && (d.tags || []).includes('猪')) return true;
    if (/不吃蛋/.test(list) && (d.tags || []).includes('蛋')) return true;
    if (/坚果|花生/.test(list) && (d.tags || []).includes('坚果')) return true;
    if (/不吃辣|忌辣/.test(list) && (d.tags || []).includes('辣')) return true;
    return false;
  }
  function menuTemplate(party, variant) {
    const p = Math.max(1, Number(party) || 8);
    let cold, hot, soup, staple, dessert;
    if (p <= 4) { cold = 2; hot = 3; soup = 1; staple = 1; dessert = 0; }
    else if (p <= 7) { cold = 3; hot = 4; soup = 1; staple = 1; dessert = 1; }
    else if (p <= 10) { cold = 4; hot = 6; soup = 1; staple = 1; dessert = 1; }
    else if (p <= 14) { cold = 5; hot = 7; soup = 1; staple = 1; dessert = 1; }
    else { cold = 6; hot = 8; soup = 2; staple = 1; dessert = 1; }
    if (variant === 'value') { hot = Math.max(2, hot - 1); if (p < 8) dessert = 0; }
    if (variant === 'feast') { cold += 1; hot += 1; dessert = 1; }
    return { '冷菜': cold, '热菜': hot, '汤': soup, '主食': staple, '甜品': dessert };
  }
  function baseDishScore(d, customer, dietary, extraTaste) {
    let s = 0;
    if (customer && customer.dishCounts && customer.dishCounts[d.name]) {
      s += Math.min(36, customer.dishCounts[d.name] * 9);
    }
    const tastes = [].concat((customer && customer.tasteTags) || [], extraTaste || []);
    (d.flavor || []).forEach((f) => { if (tastes.includes(f)) s += 6; });
    if (/少油|清淡/.test((dietary || []).join(' ')) && (d.flavor || []).includes('清淡')) s += 5;
    if (customer && (customer.tags || []).includes('商务') && d.price >= 180) s += 3;
    if (d.status === 'preorder') s -= 2;
    return s;
  }
  function resolveKeepDishes(S, list) {
    const out = [];
    const seen = new Set();
    (list || []).forEach((x) => {
      if (!x) return;
      const name = typeof x === 'string' ? x : x.name;
      if (!name || seen.has(name)) return;
      const d = findDishByName(S, name);
      const obj = d ? { id: d.id, name: d.name, category: d.category, price: d.price, status: d.status, leadDays: d.leadDays, flavor: d.flavor || [], tags: d.tags || [] } : (typeof x === 'object' ? x : null);
      if (obj) { out.push(obj); seen.add(name); }
    });
    return out;
  }
  function eligibleDishes(S, opts) {
    const date = opts.date || todayStr();
    const lead = dayDiff(todayStr(), date);
    return (S.dishes || []).filter((d) => {
      if (d.deleted || d.status === 'off') return false;
      if (!d.price || d.price <= 0) return false;
      if (d.status === 'preorder' && Number(d.leadDays || 0) > lead) return false;
      if (dietExcludes(d, opts.dietary)) return false;
      return true;
    });
  }
  function minFutureCost(eligible, cats, used) {
    let sum = 0;
    cats.forEach((cat) => {
      const pool = eligible.filter((d) => d.category === cat && !used.has(d.id));
      const min = pool.length ? Math.min.apply(null, pool.map((d) => d.price)) : 0;
      sum += min;
    });
    return sum;
  }
  function buildMenuVariant(S, opts, variant) {
    const party = Math.max(1, Number(opts.partySize) || 8);
    const totalBudget = opts.budgetTotal || 0;
    const factors = { recommend: 0.97, value: 0.82, feast: 1.06 };
    const target = totalBudget * factors[variant];
    const eligible = eligibleDishes(S, opts);
    const customer = opts.customer || null;
    const extraTaste = opts.tasteTags || [];
    const kept = resolveKeepDishes(S, opts.keepDishes || []);
    const counts = menuTemplate(party, variant);
    // 客户指定 / 老板已选的菜先占位，再按剩余预算补菜
    const picked = kept.slice(); const used = new Set(); let total = 0;
    picked.forEach((d) => { used.add(d.id || d.name); total += Number(d.price) || 0; });
    const keptNames = new Set(kept.map((d) => d.name));
    kept.forEach((d) => { if (counts[d.category] > 0) counts[d.category] -= 1; });
    const slots = [];
    CATEGORIES.forEach((cat) => { for (let i = 0; i < (counts[cat] || 0); i++) slots.push(cat); });

    for (let i = 0; i < slots.length; i++) {
      const cat = slots[i];
      const remainSlots = slots.length - i;
      const ideal = Math.max(20, (target - total) / Math.max(1, remainSlots));
      let pool = eligible.filter((d) => d.category === cat && !used.has(d.id));
      if (!pool.length) continue;
      const minFuture = minFutureCost(eligible, slots.slice(i + 1), used);
      let affordable = pool.filter((d) => total + d.price + minFuture <= totalBudget * 1.08);
      if (!affordable.length) affordable = pool.slice().sort((a, b) => a.price - b.price).slice(0, 2);
      const scored = affordable.map((d) => {
        const priceFit = Math.abs(d.price - ideal) / Math.max(40, ideal);
        return { d, s: baseDishScore(d, customer, opts.dietary, extraTaste) - priceFit * 7 + Math.random() * 5 };
      }).sort((a, b) => b.s - a.s);
      const pick = scored[0].d;
      picked.push(pick); used.add(pick.id); total += pick.price;
    }

    // 先升级菜品（换更贵的同类菜）把预算用足，而不是无限加菜
    let guard = 0;
    while (total < target * 0.95 && guard++ < 8) {
      const cand = [];
      picked.forEach((exp) => {
        if (keptNames.has(exp.name)) return;
        eligible.forEach((alt) => {
          if (alt.category !== exp.category || used.has(alt.id) || alt.price <= exp.price) return;
          const newTotal = total - exp.price + alt.price;
          if (newTotal > totalBudget) return;
          cand.push({
            exp, alt,
            s: baseDishScore(alt, customer, opts.dietary, extraTaste) - Math.abs(newTotal - target) / 120
          });
        });
      });
      if (!cand.length) break;
      cand.sort((a, b) => b.s - a.s);
      const c = cand[0];
      const idx = picked.indexOf(c.exp);
      picked[idx] = c.alt; used.delete(c.exp.id); used.add(c.alt.id);
      total += c.alt.price - c.exp.price;
    }
    // 仍差很多时，最多加 2 道菜
    let extraLimit = variant === 'feast' ? 2 : (variant === 'value' ? 0 : 1);
    guard = 0;
    while (total < target * 0.85 && extraLimit-- > 0 && guard++ < 2) {
      const cats = ['热菜', '冷菜', '汤'];
      let added = false;
      for (let c = 0; c < cats.length; c++) {
        const cat = cats[c];
        const pool = eligible.filter((d) => d.category === cat && !used.has(d.id) && total + d.price <= totalBudget);
        if (pool.length) {
          pool.sort((a, b) => baseDishScore(b, customer, opts.dietary, extraTaste) - baseDishScore(a, customer, opts.dietary, extraTaste));
          const d = pool[0]; picked.push(d); used.add(d.id); total += d.price; added = true; break;
        }
      }
      if (!added) break;
    }
    // 超预算：去甜品/主食，再换便宜菜
    guard = 0;
    while (total > totalBudget && guard++ < 10) {
      let changed = false;
      const dropOrder = ['甜品', '主食'];
      for (let c = 0; c < dropOrder.length; c++) {
        const list = picked.filter((d) => d.category === dropOrder[c] && !keptNames.has(d.name));
        if (list.length) {
          const d = list[list.length - 1];
          picked.splice(picked.indexOf(d), 1); used.delete(d.id); total -= d.price; changed = true; break;
        }
      }
      if (changed) continue;
      const sorted = picked.filter((d) => !keptNames.has(d.name)).sort((a, b) => b.price - a.price);
      for (let i = 0; i < sorted.length; i++) {
        const exp = sorted[i];
        const alt = eligible.filter((d) => d.category === exp.category && !used.has(d.id) && d.price < exp.price - 5)
          .sort((a, b) => b.price - a.price)[0];
        if (alt && total - exp.price + alt.price <= totalBudget) {
          picked.splice(picked.indexOf(exp), 1, alt); used.delete(exp.id); used.add(alt.id);
          total += alt.price - exp.price; changed = true; break;
        }
      }
      if (!changed) break;
    }

    const items = picked.slice().sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || b.price - a.price);
    const preorder = items.filter((d) => d.status === 'preorder').length;
    const titles = { recommend: '推荐菜单 · 均衡', value: '实惠菜单 · 控预算', feast: '丰盛菜单 · 有面子' };
    const descs = {
      recommend: '荤素搭配，优先照顾老客口味',
      value: '份量够吃，留出酒水空间',
      feast: '硬菜更多，适合商务或重要宴请'
    };
    return {
      key: variant, title: titles[variant], desc: descs[variant], items,
      total, perPerson: total / party, budget: totalBudget,
      within: total <= totalBudget, preorder, partySize: party,
      keptCount: kept.length, remaining: totalBudget - total
    };
  }
  function generateMenus(S, opts) {
    const totalBudget = opts.budgetTotal || budgetTotalOf(opts.budget, opts.budgetMode, opts.partySize);
    if (!totalBudget) return [];
    const base = Object.assign({}, opts, { budgetTotal: totalBudget });
    return ['recommend', 'value', 'feast'].map((v) => buildMenuVariant(S, base, v));
  }

  function orderTotal(order) {
    const list = (order && order.dishes) || [];
    let sum = 0; let priced = 0;
    list.forEach((d) => {
      const p = typeof d === 'object' ? Number(d.price) : 0;
      if (p) { sum += p; priced++; }
    });
    return priced ? sum : null;
  }

  function roomName(S, id) {
    const r = (S.rooms || []).find((x) => x.id === id);
    return r ? r.name : '';
  }
  function dishByName(S, name) {
    return (S.dishes || []).find((d) => d.name === name);
  }

  global.CJXData = {
    APP_VERSION, CATEGORIES, DIET_OPTIONS, SPECIAL_OPTIONS, TASTE_OPTIONS,
    uid, nowISO, todayStr, addDays, dayDiff, fmtDateCN, weekdayCN, relativeDay, money, timeText, pad,
    defaultState, defaultDishes, defaultRooms, defaultSettings, seedDemo,
    findCustomer, favDishesOf, learnCustomer, dishObjs, dishByName, roomName,
    parseChat, budgetTotalOf, generateMenus, orderTotal, eligibleDishes, dietExcludes
  };
})(window);
