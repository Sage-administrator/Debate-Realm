# 🗄️ 数据库迁移与部署说明书

> **适用范围**：部署含以下新增字段的数据库版本
> - `Match` 表：`version`、`deletedAt`、`deletedBy`、`deleteReason`、`promotedFromA`、`promotedFromB`、`isBye`
> - `Match` 表：`judge`（评委姓名字段）
> - `TournamentTeam` 表：`points`、`wins`、`draws`、`losses`、`scoreFor`、`scoreAgainst`
> - 新增索引：`[tournamentId, points]`、`[tournamentId, groupLabel, points]`

---

## 📋 目录

1. [操作概览](#1-操作概览)
2. [前置条件](#2-前置条件)
3. [开发环境部署（推荐）](#3-开发环境部署推荐)
4. [生产环境部署（严格按此顺序）](#4-生产环境部署严格按此顺序)
5. [迁移失败的回滚方案](#5-迁移失败的回滚方案)
6. [常见问题 FAQ](#6-常见问题-faq)

---

## 1. 操作概览

### 为什么需要执行迁移？

本轮改动新增了 `version`（乐观锁）、`deletedAt`（软删除）、`promotedFromA/B`（晋级溯源）等字段，以及积分榜相关字段。这些字段需要在数据库中真实存在，后端 API 才能正常写入和读取。

### 用哪种方式？

| 方式 | 适用场景 | 命令 |
|------|----------|------|
| `prisma db push` | **开发环境 / 首次部署 / SQLite** | `npx prisma db push` |
| `prisma migrate dev` | **团队协作 / 需保留迁移历史** | `npx prisma migrate dev --name add_match_metadata_and_standings` |

> **本项目当前是 SQLite 数据库，推荐优先使用 `db push`**。SQLite 对 ALTER TABLE 的支持有限，`db push` 会自动处理表重建和数据迁移。

---

## 2. 前置条件

### ✅ 部署前检查清单

- [ ] **数据库文件存在**：确认 `prisma/dev.db`（或实际使用的 `.db` 文件）存在
- [ ] **已停止服务**：确保 noxut 应用已停止（Ctrl+C），迁移期间不要有写入操作
- [ ] **备份！备份！备份！**：见下文 [生产环境部署](#4-生产环境部署严格按此顺序) 备份步骤
- [ ] **依赖已安装**：`npm install` 已执行过，prisma 命令可用

### 检查 Prisma 是否可用

```powershell
# 在项目根目录执行
npx prisma --version
```

应输出类似：
```
prisma                  : 5.x.x
@prisma/client          : 5.x.x
```

---

## 3. 开发环境部署（推荐）

### 步骤 1：停止服务

如果 Nuxt 开发服务正在运行，先 Ctrl+C 停止。

### 步骤 2：应用 Schema 变更

在项目根目录 `D:\Code\DebateTimer\DebateTimerV3\` 执行：

```powershell
npx prisma db push
```

**预期输出**（首次执行）：
```
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": SQLite database

The database is already in sync with the Prisma schema.

Your database is now in sync with your schema. Done in 2.19s

✔ Generated Prisma Client (5.x.x library) to ./server/lib/generated in 256ms
```

**或这样输出**（有字段变更时）：
```
...
Added 6 new columns and 2 indexes to the tables "Match" and "TournamentTeam".
```

### 步骤 3：验证字段生效

```powershell
npx prisma studio
```

浏览器会打开数据库可视化工具，检查：
- **Match** 表：能看到 `version`、`deletedAt`、`deletedBy`、`deleteReason`、`promotedFromA`、`promotedFromB`、`isBye`、`judge` 字段
- **TournamentTeam** 表：能看到 `points`、`wins`、`draws`、`losses`、`scoreFor`、`scoreAgainst` 字段
- 已有的比赛记录 `version` 自动为 `1`，`isBye` 自动为 `false`

在浏览器中按 `Ctrl+C` 停止 prisma studio。

### 步骤 4：启动应用

```powershell
npm run dev
```

打开 `http://localhost:3000`，测试：
1. 创建一场赛事 → 进入赛程管理
2. 添加几场比赛 → 点击"录分"
3. 删除一场比赛 → 比赛变灰显示"已删除"徽章 → 点击"恢复"能恢复
4. 观察积分榜（循环赛模式）数据正确累计

---

## 4. 生产环境部署（严格按此顺序）

### ⚠️ 重要：先备份

**步骤 0** — 备份数据库文件

```powershell
# 在项目根目录执行
# 将 dev.db（或实际生产用的 .db 文件）复制一份带时间戳的副本
Copy-Item "prisma\dev.db" "prisma\dev.db.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

# 确认备份文件存在
Get-ChildItem prisma\*.db* | Sort-Object LastWriteTime -Descending | Select-Object -First 3
```

**预期输出**：
```
Mode    LastWriteTime         Name
----    -------------         ----
-a---   2026-06-18 10:30     dev.db.backup_20260618_103000
-a---   2026-06-18 10:00     dev.db
```

> 如果使用的是 MySQL/PostgreSQL，使用对应的 `mysqldump` 或 `pg_dump` 命令导出。

### 步骤 1：停止生产服务

根据你的部署方式停止应用：
- **PM2**：`pm2 stop debate-timer`
- **Systemd**：`sudo systemctl stop debate-timer`
- **进程管理**：找到并结束 Nuxt 进程

### 步骤 2：应用 Schema 变更

```powershell
# 生产环境用 db push 更安全
npx prisma db push
```

如果希望保留完整迁移历史（**推荐用于长期维护的生产环境**）：

```powershell
# 首次使用 migrate 时，需先初始化迁移记录
npx prisma migrate dev --name add_match_metadata_and_standings

# 之后生产部署用：
npx prisma migrate deploy
```

### 步骤 3：验证迁移成功

```powershell
# 查看数据库表结构确认字段存在
npx prisma db pull  # 从数据库反向同步 schema，确认不会报错
```

输出应包含：
```
The database introspection was successful.
```

### 步骤 4：启动生产服务

```powershell
npm run build
# 然后按你的部署方式启动（PM2 / Docker / 直接 npm run preview 等）
```

### 步骤 5：冒烟测试

启动后快速验证以下功能：
- [ ] 登录正常
- [ ] 赛事列表正常加载
- [ ] 进入某场赛事的赛程管理，旧比赛记录正常显示
- [ ] 新增比赛、录分、删除、恢复操作均正常
- [ ] 积分榜（如有）数据正确

---

## 5. 迁移失败的回滚方案

### 场景 A：db push 报错，数据库尚未修改

**不需要回滚**，解决报错后重新执行即可。常见报错及解决：

| 报错信息 | 原因 | 解决 |
|----------|------|------|
| `Error: P1001: Can't reach database server` | 数据库文件路径错误或权限问题 | 检查 `.env` 中 `DATABASE_URL` 路径是否正确 |
| `Error: Schema parsing` | schema.prisma 语法错误 | 检查文件中 `model Match` 和 `model TournamentTeam` 的字段定义是否正确 |

### 场景 B：db push 已执行，但应用启动后报错

**立即回滚**：
1. 停止应用服务
2. 从备份恢复数据库文件：
   ```powershell
   # 删除当前（可能损坏的）数据库文件
   Remove-Item prisma\dev.db

   # 从备份恢复（替换为你的备份文件名）
   Copy-Item "prisma\dev.db.backup_20260618_103000" prisma\dev.db
   ```
3. 将代码回滚到上一个稳定版本（git checkout 上一个 commit）
4. 重启服务，验证功能正常
5. 联系开发人员排查问题

### 场景 C：旧数据显示异常但没报错

如果旧的比赛记录在赛程页显示异常（如某些字段缺失）：
1. 这通常是**前端兼容性问题**，不是数据库损坏
2. 打开浏览器开发者工具（F12）→ Console 查看 JavaScript 报错
3. 截图报错信息发给开发人员

---

## 6. 常见问题 FAQ

### Q1：执行 `npx prisma db push` 时提示 "Database is already in sync"

**A**：这是正常现象。如果之前已经执行过 push，或数据库已包含这些字段，Prisma 会识别到无需修改。继续启动应用即可。

### Q2：`npx prisma` 命令找不到？

**A**：先执行 `npm install` 安装依赖，确保 `node_modules` 目录存在。

### Q3：db push 过程中卡在某个步骤，能中途 Ctrl+C 吗？

**A**：**SQLite 场景**可以，因为 SQLite 的表重建是在事务中执行的，失败会自动回滚。但建议执行前先备份，以防万一。

### Q4：为什么不直接改数据库文件？

**A**：Prisma 有自己的 schema 描述语言，直接手动改数据库文件会导致 Prisma Client 与数据库不同步，引发类型错误。始终通过 `prisma db push` 或 `prisma migrate` 来变更。

### Q5：新增字段对已有数据有影响吗？

**A**：**没有破坏性影响**：
- `version` 默认值 `1` → 所有旧记录自动获得 version=1
- `deletedAt`、`deletedBy`、`deleteReason` 默认为 `null` → 旧记录视为"未删除"
- `promotedFromA`、`promotedFromB` 默认为 `null` → 旧记录没有晋级溯源信息（但不影响读取，仅新晋级的比赛会记录）
- `isBye` 默认值 `false` → 旧记录视为"非轮空场"
- `points`、`wins` 等积分榜字段默认 `0` → 首次显示积分榜时，前端的实时计算会自动填充显示

### Q6：以后再改 schema 怎么办？

**A**：每次新增/修改字段后，按如下流程：
1. 更新 `prisma/schema.prisma`
2. 备份数据库
3. 执行 `npx prisma db push`
4. 重启应用

### Q7：积分榜数据需要手动迁移吗？

**A**：**不需要**。`TournamentTeam` 的积分字段默认为 0，前端 [StandingsTable.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/StandingsTable.vue) 组件会基于已完赛的 `matches` 记录实时计算积分排名，始终准确。后端写入 TournamentTeam 仅用于优化查询性能和支持未来的"手动调整积分"功能。

---

## 7. Docker 部署（推荐用于消除平台差异）

### 为什么用 Docker？

本项目的 Windows 构建需要 3 层补丁（`os.tmpdir()` 路由 / libSQL 原生模块 / `_entry.js` 缺盘符），Docker 提供一个标准化的 Linux 环境，一次性消除所有平台差异，确保构建结果在任何机器上一致。

### 前置条件

- Docker Desktop（Windows/Mac）或 Docker Engine（Linux）
- 项目已同步到最新版本

### 步骤 1：构建镜像

```powershell
docker compose build
```

或手动构建：

```powershell
docker build -t debate-timer:latest .
```

### 步骤 2：启动容器

```powershell
docker compose up -d
```

验证启动：浏览器打开 `http://localhost:3000`

### 步骤 3：数据库迁移

首次部署或 schema 变更后，进入容器执行：

```powershell
docker compose exec debate-timer npx prisma db push
```

### 步骤 4：管理命令

```powershell
# 查看日志
docker compose logs -f debate-timer

# 停止
docker compose down

# 重建（代码改动后）
docker compose up -d --build

# 进入容器调试
docker compose exec debate-timer sh
```

### 环境变量管理

创建 `.env` 文件（不含明文密钥的 `.env.example` 已在仓库中，参考其格式）：

```ini
JWT_SECRET=your-strong-secret-key
INTERNAL_API_KEY=your-internal-api-key
DATABASE_URL=file:./prisma/data/dev.db
```

挂载方式（`docker-compose.yml` 已预配置）：
```yaml
# 取消注释以下行
# - ./.env:/app/.env:ro
```

### 数据持久化

SQLite 数据库文件通过 Docker Volume 挂载到宿主机 `./prisma/data/`：

```
宿主机: ./prisma/data/dev.db
容器内: /app/prisma/data/dev.db
```

备份：直接复制 `prisma/data/dev.db`
恢复：停止容器 → 覆盖 `prisma/data/dev.db` → `docker compose up -d`

---

## 📎 命令速查（PowerShell）

```powershell
# === 备份 ===
Copy-Item prisma\dev.db prisma\dev.db.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')

# === 应用 schema 变更 ===
npx prisma db push

# === 查看数据库 ===
npx prisma studio

# === 确认 prisma 版本 ===
npx prisma --version

# === 构建应用 ===
npm run build

# === 启动开发服务 ===
npm run dev
```

---

**如有疑问**，请参考 [prisma/schema.prisma](file:///d:/Code/DebateTimer/DebateTimerV3/prisma/schema.prisma) 的字段定义，或联系开发人员。
