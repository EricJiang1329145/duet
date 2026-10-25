# Duet 联机服务（Cloudflare Worker + Durable Object）

一个房间一个 Durable Object：它持有农场的唯一权威状态，客户端只发操作意图。空闲时 DO 使用 WebSocket Hibernation，状态留在 SQLite，下次有人打开时自动唤醒。

```text
浏览器 ── wss://duet.example.com/ws?room=MAIN&name=A|B ──┐
                                                        ▼
                                                Worker（路由 / 静态资源）
                                                        │
                                                        ▼
                                          Room DO（每房一个，最多 2 人）
                                          ├─ WebSocket Hibernation
                                          ├─ SQLite：plots / stats / inventory / world / seq
                                          ├─ presence 转发
                                          ├─ chat 同场景转发（不持久化）
                                          └─ 复用 src/game/farmRules.js
```

## 文件

```text
worker/
├── wrangler.jsonc        # 生产：public/ 静态资源 + 可选自定义域名
├── wrangler.dev.jsonc    # 本地：只挂 dev-assets/，避免 watcher 扫全仓
├── sync-public.sh        # 生成 public/（index.html + src + styles 的符号链接）
├── dev-assets/           # 本地开发用的精简资源（gitignored）
└── src/
    ├── index.js          # /login、/logout、/ws、/ping、/health、/hash、静态资源
    ├── auth.js           # 密语 verifier、HMAC 会话、Cookie、seat
    ├── identity.js       # clientId -> 玩家身份恢复
    ├── loginPage.js      # 服务端登录页
    ├── hashPage.js       # 密语摘要工具页
    ├── rateLimit.js      # token bucket
    ├── weather.js        # 固定深圳天气拉取/解析
    └── room.js           # Durable Object：权威农场、presence、SQLite
```

## 密语摘要工具

- `GET /hash`：输入原词的页面；`POST /hash`：返回 64 位 SHA-256 摘要。
- 原词不写入日志/数据库，也不回显；归一化为 NFC + trim，大小写敏感。
- A/B 各自生成摘要后，把摘要交给管理员保存为 Worker secret `SEAT_A_HASH` / `SEAT_B_HASH`；再设置 `SESSION_SECRET`（至少 16 字符，建议 32 字节随机值）。
- 登录已启用：`/login` 输入密语（明文输入框，支持中文/特殊字符），服务端用同一套 NFC + trim + SHA-256 逻辑比对；成功后签发 30 天 HttpOnly 签名 Cookie。A 密语 → A，B 密语 → B。
- `/ws` 和游戏页面都会校验会话；没有 Cookie 不能进入房间。同一 seat 在第二台设备登录会关闭旧连接（4001），旧端不再自动重连。

## 部署

```bash
cd /path/to/Duet
./worker/sync-public.sh
wrangler deploy --config worker/wrangler.jsonc
```

首次使用需要 `wrangler login`。`public/` 只包含 `index.html`、`src/`、`styles/`，**不要把仓库根目录直接当 assets**，否则 `worker/`、`docs/`、`node_modules/` 会被公开。

## 打开游戏

```text
https://duet.example.com/（正式，先登录）
```

两个人分别用 A/B 密语登录；A → A，B → B。房间只有服务端一种形态，两位玩家完全对等，没有房主/客人；DO 是中立权威。

本机调试用 `wrangler dev` 后直接打开它的地址即可（同域自动使用 `/ws`）：

```text
http://127.0.0.1:8787/login
```

如果静态页由 `npm start`（4173）提供，再补 `&ws=ws://127.0.0.1:8787/ws` 指向本地 Worker。

## 本地开发

```bash
./worker/sync-public.sh
wrangler dev --config worker/wrangler.dev.jsonc --port 8787 --local --live-reload false
# 打开 http://127.0.0.1:8787/login?net=server
```

`dev-assets/` 是指向 `index.html`、`src/`、`styles/` 的符号链接；这样 Wrangler 的 watcher 不会扫整个仓库（否则容易 EMFILE）。

## 身份恢复与限流

- 浏览器在 `sessionStorage` 保存稳定的 `client` id，并随连接发送 `?client=...`；房间鉴权由 HttpOnly 的 `duet_session` Cookie 决定。
- DO 的 `player_identity` 表按 `client_id` 保存 `player_id`、名字、场景、坐标与朝向；socket close 时落库。
- 刷新/断线后用同一 `client` 重连，会恢复同一 `player_id`、名字、场景和位置；同一 seat 在另一台设备登录会顶掉旧连接。
- welcome 里的 `scene` / `facing` / `spawn` 就是恢复后的位置，`resumed` 标记这次是否续上旧身份。
- 每连接 token bucket：presence 30 容量 / 15 每秒、act 6 / 2 每秒、chat 3 容量 / 0.6 每秒、ping 5 / 1 每秒、整体 90 / 45 每秒。
  - presence/ping 超限直接丢弃。
  - 农事超限返回 `reject`，`code` 为 `RATE_LIMITED`。
  - 聊天超限返回 `chat_ack`，`code` 为 `RATE_LIMITED`。
  - 整体超限以 close code `4008` 断开，避免单客户端刷爆 DO CPU。

## 农场 / 经济存储（v0.6）

- `room_state` 在 v0.3 的 `plots` / `stats` / `seq` 之外新增 `inventory`、`world` 两列；旧房启动时用 `ALTER TABLE` 补列。
- v0.10 厨房复用这两列：`inventory.produce` / `inventory.dishes`、`stats.cooked` / `stats.meals` / `stats.mealDay`、`world.meal`；旧行读取时自动补 0/null，不需要新增表。
- 旧房迁移：所有旧地块视为已开垦，缺金币时补 24；新房间前 6 块地可用、其余 6 块需金币开垦。
- v0.6 农场扩到 12 块地 `field_01`–`field_12`；旧存档/旧房由 `clonePlots()` 自动补齐，前 6 块默认已开垦，其余需金币。
- 农事可在 `outdoor` 或 `greenhouse`；购买温室后，11/12 号田通过 `plotSceneFor()` 路由到温室内部，静态 `PLOT_SCENE` 只作为未购买时的默认。
- 厨房动作 `COOK_DISH` / `SELL_DISH` / `SERVE_MEAL` / `EAT_MEAL` 也走 `act`，但在 `src/game/kitchen.js` 里校验，因此允许在 `indoor_1`；`SIT_MEAL` 是本地座位动作，只通过 presence 同步。
- v0.10.2 起 DO 按固定深圳坐标缓存 Open-Meteo 当前天气（5 分钟 TTL，失败 60 秒退避）；有玩家时 alarm 每 10 秒检查，空房每 5 分钟检查，空房下雨也会浇水。`snapshot` / `state` 带只读 `weather`；`RAIN_WATER` 优先按这份共享读数判定。
- 额外场景（meadow/dock/orchard/spring）由 `sceneRules.js` 处理解锁、每日采集与仓库出售；`inventory.goods` 会随 state 广播并由 DO 持久化。
- 二层装修同时支持 `BUY_DECOR` / `REMOVE_DECOR`，退款金额等于 `DECOR[id].cost`；家具仍由 DO 共享。
- `/` 的 `?preview=meadow|dock|orchard|spring` 与 `?solo=1` 一样不需要登录，只加载静态页面；它不会连接房间或 DO。
- `snapshot` / `state` 都带 `inventory.seeds`、`world.greenhouse` 与 `world.decor`；服务端复用 `validateFarmAction` / `applyFarmAction` 校验金币、种子、地块、杂草虫害与家具。
- 收获奖励（金币、种子回收、温室加成）由 `harvestReward()` 共享纯函数计算，避免两端漂移。

## 二层装修（v0.5）

- `BUY_DECOR` 的 `targetId` 是家具 id（`bed` / `rug` / `shelf` / `plant` / `lamp`）。
- 必须在 `indoor_2`、金币足够且未拥有；成功后扣金币并写 `world.decor[id] = true`。
- 家具是固定槽位，不做自由摆放；碰撞在客户端 `WALK_LAYOUTS.indoor_2` 预留。
- 没有新增 SQLite 表：家具复用 `world` JSON，随 `state` 广播和 welcome 快照同步。

## 聊天（v0.4）

- 客户端 `{ "t": "chat", "cid": "...", "text": "..." }`；DO 只发给同场景的另一位玩家，不写 SQLite。
- 回执：`{ "t": "chat_read", "id": "ch_..." }`；DO 用内存 outbox（30 秒、最多 64 条）匹配后转发 `chat_read` 给发送者。
- 发送确认：`{ "t": "chat_ack", "cid", "id", "delivered", "code" }`；`delivered: 0` 表示对方不在同一层或离线。
- 文本按字素簇截断到 60（`src/game/chat.js`），控制字符/双向覆盖字符会被清理；消息用 `textContent` 渲染。
- Hibernation 会丢失内存 outbox，此时回执不会到达，发送方保持“未读”，这是有意的严格取舍。

## 留言板存储

- `board_messages`：`id / author_id / author_name / text / created_at`，单条 140 字。
- `board_reads`：每玩家最后已读时间，welcome 时回传 `boardReadAt`。
- **只保留最近 180 天**：DO 加载时与发帖后（每小时最多一次）执行 `DELETE`；更早的留言不会出现在列表或导出里。
- welcome 只带最近 200 条，避免快照过大；`board_export` 单独查询 180 天内全量（上限 5000 条）供导出 Markdown。
- 发帖限流：2 条突发，之后每 2 秒 1 条；空内容与非客厅场景会被拒绝。

## 协议

客户端 → 服务端：

```jsonc
{ "v": 1, "t": "presence", "player": { "name": "A", "currentScene": "outdoor", "position": {"x": 0, "y": 0}, "facing": "south", "destination": null } }
{ "v": 1, "t": "act", "cid": "c1", "action": "PLANT_CROP", "targetId": "field_01", "payload": { "cropType": "radish" } }
{ "v": 1, "t": "act", "cid": "c2", "action": "BUY_SEED", "payload": { "cropType": "carrot", "count": 1 } }
{ "v": 1, "t": "chat", "cid": "ch1", "text": "你好 👋" }
{ "v": 1, "t": "chat_read", "id": "ch_..." }
{ "v": 1, "t": "board_read" }
{ "v": 1, "t": "board_export" }
{ "v": 1, "t": "ping", "c": 1792770000000 }
{ "v": 1, "t": "bye" }
```

服务端 → 客户端：

```jsonc
{ "v": 1, "t": "welcome", "selfId": "p_xxx", "room": "CODE", "seq": 0, "serverTime": 1792770000000, "name": "A", "scene": "outdoor", "facing": "south", "spawn": {"x": -1.35, "y": -0.15}, "resumed": false, "boardReadAt": 0, "snapshot": { "plots": {}, "stats": {}, "players": {}, "board": [] } }
{ "v": 1, "t": "presence", "player": { ... } }
{ "v": 1, "t": "state", "seq": 1, "plots": {}, "stats": {}, "inventory": { "seeds": {} }, "world": { "greenhouse": false }, "event": { "who": "p_xxx", "when": 0, "action": "PLANT_CROP", "targetId": "field_01" }, "notice": { "text": "...", "tone": "farm" } }
{ "v": 1, "t": "chat", "id": "ch_x", "from": "p_xxx", "name": "A", "text": "你好 👋", "at": 1792770000000 }
{ "v": 1, "t": "chat_ack", "cid": "ch1", "id": "ch_x", "delivered": 1, "code": null }
{ "v": 1, "t": "chat_read", "id": "ch_x", "from": "p_yyy", "at": 1792770001000 }
{ "v": 1, "t": "board", "messages": [{ "id": "m_x", "authorId": "p_xxx", "authorName": "A", "text": "晚安", "createdAt": 1792770000000 }] }
{ "v": 1, "t": "board_export", "messages": [] }
{ "v": 1, "t": "reject", "cid": "c1", "code": "NOT_READY", "message": "还没成熟，再等等。" }
{ "v": 1, "t": "pong", "c": 1792770000000, "s": 1792770000000 }
{ "v": 1, "t": "leave", "id": "p_xxx" }
{ "v": 1, "t": "error", "code": "ROOM_FULL", "message": "房间已满，目前最多两个人。" }
```

## 存储与重连

- SQLite 表 `room_state` 单行保存 `room_id`、`plots`、`stats`、`seq`、`updated_at`。
- 农事成功才写库；移动/朝向不写库。
- 刷新/断线重连会收到新的 `welcome` + 完整快照，农场恢复；玩家位置/场景按 `player_identity` 恢复，异常退出可能回退到最后一次落库的位置。
- 同一 `client` 重连会替换旧连接，避免“刷新后房间已满”。
- `cid` 幂等只在 DO 内存里保留最近 128 条；DO 被驱逐后去重历史会清空，但重复点击仍会被规则层拒绝。

## 限制

- 只有一个 MAIN 正式房间；旧 `?room=test` 也会归并到 MAIN，不能创建新房间。
- 每连接有 presence/act/chat/ping token bucket；act 超限返回 `RATE_LIMITED`，整体超限断开。
- `presence` 10Hz；只额外携带 `destination`（目标点），对方用同一套 A* 重建点状路径，不发送完整路径。
- `/ping` 只用于测延迟；`duet-ws.example.com` 的独立 ping Worker 仍保留。
