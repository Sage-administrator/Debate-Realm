# 辩论赛计时系统

Nuxt 3 + Vue 3 + Prisma + SQLite

## Setup

### 数据库迁移（首次部署必读）

本轮改动新增了 Match 表和 TournamentTeam 表的多个字段（版本号、软删除标志、晋级溯源、积分统计等。
**部署前请先阅读详细部署说明**：

📖 [DEPLOYMENT.md](file:///d:/Code/DebateTimer/DebateTimerV3/DEPLOYMENT.md)

**核心流程速览**：

```bash
# 1. 备份数据库（重要！）
Copy-Item prisma\dev.db prisma\dev.db.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')

# 2. 应用 schema 变更
npx prisma db push

# 3. 启动服务
npm run dev    # 开发
npm run build && npm run preview    # 生产
```

---

## 安装依赖

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
