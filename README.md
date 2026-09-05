# 辩论赛计时与评分系统

基于 Nuxt 4 + Vue 3 + TypeScript + Prisma + SQLite 构建的全栈辩论赛计时评分系统，支持赛事管理、实时计时、积分统计、QQ Bot 联动、报名系统与辩题投票等功能。

## ✨ 核心功能

### 🎯 赛事管理

- **赛事创建与配置**：支持多种赛制（4v4、BP 等），自定义计时器环节、背景、界面、提示音、队徽
- **赛程管理**：手动添加 / 自动生成赛程，支持单败淘汰、循环赛等赛制
- **积分统计**：实时积分排名，支持多种评分规则
- **审计日志**：操作记录可追溯，软删除 + 恢复机制

### ⏱️ 实时计时

- **可视化计时器**：大屏展示，支持暂停/继续/重置/切换环节
- **WebSocket 实时推送**：多端同步倒计时状态
- **离线版**：纯前端离线可用版本

### 🤖 QQ Bot 联动

- **赛场创建与管理**：通过 QQ 频道 Bot 命令创建赛场
- **身份组管理**：自动管理辩手、评委身份组
- **实时播报**：比赛状态、比分实时推送至 QQ 频道
- **沙箱环境**：支持 BOT_SANDBOX 环境变量切换沙箱/正式环境

### 📝 报名系统

- **个人报名 & 队伍报名**：两种报名模式自由切换
- **免登录公开报名**：无需登录即可提交报名信息
- **自定义报名字段**：管理员可配置报名表单字段
- **自动组队调剂**：个人报名者可根据志愿位置自动匹配组队
- **辩手子账号生成**：批量生成 debater 角色账号，自动分配队伍

### 🗳️ 辩题投票

- **多投票创建**：支持多个辩题投票活动
- **实时投票统计**：投票结果实时更新
- **投票记录追溯**：每人投票记录可查

### 🔐 权限体系

| 角色               | 说明       | 权限                   |
| ------------------ | ---------- | ---------------------- |
| system_admin       | 系统管理员 | 全部读写               |
| admin（团队）      | 团队管理员 | 所属团队赛事读写       |
| subaccount（团队） | 团队子账号 | 所属团队赛事只读       |
| debater（团队）    | 辩手       | 所属团队赛事只读       |
| individual         | 个人用户   | 独立赛事（standalone） |

## 🛠️ 技术栈

| 层级     | 技术                                                    |
| -------- | ------------------------------------------------------- |
| 前端     | Nuxt 4 + Vue 3 + TypeScript + Nuxt UI v4 + Tailwind CSS |
| 后端     | Nuxt Server API Routes + Prisma ORM                     |
| 数据库   | SQLite（可切换 MySQL/PostgreSQL）                       |
| 实时通信 | WebSocket + 15s 轮询降级                                |
| 认证     | JWT + 单设备登录限制                                    |
| Bot      | QQ 官方 Bot API                                         |

## 📦 快速开始

### 环境要求

- Node.js >= 20（Nuxt 4 要求）
- npm / pnpm / yarn / bun

### 安装依赖

```bash
npm install
```

### 环境配置

复制环境变量示例文件并配置：

```bash
# .env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-jwt-secret-key"
INTERNAL_API_KEY="your-internal-api-key"
BOT_SANDBOX=true   # QQ Bot 沙箱模式，生产环境设为 false
```

### 数据库初始化

```bash
# 应用数据库 schema
npx prisma db push

# 生成 Prisma Client
npx prisma generate
```

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:3000`

### 默认账号

| 角色       | 用户名    | 密码     |
| ---------- | --------- | -------- |
| 系统管理员 | admin     | admin123 |
| 团队管理员 | teamadmin | team123  |

## 🏗️ 项目结构

```
├── app/                    # 前端应用
│   ├── layouts/            # 布局组件（default, tournament）
│   ├── pages/              # 页面路由
│   │   ├── tournaments/    # 赛事相关页面
│   │   ├── teams/          # 团队管理
│   │   ├── timer/          # 计时器项目
│   │   └── bot/            # QQ Bot 管理
│   ├── components/         # 通用组件
│   ├── composables/        # 组合式函数
│   ├── middleware/         # 路由中间件
│   ├── plugins/            # 插件
│   └── assets/             # 静态资源
├── server/                 # 后端服务
│   ├── api/                # API 路由
│   ├── lib/                # 核心库（Bot、JWT、Prisma 等）
│   └── utils/              # 工具函数
├── prisma/                 # 数据库 Schema
└── reference/              # 参考文档
```

## 📚 文档

- 部署说明：[DEPLOYMENT.md](file:///d:/Code/DebateTimer/DebateTimerV3/DEPLOYMENT.md)
- 代码 Wiki：[CODE_WIKI.md](file:///d:/Code/DebateTimer/DebateTimerV3/CODE_WIKI.md)
- Bot 内部 API 文档：[reference/BOT/内部API文档.md](file:///d:/Code/DebateTimer/DebateTimerV3/reference/BOT/内部API文档.md)

## 🔒 安全说明

- 生产环境务必配置 `JWT_SECRET` 和 `INTERNAL_API_KEY` 环境变量
- `.env` 文件包含敏感信息，已在 `.gitignore` 中排除
- SQLite 数据库文件（`*.db`）不会被提交到 Git
- 私钥、证书等敏感文件已在 `.gitignore` 中排除

## 📄 License

MIT
