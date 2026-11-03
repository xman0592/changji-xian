/* 长季鲜 · 示例数据（按需加载：首屏不加载，点「载入示例数据」时才拉取） */
(function (global) {
  'use strict';
  const D = global.CJXData;
  if (!D) { return; }

  /* 生成演示用的熟客、订单、回执，覆盖待审核/已确认/已完成/未来预定等状态 */
  function seedDemo(S) {

    const t = D.todayStr();
    S.dishes = D.defaultDishes();
    S.rooms = D.defaultRooms();
    S.settings = D.defaultSettings();
    S.settings.shopName = '长季鲜';
    S.settings.subtitle = '私厨会所';
    S.settings.address = '福安市城南街道富春大道 88 号 3 楼';
    S.settings.phone = '0593-6688999';
    S.settings.slogan = '时令海鲜 · 私厨家宴';
    S.settings.adText = '本月主打：下白石鲟 · 承接寿宴';
    S.settings.lat = '27.0900';
    S.settings.lng = '119.6500';

    const customers = [
      { id: 'c1', name: '王建国', aliases: ['王总'], wechat: 'wangjg', phone: '13805920001', tags: ['老友', 'VIP'], dietary: [], tasteTags: ['鲜', '时令', '清蒸', '清淡'], tasteScores: { '鲜': 5, '时令': 4, '清蒸': 2, '清淡': 2 }, dishCounts: { '生腌虾菇': 2, '原汁目鱼': 2, '蒸大口鱼': 1, '美人鱼炒姜': 1 }, prefRoom: 'r1', notes: '熟客，喜欢福安海鲜和时令鱼；太太不吃香菜。', visitCount: 3, lastVisit: D.addDays(t, -1), budgetPref: 3880, budgetMode: 'table' },
      { id: 'c2', name: '林雅', aliases: ['林女士'], wechat: 'linya', phone: '13905920002', tags: ['素食'], dietary: ['素食'], tasteTags: ['清淡', '甜', '清爽'], tasteScores: { '清淡': 4, '甜': 3, '清爽': 2 }, dishCounts: { '绿笋炒嫩姜': 2, '畲族乌米饭': 2, '时令时蔬': 1 }, prefRoom: 'r2', notes: '全素，不吃葱蒜；可让厨房单做素菜。', visitCount: 2, lastVisit: D.addDays(t, -1), budgetPref: 2000, budgetMode: 'table' },
      { id: 'c3', name: '张宏伟', aliases: ['张总'], wechat: 'zhanghw', phone: '13605920003', tags: ['商务', 'VIP'], dietary: ['不吃辣'], tasteTags: ['浓', '滋补', '商务'], tasteScores: { '浓': 4, '滋补': 3, '商务': 2 }, dishCounts: { '焖河豚': 2, '荷叶蒸鳗鱼': 1, '目鱼蛋鸡腰生蚝半酒炖': 1 }, prefRoom: 'r3', notes: '商务接待为主，要面子，喜欢河豚和半酒炖。', visitCount: 2, lastVisit: D.addDays(t, -7), budgetPref: 5000, budgetMode: 'table' },
      { id: 'c4', name: '陈志远', aliases: ['陈先生'], wechat: 'chenzy', phone: '13705920004', tags: ['家宴'], dietary: [], tasteTags: ['鲜', '浓'], tasteScores: { '鲜': 3, '浓': 2 }, dishCounts: { '醉排骨': 1, '炒麦螺': 1, '海鲜炒米粉': 1 }, prefRoom: 'r1', notes: '一家老小，孩子 6 岁。', visitCount: 1, lastVisit: D.addDays(t, -30), budgetPref: 3000, budgetMode: 'table' },
      { id: 'c5', name: '李敏', aliases: ['李女士'], wechat: 'limin', phone: '13505920005', tags: ['朋友'], dietary: ['不吃牛羊肉'], tasteTags: ['清淡', '甜'], tasteScores: { '清淡': 2, '甜': 2 }, dishCounts: {}, prefRoom: 'r2', notes: '', visitCount: 0, lastVisit: '', budgetPref: 1500, budgetMode: 'table' },
      { id: 'c6', name: '周文', aliases: ['周先生'], wechat: 'zhouwen', phone: '13405920006', tags: ['纪念日'], dietary: [], tasteTags: ['鲜', '清蒸'], tasteScores: { '鲜': 2, '清蒸': 1 }, dishCounts: {}, prefRoom: 'r3', notes: '纪念日喜欢安静包厢。', visitCount: 0, lastVisit: '', budgetPref: 2200, budgetMode: 'table' }
    ];
    customers.forEach((c) => { c.updatedAt = D.nowISO(); c.deleted = false; c._dirty = false; });
    S.customers = customers;

    function mk(o) {
      const dishes = D.dishObjs(S, o.dishNames || []);
      const cust = customers.find((c) => c.id === o.customerId);
      const id = o.id || D.uid('o_');
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
        serviceChecks: Object.assign({ tableware: false, pitcher: false, water: false, drink: false }, o.serviceChecks || {}),
        missing: o.missing || [], changeLog: o.changeLog || [{ at: D.nowISO(), by: o.createdBy || '老板', text: '创建预定' }],
        audit: Object.assign({ createdAt: D.nowISO(), createdBy: o.createdBy || '老板', updatedAt: D.nowISO(), updatedBy: o.createdBy || '老板' }, o.audit || {}),
        updatedAt: o.updatedAt || D.nowISO(), deleted: false, _dirty: false,
        changePending: false
      };
    }

    const orders = [
      mk({ id: 'o1', seq: '01', status: 'notified', date: t, time: '18:00', partySize: 10, roomId: 'r1', customerId: 'c3', customerName: '张总', occasion: '商务宴请', dishNames: ['醉排骨', '生腌小白虾', '闽东鱼干三拼', '焖河豚', '荷叶蒸鳗鱼', '美人鱼炒姜', '蒸大口鱼', '土鲍炒荠菜梗', '爆炒猪腰', '目鱼蛋鸡腰生蚝半酒炖', '海鲜炒米粉', '时令果盘'], dietary: ['不吃辣'], special: '商务接待，准备茶室', budget: 5000, budgetMode: 'table', serviceChecks: { tableware: true, pitcher: true, water: true }, createdBy: '店长', audit: { confirmedAt: D.nowISO(), notifiedAt: D.nowISO() } }),
      mk({ id: 'o2', seq: '02', status: 'notified', date: t, time: '18:30', partySize: 8, roomId: 'r2', customerId: 'c1', customerName: '王总', occasion: '生日', dishNames: ['生腌虾菇', '韩城二都蛤', '原汁目鱼', '美人鱼炒姜', '蒸大口鱼', '干煎黄鱼鲞', '五花肉炒贡菜', '绿笋炒嫩姜', '半酒炖蛏', '土鲍炒荠菜梗', '海鲜炒地瓜粉扣', '穆阳花饺', '畲族乌米饭', '时令果盘'], special: '生日蛋糕、包厢简单布置', budget: 3880, budgetMode: 'table', serviceChecks: { tableware: true, pitcher: true, water: false }, inviteCode: 'INV-WANG88', inviteAt: D.nowISO(), createdBy: '老板', audit: { confirmedAt: D.nowISO(), notifiedAt: D.nowISO() }, guests: [{ id: 'rs1', name: '王太太', attend: true, dietary: ['不吃香菜'], partySize: 1, submittedAt: D.nowISO(), source: 'invite' }] }),
      mk({ id: 'o3', seq: '03', status: 'pending', date: t, time: '19:30', partySize: 6, roomId: 'r3', customerId: 'c2', customerName: '林女士', occasion: '朋友小聚', dishNames: [], dietary: ['素食'], special: '', phone: '', budget: 2000, budgetMode: 'table', createdBy: '老板', missing: ['电话', '忌口确认', '时令菜确认', '特殊安排确认'] }),
      mk({ id: 'o4', seq: '01', status: 'confirmed', date: D.addDays(t, 1), time: '18:30', partySize: 12, roomId: 'r1', customerId: 'c4', customerName: '陈先生', occasion: '家宴', dishNames: ['醉排骨', '牛肉炒嫩姜', '炒麦螺', '鱿鱼焖豆腐', '五花肉炒笋干', '绿笋炒嫩姜', '半酒炖蛏', '焖丝丁鱼', '蒸大口鱼', '土鲍烩广芥', '海鲜炒米粉', '穆阳花饺', '时令果盘'], dietary: [], special: '儿童座椅 1 个', budget: 3000, budgetMode: 'table', serviceChecks: { tableware: true, pitcher: false, water: false }, createdBy: '老板', audit: { confirmedAt: D.nowISO() } }),
      mk({ id: 'o5', seq: '02', status: 'pending', date: D.addDays(t, 1), time: '19:00', partySize: 4, roomId: 'r2', customerId: 'c5', customerName: '李女士', occasion: '朋友聚会', dishNames: [], dietary: ['不吃牛羊肉'], special: '', budget: 1500, budgetMode: 'table', createdBy: '老板', missing: ['电话', '特殊安排确认'] }),
      mk({ id: 'o6', seq: '01', status: 'confirmed', date: D.addDays(t, 2), time: '18:00', partySize: 8, roomId: 'r3', customerId: 'c6', customerName: '周先生', occasion: '结婚纪念日', dishNames: ['生腌虾菇', '闽东鱼干三拼', '原汁目鱼', '干煎黄鱼鲞', '绿笋炒嫩姜', '半酒炖蛏', '土鲍炒荠菜梗', '蒸大口鱼', '海鲜炒地瓜粉扣', '时令果盘'], dietary: [], special: '鲜花布置，安静包厢', budget: 2200, budgetMode: 'table', createdBy: '老板', audit: { confirmedAt: D.nowISO() } }),
      mk({ id: 'o7', seq: '01', status: 'done', date: D.addDays(t, -1), time: '18:00', partySize: 10, roomId: 'r1', customerId: 'c1', customerName: '王总', occasion: '老友聚餐', dishNames: ['生腌虾菇', '原汁目鱼', '美人鱼炒姜', '蒸大口鱼', '绿笋炒嫩姜', '半酒炖蛏', '海鲜炒米粉', '时令果盘'], dietary: [], special: '', budget: 3880, budgetMode: 'table', createdBy: '店长', audit: { confirmedAt: D.addDays(t, -2) + 'T10:00:00.000Z', notifiedAt: D.addDays(t, -2) + 'T10:00:00.000Z', doneAt: D.nowISO() } }),
      mk({ id: 'o8', seq: '02', status: 'done', date: D.addDays(t, -1), time: '19:00', partySize: 6, roomId: 'r2', customerId: 'c2', customerName: '林女士', occasion: '朋友小聚', dishNames: ['绿笋炒嫩姜', '时令时蔬', '蒜蓉时蔬', '畲族乌米饭', '时令果盘'], dietary: ['素食'], special: '', budget: 2000, budgetMode: 'table', createdBy: '老板', audit: { confirmedAt: D.addDays(t, -3) + 'T10:00:00.000Z', notifiedAt: D.addDays(t, -3) + 'T10:00:00.000Z', doneAt: D.nowISO() } }),
      mk({ id: 'o9', seq: '01', status: 'done', date: D.addDays(t, -7), time: '18:30', partySize: 6, roomId: 'r1', customerId: 'c1', customerName: '王总', occasion: '家宴', dishNames: ['生腌虾菇', '原汁目鱼', '美人鱼炒姜', '蒸大口鱼', '绿笋炒嫩姜', '半酒炖蛏', '海鲜炒米粉', '时令果盘'], dietary: [], special: '', budget: 2800, budgetMode: 'table', createdBy: '老板', audit: { confirmedAt: D.addDays(t, -8) + 'T10:00:00.000Z', notifiedAt: D.addDays(t, -8) + 'T10:00:00.000Z', doneAt: D.nowISO() } }),
      mk({ id: 'o10', seq: '02', status: 'done', date: D.addDays(t, -7), time: '19:00', partySize: 10, roomId: 'r3', customerId: 'c3', customerName: '张总', occasion: '商务接待', dishNames: ['焖河豚', '荷叶蒸鳗鱼', '目鱼蛋鸡腰生蚝半酒炖', '醉排骨', '生腌小白虾', '闽东鱼干三拼', '土鲍炒荠菜梗', '爆炒猪腰', '海鲜炒米粉', '时令果盘'], dietary: ['不吃辣'], special: '', budget: 4200, budgetMode: 'table', createdBy: '店长', audit: { confirmedAt: D.addDays(t, -8) + 'T10:00:00.000Z', notifiedAt: D.addDays(t, -8) + 'T10:00:00.000Z', doneAt: D.nowISO() } }),
      mk({ id: 'o11', seq: '01', status: 'pending', date: D.addDays(t, 7), time: '18:00', partySize: 10, roomId: 'r2', customerId: 'c4', customerName: '陈先生', occasion: '公司聚餐', dishNames: ['醉排骨', '炒麦螺', '蒸大口鱼', '五花肉炒笋干', '绿笋炒嫩姜', '海竹酸辣汤', '海鲜炒地瓜粉扣', '时令果盘'], dietary: [], special: '', budget: 3500, budgetMode: 'table', createdBy: '老板', missing: ['忌口确认', '时令菜确认', '特殊安排确认'] })
    ];
    // 演示各种流程阶段：待配菜、待发客户、已确认
    const flowMap = { o1: 'confirmed', o2: 'confirmed', o3: 'manager', o4: 'confirmed', o5: 'manager', o6: 'confirmed', o11: 'boss' };
    orders.forEach((o) => {
      o.updatedAt = D.nowISO();
      const stage = flowMap[o.id] || ((o.dishes || []).length ? 'confirmed' : 'new');
      o.flow = { stage, at: o.updatedAt, by: '系统', history: [] };
      if (stage === 'confirmed') { o.menuConfirmed = true; o.menuConfirmedAt = o.updatedAt; }
    });
    orders.forEach((o) => { o.updatedAt = D.nowISO(); });
    S.orders = orders;
    S.rsvps = [{
      id: 'rs1', orderId: 'o2', inviteCode: 'INV-WANG88', guestName: '王太太',
      phone: '', attend: true, dietary: ['不吃香菜'], partySize: 1, submittedAt: D.nowISO(), source: 'invite'
    }];
    S.meta.onboarded = true;
    S.meta.seeded = true;
    S.meta.rev = 1;
    S.meta.updatedAt = D.nowISO();
    return S;
    }

  global.CJXDemo = { seedDemo: seedDemo };
})(window);
