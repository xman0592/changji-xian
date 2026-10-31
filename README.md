# 长季鲜 · 私厨会所预约及客情系统

给一家 3 个包厢（VIP1–VIP3）的「福安菜 × 厦门海鲜」私厨会所使用。
纯前端 PWA + 可选 Supabase 多人同步；手机浏览器打开，可加到桌面。

**线上地址**：https://xman0592.github.io/changji-xian/
**仓库**：https://github.com/xman0592/changji-xian

## 功能

- **聊天转订单**：粘贴客人微信聊天，自动识别日期、时间、人数、餐标、包厢、称呼、电话、忌口、口味、场景、指定菜；缺项提示。
- **提前预定主线**：待审核 → 审核通过并通知 → 已完成；改单自动回到待审核，包厢时间冲突提醒。
- **餐标智能配菜**：填人数 + 餐标（每桌/每位），按预算、时令、可预订天数、老客口味出 3 套菜单；客户指定菜会保留，再用剩余预算补齐。
- **老客口味记忆**：完成订单自动记录常点菜、口味偏好、常餐标、偏好包厢；二次预定时订单页弹提示，可一键「按记忆餐标配菜」。
- **时令菜品**：后厨每日 1 分钟点在售 / 需预订 / 下市；客人可打开只读菜单链接自己看。
- **熟客档案**：标签、忌口、口味、常点、到店记录、累计消费。
- **备货清单**：按日期汇总已确认订单的桌数、人数、菜品、忌口，复制微信文字或导出 CSV。
- **接待看板**：服务员手机看每桌时间、包厢、忌口、特殊安排、亲友回执，并勾选开台准备（碗碟 / 酒水扎壶 / 矿泉水）。
- **邀请函**：订单一键生成**微信邀请函长图**，保存后直接发微信，客人不用点链接就能看；需要在线回执时扫图片里的二维码。也保留 H5 链接，云端模式回执自动回写，本地模式生成回执码。
- **历史台账**：按客人、电话、菜品、日期检索。
- **数据安全**：本机自动快照 10 份，支持导出/导入 JSON 备份。
- **角色入口二维码**：每个角色一张二维码/链接，店员微信扫码直接进入对应身份，手机记住；不依赖认证公众号，可选 4 位密码。
- **多人同步**：Supabase 免费版，老板/店长/后厨/服务员登录同一账号共享数据。

## 目录

```
changji-xian/
├─ index.html              员工端应用
├─ menu.html               给熟客看的只读时令菜单（链接带菜单快照）
├─ invite.html             邀请函 + 亲友回执
├─ styles.css              应用样式
├─ data.js                 默认菜品/演示数据/聊天识别/餐标配菜
├─ sync.js                 Supabase REST 同步与登录
├─ app.js                  应用逻辑与页面
├─ qrcode.min.js           角色入口二维码生成（qrcodejs，MIT）
├─ manifest.webmanifest    PWA 配置
├─ sw.js                   离线缓存（发版时改 CACHE 版本）
├─ version.json            版本号
├─ icons/                  桌面图标
├─ supabase-setup.sql      多人同步建表 SQL
└─ 使用说明.md              给店里的一页纸说明
```

## 本地预览

```powershell
cd C:\Windows\system32\ccbots\changji-xian
python -m http.server 8765
```

打开 http://localhost:8765 。首次进入可选「载入示例数据」体验，或「从空白开始」。
直接双击 `index.html` 也能用，但 PWA 离线缓存需要 http(s)。

## 角色入口二维码

- 老板/店长在「更多 → 角色入口二维码」里生成四张：老板、店长、后厨、服务员。
- 每张二维码就是 `index.html?role=boss|manager|kitchen|service` 的链接；微信扫码后自动进入对应身份，手机 localStorage 记住，下次直接进入。
- 二维码里是普通网址，**不需要认证公众号、不需要后端**。它只是角色入口，不是微信实名认证；谁拿到链接都能进对应角色，建议给老板/店长设 4 位密码。
- 二维码根据当前打开地址生成。`localhost` / `file://` 生成的二维码手机扫不到，需要先部署到 GitHub Pages/自己的域名，或用电脑局域网 IP 打开后再生成。
- 真微信识别身份（知道扫码人是谁）才需要认证公众号/微信开放平台 + 后端换取 openid，本版本未接。

## 多人同步（Supabase 免费版）

1. 打开 https://supabase.com 注册并新建一个免费项目（区域选新加坡/东京都可以）。
2. 左侧 **SQL Editor** → New query → 粘贴 `supabase-setup.sql` 全文 → Run。
3. 左侧 **Authentication → Users → Add user**，建一个店员共用账号：
   - 邮箱：如 `staff@changjixian.com`（不需要真实收件）
   - 密码：设一个店里都知道的强密码
   - 勾选 **Auto Confirm User**
4. 左侧 **Project Settings → API**，复制：
   - Project URL（`https://xxxx.supabase.co`）
   - `anon` `public` key
5. 在 App 的「设置 → 多人同步」里填 URL、anon key、店员邮箱和密码 → 登录并同步。
6. 其他手机重复第 5 步，登录同一个账号即可。

> 权限设计：店员账号（authenticated）可读写全部数据；未登录的匿名访客只能**新增**亲友回执、只能读取两个公开视图（菜单和门店信息），读不到订单和客人资料。

> 本地已有示例/正式数据时，第一次登录会提示自动上传到云端（远端表为空时全量推送）。之后每 22 秒拉取一次，改动即时推送。

## 部署到 GitHub Pages（已上线）

当前已部署到 `xman0592/changji-xian`，Pages 从 `main` 根目录发布：
https://xman0592.github.io/changji-xian/

后续更新：
1. 改本目录文件。
2. 同时改 `version.json` 和 `sw.js` 里的 `CACHE` 版本号。
3. `git add . && git commit -m "..." && git push`，Pages 自动重建。
4. 手机联网重新打开即拿到新版。

发版：改内容后同时改 `version.json` 和 `sw.js` 里的 `CACHE` 版本号，再 push。

> 国内访问 GitHub Pages 偶尔慢；如果门店网络不稳定，可以用任意静态托管（Vercel/Cloudflare Pages/自己的服务器）放同一套文件。

## 数据与备份

- 本机数据：localStorage `cjx_state_v1`；快照 `cjx_snaps_v1`（最近 10 份）；同步配置 `cjx_sync_v1`。
- 换手机、清理缓存前：设置 → 数据安全 → 导出备份。
- 新手机：导入备份，再登录同步账号。
- 微信里打开和桌面 PWA 的 localStorage 是两套，固定用一种方式打开。

## 换菜系 / 改菜单

默认菜品来自 `D:\长季鲜\福安特色菜.xls` 的 40 道福安特色菜，另加 3 道基础配菜（时令时蔬、蒜蓉时蔬、时令果盘）保证配菜完整；小吃只有「穆阳花饺」，没有福安炖罐。菜价是参考价，第一次使用请在「时令菜」里按实际采购改。

将来做其他菜系：

1. 设置 → 门店信息 → 改「菜系」和「经营定位」。
2. 准备一个菜品 JSON 数组（字段：`name`、`category`、`price`、`status`、`leadDays`、`tags`、`flavor`、`note`），在设置 → 数据安全 → 导入新菜系。
3. 导入会替换菜品库，不影响历史订单里的菜名和价格。

菜品字段说明：

- `category`：冷菜 / 热菜 / 汤 / 主食 / 甜品
- `status`：`on` 在售、`preorder` 需提前预订、`off` 下市
- `leadDays`：需提前几天（仅 `preorder` 生效）
- `tags`：忌口过滤用，如 `海鲜`、`素`、`猪`、`牛`、`辣`、`蛋`、`坚果`
- `flavor`：口味匹配用，如 `清淡`、`鲜`、`清蒸`、`红糟`、`沙茶`、`滋补`、`浓`、`甜`

## 测试

已用 Playwright（390×844 / DPR2）走查主要路径。测试脚本在本目录：

```powershell
python -m http.server 8765
python tests\_test_changji.py     # 主流程：聊天识别 → 餐标配菜 → 审核 → 看板 → 邀请函 → 菜单
python tests\_test_changji2.py    # 首次引导、角色密码、熟客、台账、持久化
python tests\_test_service_checks.py  # 服务员开台准备（碗碟/酒水扎壶/矿泉水）
python tests\_test_role_qr.py     # 角色入口二维码、角色链接、密码
python tests\_mock_supabase.py    # 另开终端，假 Supabase 服务（8799）
python tests\_test_changji3.py    # 多人同步、云端回执回写、云端实时菜单
```

## 已知限制

- 本地模式不跨设备；多人同时用必须配置 Supabase。
- 聊天识别是规则 + 可选 AI JSON，识别结果必须人工核对。
- 菜品价格按“一桌/一份”估算，实际按门店定价调整。
- PIN 只防误触，不是账号安全体系。
- 邀请函在本地模式不会自动回写，需要把回执码复制回订单。
