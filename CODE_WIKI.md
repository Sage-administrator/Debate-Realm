# DebateTimer V3 - Code Wiki

> 辩论赛计时系统完整技术文档
> 生成日期: 2026-07-02

---

## 目录

1. [项目概述](#项目概述)
2. [整体架构](#整体架构)
3. [技术栈](#技术栈)
4. [数据库设计](#数据库设计)
5. [核心模块职责](#核心模块职责)
6. [关键类与函数](#关键类与函数)
7. [API接口说明](#api接口说明)
8. [前端组件架构](#前端组件架构)
9. [权限系统详解](#权限系统详解)
10. [报名系统详解](#报名系统详解)
11. [依赖关系图谱](#依赖关系图谱)
12. [项目运行方式](#项目运行方式)
13. [开发指南](#开发指南)
14. [部署指南](#部署指南)

---

## 项目概述

### 项目定位
DebateTimer V3 是一个专业的辩论赛计时管理系统，集成了计时器、赛程管理、QQ频道机器人、权限控制、报名系统等核心功能。

### 核心功能
- **辩论计时器**: 支持单计时器、双计时器、特殊环节等多种计时模式
- **赛程管理**: 单败淘汰、双败淘汰、循环赛、佩寄制、瑞士制、小组+淘汰赛等6种赛制
- **权限控制**: system_admin、团队admin、团队subaccount、debater、individual 五级权限体系
- **QQ Bot集成**: 频道内身份认领、赛场管理、赛程查询、辩题推送等机器人功能
- **实时预览**: 配置页面实时预览计时器视觉效果（16:9比例，左侧预览右侧配置）
- **报名系统**: 支持个人报名与队伍报名，免登录公开报名+登录用户报名两种模式
- **自动组队**: 个人报名者可选择调剂，系统自动匹配组队
- **辩手子账号**: 为报名成员批量创建debater角色子账号（只读权限）

---

## 整体架构

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户界面层 (Vue 3)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 计时器页面 │  │ 赛程管理 │  │ Bot管理  │  │ 报名系统 │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP/WebSocket API
┌──────────────────────┴──────────────────────────────────────────┐
│                        业务逻辑层 (Nuxt Server)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 权限控制  │  │ 赛程生成 │  │ Bot管理  │  │ 报名系统 │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ Prisma ORM
┌──────────────────────┴──────────────────────────────────────────┐
│                        数据持久层 (SQLite)                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  赛事表   │  │  比赛表   │  │  团队表   │  │  报名表   │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                      QQ Bot WebSocket连接                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ QQ Gateway│  │ 消息处理  │  │ 身份管理 │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

### 目录结构

```
DebateTimerV3/
├── app/                    # 前端应用
│   ├── components/         # Vue组件
│   ├── pages/              # 页面路由
│   │   ├── tournaments/    # 赛事相关页面
│   │   │   └── [id]/
│   │   │       ├── register.vue      # 公开报名页
│   │   │       └── registrations.vue # 报名管理页
│   │   ├── timer/          # 计时器页面
│   │   ├── bot/            # Bot管理
│   │   └── teams/          # 团队管理
│   ├── composables/        # Vue组合式函数
│   │   ├── useAuth.ts      # 认证管理
│   │   ├── useTournament.ts # 赛事管理
│   │   ├── useRegistration.ts # 报名系统
│   │   ├── useTeam.ts      # 团队管理
│   │   └── useBotWs.ts     # Bot WebSocket
│   ├── stores/             # Pinia状态管理
│   │   ├── auth.ts         # 认证状态
│   │   └── debate.ts       # 计时器状态
│   ├── middleware/         # 路由中间件
│   │   └── auth.global.ts  # 全局认证中间件
│   ├── plugins/            # Nuxt插件
│   │   ├── auth.client.ts  # 客户端认证
│   │   └── auth-fetch.client.ts # 认证fetch封装
│   └── data/               # 静态数据
├── server/                 # 后端服务
│   ├── api/                # REST API路由
│   │   ├── auth/           # 认证接口
│   │   ├── tournaments/    # 赛事接口
│   │   ├── teams/          # 团队接口
│   │   ├── bot/            # Bot接口
│   │   ├── matches/        # 比赛接口
│   │   ├── admin/          # 管理员接口
│   │   ├── internal/       # 内部接口
│   │   ├── timer/          # 计时器接口
│   │   └── standalone-matches/ # 独立比赛
│   ├── lib/                # 核心库
│   │   ├── generated/      # Prisma生成代码
│   │   ├── bot-ws.ts       # Bot WebSocket核心
│   │   ├── bot-manager.ts  # Bot多团队管理
│   │   ├── bot-handlers.ts # Bot消息处理
│   │   ├── bot-roles.ts    # Bot身份管理
│   │   ├── bot-permissions.ts # Bot权限控制
│   │   ├── bot-scoring.ts  # Bot计分
│   │   ├── bot-notifications.ts # Bot通知
│   │   ├── bot-data-sync.ts # Bot数据同步
│   │   ├── bot-http.ts     # Bot HTTP API
│   │   ├── jwt.ts          # JWT认证
│   │   └── prisma.ts       # 数据库连接
│   ├── utils/              # 工具函数
│   │   ├── auth.ts         # 权限认证
│   │   ├── tournament-auth.ts # 赛事权限
│   │   ├── bracket-generator.ts # 赛程生成算法
│   │   ├── id.ts           # ID生成器
│   │   └── internal-auth.ts # 内部认证
│   ├── db/                 # 数据库相关
│   │   └── seed.ts         # 种子数据
│   └── plugins/            # 服务端插件
│       └── bot.ts          # Bot启动插件
├── prisma/                 # 数据库配置
│   └── schema.prisma       # 数据模型定义
├── public/                 # 静态资源
└── reference/              # 参考文档
```

---

## 技术栈

### 前端技术栈
- **框架**: Nuxt 4.4.8 + Vue 3.5.35
- **UI库**: Nuxt UI v4 (基于Tailwind CSS)
- **状态管理**: Pinia 3.0.4
- **路由**: Vue Router 5.1.0
- **图标**: @iconify-json/lucide (Lucide图标集)
- **字体**: SourceHanSerifCN-Heavy (思源宋体)、Digiface (数码字体)、digital-7-mono

### 后端技术栈
- **框架**: Nuxt Server (Nitro)
- **ORM**: Prisma 7.8.0
- **数据库**: SQLite (通过 @libsql/client)
- **认证**: JWT (jsonwebtoken 9.0.3) + bcryptjs 3.0.3
- **WebSocket**: ws 8.21.0
- **OpenAPI**: Nitro 内置 OpenAPI 支持

### Bot集成
- **QQ Bot API**: https://api.sgroup.qq.com
- **沙箱环境**: https://sandbox.api.sgroup.qq.com
- **环境切换**: BOT_SANDBOX 环境变量控制
- **Intents**: PUBLIC_GUILD_MESSAGES, GUILDS

---

## 数据库设计

### 核心数据表 (21个)

#### 1. 用户与团队管理

**User表** - 用户账户
```prisma
model User {
  id           String   @id @default(uuid())
  username     String   @unique
  password     String   // bcrypt加密
  teamId       String?
  role         String   @default("individual")
  // system_admin / admin / subaccount / debater / individual
  mode         String   @default("individual") // qq_bot / individual
  tokenVersion Int      @default(0) // 单设备登录控制
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  team              Team?             @relation(fields: [teamId], references: [id])
  teamMemberships   TeamMember[]
  standaloneMatches StandaloneMatch[]
  loginSessions     UserLoginSession[]
  timerProjects     DebateTimerProject[]
  registrations     Registration[]    // 用户提交的报名记录
}
```

**Team表** - 团队组织
```prisma
model Team {
  id           String   @id @default(uuid())
  name         String
  adminId      String
  mode         String // qq_bot / individual
  botAppId     String? // QQ Bot App ID
  botAppSecret String? // QQ Bot Secret
  botChannelId String? // 默认子频道
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  members     TeamMember[]
  tournaments Tournament[]
  users       User[]
  arenas      BotArena[]
}
```

**TeamMember表** - 团队成员关系
```prisma
model TeamMember {
  id        String   @id @default(uuid())
  teamId    String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([teamId, userId])
}
```

#### 2. 赛事管理

**Tournament表** - 赛事主表
```prisma
model Tournament {
  id              String    @id @default(uuid())
  teamId          String
  name            String
  description     String?
  format          String    @default("knockout")
  status          String    @default("pending")
  scheduledAt     DateTime?
  venue           String?

  // 辩论赛特有配置
  groupCount        Int?    // 分组数
  promotePerGroup   Int?    // 每组晋级数
  topicPool         String? // 辩题库（JSON数组）
  bestDebaterMode   String  @default("both") // both / winner_only
  assignments       String? // 抽签结果缓存

  // 报名系统配置
  registrationOpen     Boolean   @default(false) // 是否开放报名
  registrationDeadline DateTime?                  // 报名截止时间
  isPublic             Boolean   @default(false) // 是否公开（免登录报名）
  teamSize             Int?                       // 队伍人数要求
  registrationInfo     String?   // 报名须知

  team              Team                @relation(fields: [teamId], references: [id])
  teams             TournamentTeam[]
  judges            TournamentJudge[]
  matches           Match[]
  timerTemplate     TimerTemplate?
  timerProject      DebateTimerProject?
  scores            MatchScore[]
  registrations     Registration[]
  regFields         RegistrationField[]
}
```

**TournamentTeam表** - 参赛队伍
```prisma
model TournamentTeam {
  id           String @id @default(uuid())
  tournamentId String
  name         String
  groupLabel   String? // A组/B组
  seed         Int?    // 种子编号
  // 积分与排名
  points      Int  @default(0)
  wins        Int  @default(0)
  draws       Int  @default(0)
  losses      Int  @default(0)
  scoreFor    Int  @default(0)
  scoreAgainst Int @default(0)

  tournament Tournament @relation(fields: [tournamentId], references: [id], onDelete: Cascade)

  @@index([tournamentId])
  @@index([tournamentId, points])
  @@index([tournamentId, groupLabel, points])
}
```

**TournamentJudge表** - 评委列表
```prisma
model TournamentJudge {
  id           String @id @default(uuid())
  tournamentId String
  name         String
}
```

**Match表** - 比赛场次
```prisma
model Match {
  id                String    @id @default(uuid())
  tournamentId      String?
  standaloneMatchId String?
  round             String    // 第1轮/半决赛/决赛
  orderNum          Int       // 场次序号
  teamA             String?
  teamB             String?
  winner            String?
  scoreA            Int       @default(0)
  scoreB            Int       @default(0)
  status            String    @default("pending")
  scheduledAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // 辩论赛特有字段
  topic           String? // 当前比赛的辩题
  affirmativeSide String? // teamA / teamB —— 哪支队伍是正方
  bestDebaterA    String? // 正方最佳辩手
  bestDebaterB    String? // 反方最佳辩手
  judge           String? // 评委姓名

  // 版本控制与软删除
  version        Int       @default(1) // 乐观锁
  deletedAt      DateTime? // 软删除
  deletedBy      String?
  deleteReason   String?

  // 晋级溯源
  promotedFromA  String?   // teamA 来自哪场比赛的胜者
  promotedFromB  String?   // teamB 来自哪场比赛的胜者
  isBye          Boolean   @default(false)

  tournament      Tournament?           @relation(...)
  standaloneMatch StandaloneMatch?      @relation(...)
  assignedMembers MemberAssignedMatch[]
  timer           Timer?
  scores          MatchScore[]
}
```

**MatchScore表** - 评委评分
```prisma
model MatchScore {
  id            String   @id @default(uuid())
  matchId       String
  tournamentId  String
  judgeName     String
  dimensions    String   // JSON: [{"name":"逻辑","score":8},...]
  reason        String?  // 评分理由
  scoreTeamA    Int      // A队总分
  scoreTeamB    Int      // B队总分
  winner        String   // teamA / teamB / draw
  bestDebaterA  String?  // A队最佳辩手
  bestDebaterB  String?  // B队最佳辩手
  createdAt     DateTime @default(now())

  @@unique([matchId, judgeName]) // 同一评委对同一比赛只能评一次
}
```

#### 3. 报名系统

**Registration表** - 报名记录主表
```prisma
model Registration {
  id            String    @id @default(uuid())
  tournamentId  String
  type          String    // "individual" | "team"
  status        String    @default("pending")
  // pending | approved | rejected
  userId        String?   // 关联登录用户（免登录报名时为null）
  teamName      String?   // 队伍报名时的队伍名称
  submitterName String    // 报名提交人姓名
  contactPhone  String    // 联系电话
  contactEmail  String?   // 联系邮箱
  notes         String?   // 报名备注
  customData    String?   // JSON: 自定义字段数据
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  reviewedAt    DateTime? // 审核时间
  reviewedBy    String?   // 审核人 userId
  reviewNote    String?   // 审核备注
  convertedTeamId String? // 审核通过后转为参赛队伍的 TournamentTeam.id
  accountCreated Boolean  @default(false) // 是否已为辩手创建子账号

  tournament Tournament            @relation(...)
  user       User?                 @relation(...)
  members    RegistrationMember[]
}
```

**RegistrationMember表** - 报名成员
```prisma
model RegistrationMember {
  id              String   @id @default(uuid())
  registrationId  String
  name            String   // 成员姓名
  preferredPosition String? // 首选辩位：一辩/二辩/三辩/四辩/不限
  experience      String?   // 辩论经验描述
  userId          String?   // 创建子账号后的系统用户 ID
  createdAt       DateTime @default(now())

  registration Registration @relation(...)
}
```

**RegistrationField表** - 自定义报名字段配置
```prisma
model RegistrationField {
  id           String   @id @default(uuid())
  tournamentId String
  fieldName    String   // 字段显示名称（中文标签）
  fieldKey     String   // 字段键名（英文标识）
  fieldType    String   @default("text")
  // text | textarea | select | checkbox | radio
  fieldOptions String?  // JSON: 选项列表
  required     Boolean  @default(false)
  sortOrder    Int      @default(0)
  appliesTo    String   @default("both")
  // individual | team | both

  tournament Tournament @relation(...)
}
```

#### 4. 计时器管理

**DebateTimerProject表** - 计时器项目
```prisma
model DebateTimerProject {
  id               String            @id @default(uuid())
  userId           String
  tournamentId     String?           @unique
  name             String
  title            String   // 比赛标题（显示用）
  positiveTopic    String?  // 正方辩题
  negativeTopic    String?  // 反方辩题
  teamPositiveName String?  // 正方队伍名称
  teamNegativeName String?  // 反方队伍名称
  uiConfig         String?  // JSON界面配置
  skinConfig       String?  // JSON背景配置
  audioConfig      String?  // JSON提示音配置
  teamLogoConfig   String?  // JSON队徽配置
  stages           DebateTimerStage[]
}
```

**DebateTimerStage表** - 计时器环节
```prisma
model DebateTimerStage {
  id               String   @id @default(uuid())
  projectId        String
  name             String   // 环节名称
  duration         Int      // 主时长（秒）
  type             String   // speech / question / summary / special / dual-timer
  description      String?
  orderIndex       Int
  positiveDuration Int?     // 双计时器：正方时长
  negativeDuration Int?     // 双计时器：反方时长
  allowedRoles     String?  // JSON：允许的角色
}
```

**Timer表** - 运行时计时器状态
```prisma
model Timer {
  id           String   @id @default(uuid())
  matchId      String?  @unique
  matchType    String
  topicPro     String
  topicCon     String
  phases       String   // JSON: 环节配置
  currentPhase Int      @default(0)
  proRemaining Int      @default(0)
  conRemaining Int      @default(0)
  proRunning   Boolean  @default(false)
  conRunning   Boolean  @default(false)
}
```

**TimerTemplate表** - 计时器模板
```prisma
model TimerTemplate {
  id           String   @id @default(uuid())
  tournamentId String   @unique
  phases       String   @default("[]")
}
```

#### 5. QQ Bot管理

**BotArena表** - Bot赛场
```prisma
model BotArena {
  id          String   @id @default(uuid())
  teamId      String
  name        String   @default("") // 赛场名称，如"赛场A"
  matchFormat String   @default("4v4")
  status      String   @default("active") // active / closed
  guildId     String?  // QQ频道ID（赛场所在频道）
  channelId   String?  // QQ子频道ID（消息来源，主键）
}
```

**BotArenaRole表** - 赛场身份组
```prisma
model BotArenaRole {
  id         String   @id @default(uuid())
  arenaId    String
  label      String   // 正方一辩、反方二辩、评委
  side       String   // affirmative / negative / judge / audience
  orderIndex Int      // 发言顺序
  qqRoleId   String?  // QQ频道身份组ID
  maxCount   Int      @default(1)
}
```

**BotArenaClaim表** - 身份认领记录
```prisma
model BotArenaClaim {
  id        String   @id @default(uuid())
  arenaId   String
  roleId    String
  userId    String   // QQ用户ID
  username  String   // QQ用户名
  guildId   String   // QQ频道ID

  @@unique([arenaId, roleId, userId])
}
```

**BotPermissionLog表** - 权限操作日志
```prisma
model BotPermissionLog {
  id         String   @id @default(uuid())
  teamId     String
  guildId    String
  channelId  String
  action     String   // ROUND_SWITCH_ALLOW / DENY / RESET_ALL 等
  targetType String   // role / user
  targetId   String
  targetName String
  operator   String   // system / timer_system / admin / auto_timer
  detail     String
}
```

#### 6. 会话管理

**UserLoginSession表** - 登录会话
```prisma
model UserLoginSession {
  id           String   @id @default(uuid())
  userId       String
  tokenVersion Int
  deviceInfo   String   // 浏览器/设备信息
  ipAddress    String?
  userAgent    String?
  isActive     Boolean  @default(true)
  loggedInAt   DateTime @default(now())
  lastSeenAt   DateTime @default(now())
  loggedOutAt  DateTime?
}
```

#### 7. 独立比赛

**StandaloneMatch表** - 独立比赛（非赛事）
```prisma
model StandaloneMatch {
  id          String    @id @default(uuid())
  userId      String
  name        String
  description String?
  status      String    @default("pending")
  scheduledAt DateTime?

  user    User    @relation(...)
  matches Match[]
}
```

**MemberAssignedMatch表** - 成员分配比赛
```prisma
model MemberAssignedMatch {
  id        String   @id @default(uuid())
  memberId  String
  matchId   String

  @@unique([memberId, matchId])
}
```

---

## 核心模块职责

### 1. 权限管理模块

**文件位置**:
- [server/utils/auth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/auth.ts) - 基础认证
- [server/utils/tournament-auth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/tournament-auth.ts) - 赛事权限
- [server/lib/jwt.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/jwt.ts) - JWT工具

**核心职责**:
- JWT令牌生成与验证
- 用户身份提取
- 角色权限判定
- 单设备登录控制（通过tokenVersion递增）
- 赛事级别读写权限分离
- 集中式权限工具函数，避免API内重复实现

**关键函数**:
```typescript
// 从请求头提取用户（不校验session）
getUserFromEvent(event): JWTPayload

// 校验单设备登录（tokenVersion匹配）
getUserFromEventWithSession(event, prisma): JWTPayload

// 角色权限要求
requireRole(event, ...roles): JWTPayload

// 赛事读权限判定
canReadTournament(user, tournament): boolean
requireReadTournament(event, prisma, tournamentId)

// 赛事写权限判定
canWriteTournament(user, tournament, team): boolean
requireWriteTournament(event, prisma, tournamentId)
```

**权限矩阵**:
| 角色 | system_admin | 团队admin | 团队subaccount | debater | individual | 未登录 |
|------|-------------|----------|--------------|---------|-----------|--------|
| 赛事读权限 | ✅ | ✅(同teamId) | ✅(同teamId) | ✅(同teamId) | ❌ | ❌ |
| 赛事写权限 | ✅ | ✅(adminId匹配) | ❌ | ❌ | ❌ | ❌ |
| 用户管理 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Bot配置 | ❌ | ✅(同teamId) | ❌ | ❌ | ❌ | ❌ |

---

### 2. 赛程生成模块

**文件位置**:
- [server/utils/bracket-generator.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/bracket-generator.ts)

**支持的赛制** (6种):
1. **单败淘汰赛** (`single_elimination`) - 种子保护对阵
2. **双败淘汰赛** (`double_elimination`) - 胜者组+败者组+复活赛决赛
3. **循环赛** (`round_robin`) - 单循环/双循环（Circle Method算法）
4. **佩寄制** (`page_playoff`) - R1-R4四轮制（4队）
5. **瑞士制** (`swiss`) - 积分动态配对，避免重复对战
6. **小组+淘汰赛** (`group_knockout`) - 蛇形分组+循环赛+单败淘汰

**核心功能**:
- 种子保护排序（rating / random / name 三种方式）
- 自动识别BYE轮空场次
- 胜者自动晋级联动（promotedFromA/B 溯源）
- 乐观锁并发控制（Match.version）
- 瑞士制整轮结束后动态重配对
- 小组+淘汰赛按积分自动晋级
- 抽签工具（分组抽签 + 辩题抽签 + 正反方抽签）

**核心函数**:
```typescript
// 主入口：根据赛制生成完整赛程
generateBracket(options): { matches, format, totalMatches, roundCount, formatLabel }

// 各赛制生成器
generateSingleElimination(teams, opts): MatchInput[]
generateDoubleElimination(teams, opts): MatchInput[]
generateRoundRobin(teams, opts): MatchInput[]
generatePagePlayoff(teams, opts): MatchInput[]
generateSwiss(teams, opts): MatchInput[]
generateGroupKnockout(teams, opts): { groupMatches, knockoutMatches }

// 自动晋级联动
advanceWinnerToNextRound(tournamentId, finishedMatch): AdvanceResult
autoPairNextSwissRound(tournamentId): { paired, info }
autoPromoteFromGroupsToKnockout(tournamentId, promotePerGroup)

// 抽签工具
drawGroups(teams, groupCount): { team, group, seed }[]
drawAffirmativeSide(): 'teamA' | 'teamB'
drawTopic(topicPool, usedTopics): { pro, con }
runDrawLots(options): DrawLotsResult

// 积分榜计算
computeStandings(matches): StandingsEntry[]
```

**算法亮点**:
- **种子保护对阵**: 1号种子对阵最弱，确保强队不会过早相遇
- **蛇形分组**: 强弱交替分配，保证各组实力均衡
- **指数退避重连**: Bot WebSocket 重连策略
- **乐观锁**: Match.version 字段，HTTP 409冲突处理

---

### 3. QQ Bot管理模块

**文件位置**:
- [server/lib/bot-ws.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-ws.ts) - WebSocket核心
- [server/lib/bot-manager.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-manager.ts) - 多团队调度
- [server/lib/bot-handlers.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-handlers.ts) - 消息处理
- [server/lib/bot-roles.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-roles.ts) - 身份管理
- [server/lib/bot-permissions.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-permissions.ts) - 权限控制
- [server/lib/bot-http.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-http.ts) - HTTP API封装
- [server/lib/bot-scoring.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-scoring.ts) - 计分
- [server/lib/bot-notifications.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-notifications.ts) - 通知
- [server/lib/bot-data-sync.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-data-sync.ts) - 数据同步

**架构设计**:
```
┌──────────┐    WebSocket     ┌──────────┐
│ QQ Gateway│ ←─────────────→ │ Bot实例  │
└──────────┘                  └──────────┘
     ↓ HTTP API                   ↓ 消息处理
┌──────────┐                  ┌──────────┐
│ Bot HTTP  │                  │ 命令处理  │
│  API封装   │                  │ 分发器    │
└──────────┘                  └──────────┘
                                   ↓
                        ┌───────────────────────┐
                        │  身份管理 │ 权限控制  │
                        │  计分系统 │ 通知推送  │
                        └───────────────────────┘
```

**核心功能**:

1. **WebSocket连接管理**
   - Gateway URL获取与缓存（1小时TTL）
   - 心跳维持（默认41.25秒）
   - Intents降级策略（12种配置轮询）
   - 指数退避重连（5s→10s→20s→...→120s封顶）
   - 熔断机制（2轮intents失败后停止）
   - 沙箱/正式环境切换（BOT_SANDBOX）

2. **多团队错峰启动**
   - 自定义启动优先级
   - 3-5秒随机抖动间隔
   - 资源占用监控（内存估算）
   - 健康状态检查
   - Bot资源快照

3. **赛场管理**
   - 赛场自动命名（A、B、C...字母序列）
   - 支持自定义赛场名称
   - channelId作为赛场主键（子频道）
   - 身份组自动创建（QQ频道身份组）
   - 身份认领与取消

4. **消息处理**
   - 消息去重（FIFO队列200条上限）
   - 命令识别（设置赛场/认领/赛程/排名等）
   - 权限控制（管理员命令限制）
   - 自动回复

**Bot命令列表**:
| 命令 | 功能 | 权限 |
|------|------|------|
| `ping` | 测试连接 | 所有人 |
| `help` | 帮助信息 | 所有人 |
| `状态` | 查看状态 | 所有人 |
| `设置赛场 [名称] [赛制]` | 创建赛场 | 管理员 |
| `结束比赛` | 关闭赛场 | 管理员 |
| `认领 [身份]` | 认领身份 | 所有人 |
| `取消认领` | 取消认领 | 所有人 |
| `赛场状态` | 查看状态 | 所有人 |
| `辩题` | 查看辩题库 | 所有人 |
| `赛程` | 查看赛程 | 所有人 |
| `下一场` | 下一场信息 | 所有人 |
| `排名` | 查看排名 | 所有人 |

---

### 4. 计时器引擎

**文件位置**:
- [app/stores/debate.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/stores/debate.ts) - 状态管理
- [app/components/TimerPreview.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/TimerPreview.vue) - 预览组件
- [app/components/TimerPreviewCard.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/TimerPreviewCard.vue) - 预览卡片

**计时器类型**:
1. **单计时器** (speech/question/summary/special)
   - 倒计时显示
   - 警告阶段（20%-10%剩余时间）
   - 危急阶段（10%以内）
   - 提示音（30秒/5秒/0秒）

2. **双计时器** (dual-timer)
   - 正反方独立计时
   - 自动切换激活侧
   - 单侧耗尽自动跳转
   - 双方独立重置

**配置页面统一架构**:
- 左侧：16:9比例的TimerPreview实时预览组件（约1/3宽度）
- 右侧：配置选项（约2/3宽度）
- 预览组件移除正式环境元素（快捷键区域、控制模块、初始弹窗）

---

### 5. 报名系统模块

**文件位置**:
- [app/composables/useRegistration.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/composables/useRegistration.ts) - 前端API封装
- [app/pages/tournaments/[id]/register.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/pages/tournaments/[id]/register.vue) - 公开报名页
- [app/pages/tournaments/[id]/registrations.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/pages/tournaments/[id]/registrations.vue) - 报名管理页

**核心功能**:
1. **报名模式**
   - 个人报名（单人报名，可调剂组队）
   - 队伍报名（整队报名，含多名成员）

2. **报名方式**
   - 免登录公开报名（isPublic=true）
   - 登录用户报名（关联userId）

3. **自定义字段**
   - 支持text/textarea/select/checkbox/radio类型
   - 可配置是否必填
   - 可配置适用范围（个人/队伍/两者）
   - 可配置排序

4. **审核流程**
   - 待审核 → 审核通过 / 审核拒绝
   - 审核备注
   - 审核人记录

5. **个人报名自动组队**
   - 根据preferredPosition（首选辩位）匹配
   - 自动生成建议队伍
   - 管理员确认后转为正式队伍

6. **辩手子账号创建**
   - 批量为报名成员创建debater角色账号
   - 自动生成用户名（debater_姓名_随机码）
   - 返回明文密码供管理员分发
   - 子账号具有只读权限

**核心流程**:
```
管理员配置报名 → 用户提交报名 → 管理员审核 → 
  ├── 队伍报名 → 直接转为参赛队伍
  └── 个人报名 → 自动匹配组队 → 管理员确认 → 转为参赛队伍
              → 创建辩手子账号 → 分发账号密码
```

---

## 关键类与函数

### 1. 权限认证类

#### JWTPayload接口
```typescript
// server/lib/jwt.ts
export interface JWTPayload {
  userId: string
  username: string
  role: string       // system_admin / admin / subaccount / debater / individual
  mode: string       // qq_bot / individual
  teamId?: string | null
  tokenVersion: number  // 单设备登录版本号
  sessionId: string     // 会话ID
}
```

#### 单设备登录机制
```
登录流程：
1. 用户输入用户名密码 → POST /api/auth/login
2. 后端检查是否有其他活跃会话
   - 无 → 直接登录，创建新session
   - 有 → 返回 needConfirm=true + 现有会话信息
3. 前端弹窗展示已登录设备信息
4. 用户确认 → POST /api/auth/confirm-login
5. 后端递增 tokenVersion → 旧token失效 → 创建新session

被踢检测：
- 每次API调用校验 tokenVersion
- 不匹配 → 返回401 + "已在其他设备登录"
- 前端清除本地认证 → 跳转/login?reason=kicked
```

#### 赛事权限判定规则
```typescript
// server/utils/tournament-auth.ts

// 读权限：system_admin 或 同团队的 admin/subaccount/debater
canReadTournament(user, tournament): boolean {
  if (user.role === 'system_admin') return true
  if (['admin', 'subaccount', 'debater'].includes(user.role)) {
    return user.teamId === tournament.teamId
  }
  return false // individual / 未登录
}

// 写权限：system_admin 或 团队admin（adminId匹配）
canWriteTournament(user, tournament, team): boolean {
  if (user.role === 'system_admin') return true
  if (user.role !== 'admin') return false // subaccount/debater无写权限
  return team.adminId === user.userId
}
```

---

### 2. 赛程生成算法

#### MatchInput接口
```typescript
export interface MatchInput {
  round: string           // 轮次标签（第1轮/半决赛/决赛/W-第1轮/...）
  orderNum: number        // 场次序号（该轮内的第N场）
  teamA: string | null    // 队伍A名称
  teamB: string | null    // 队伍B名称
  isBye?: boolean         // 是否轮空场（BYE）
  promotedFromA?: string  // A队晋级来源（Match.id）
  promotedFromB?: string  // B队晋级来源（Match.id）
  stage?: string          // 阶段标识（winner/loser/grand_final/...）
}
```

#### 种子保护对阵算法
```typescript
// 生成种子保护的对阵位置
// 对于 bracketSize 支队伍（必须是 2 的幂）
// 使首轮按 (1 vs bracketSize), (2 vs bracketSize-1)... 分布
function generateSeedingBracket(bracketSize: number): number[] {
  let positions = [1, 2]
  while (positions.length < bracketSize) {
    const nextSeed = positions.length * 2 + 1
    const newPositions: number[] = []
    for (const seed of positions) {
      newPositions.push(seed)
      newPositions.push(nextSeed - seed)
    }
    positions = newPositions
  }
  return positions
}
// bracketSize=8 输出: [1, 8, 4, 5, 2, 7, 3, 6]
// 对阵: 1v8, 4v5, 2v7, 3v6
```

#### 循环赛 Circle Method 算法
```
固定一支队伍，其余每轮旋转：
第一轮：  1-6  2-5  3-4
第二轮：  1-5  6-4  2-3
第三轮：  1-4  5-3  6-2
第四轮：  1-3  4-2  5-6
第五轮：  1-2  3-6  4-5
```

---

### 3. Bot WebSocket管理

#### BotConfig接口
```typescript
export interface BotConfig {
  appId: string
  appSecret: string
  teamId: string
  teamName: string
  channelId?: string | null
  intents?: string[]  // ['PUBLIC_GUILD_MESSAGES']
  sandbox?: boolean   // 沙箱模式
}
```

#### BotInstance接口
```typescript
export interface BotInstance {
  config: BotConfig
  ws: WebSocket | null
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'
  botUsername?: string
  botId?: string
  sessionId?: string
  heartbeatInterval?: number
  lastHeartbeatAck?: number
  retryCount: number
  connectedAt?: number
  sendMessage: (channelId, content, msgId?) => Promise<any>
  sendGroupMessage: (groupId, content) => Promise<any>
  sendPrivateMessage: (userId, content) => Promise<any>
}
```

#### 指数退避重连算法
```typescript
function getBackoffMs(retryCount: number, rateLimited = false): number {
  const base = 5000  // 基础5秒
  const multiplier = Math.pow(2, Math.min(retryCount, 5)) // 2^0到2^5
  const ms = base * multiplier
  const jitter = Math.floor(Math.random() * 3000) // 0-3秒抖动
  return Math.min(ms + jitter, rateLimited ? 180000 : 120000)
}
// 重试序列: 5s → 10s → 20s → 40s → 80s → 120s(封顶)
```

---

### 4. 报名系统核心函数

#### 自动匹配组队算法
```
输入：已审核通过的个人报名者列表
输出：建议的队伍列表 + 未匹配者

算法：
1. 按 preferredPosition 分组（一辩/二辩/三辩/四辩/不限）
2. 从每个位置按顺序抽取一人组成队伍
3. "不限"位置的人补充到缺人的位置
4. 不足 teamSize 的队伍标记为不完整

示例（teamSize=4）：
  一辩: [A, B]  二辩: [C]  三辩: [D, E]  四辩: [F]  不限: [G, H]
  → 队伍1: A(一辩), C(二辩), D(三辩), F(四辩)
  → 队伍2: B(一辩), G(二辩), E(三辩), H(四辩)
```

#### 辩手子账号生成规则
```
用户名生成规则: debater_{姓名}_{4位随机码}
例: debater_张三_myVO

密码生成规则: 8位随机字母数字
例: bMbgxebg

角色: debater（只读权限）
关联: teamId = 赛事所属团队ID
```

---

## API接口说明

### RESTful API结构总览

| 模块 | 路径前缀 | 主要功能 |
|------|---------|---------|
| 认证 | `/api/auth/` | 登录、登出、修改密码、多设备确认 |
| 赛事 | `/api/tournaments/` | 赛事CRUD、赛程、报名、计时器 |
| 团队 | `/api/teams/` | 团队管理、成员管理、赛事列表 |
| 比赛 | `/api/matches/` | 单场比赛CRUD、结果提交、恢复 |
| Bot | `/api/bot/` | Bot配置、赛场管理、权限控制 |
| 管理员 | `/api/admin/` | 用户管理、团队管理、密码重置 |
| 内部 | `/api/internal/` | 计时器内部调用接口 |
| 计时器 | `/api/timer/` | 计时器项目CRUD |
| 独立比赛 | `/api/standalone-matches/` | 独立比赛管理 |

### 认证相关 (`server/api/auth/`)
```
POST   /api/auth/login              # 登录（检测多设备，可能返回needConfirm）
POST   /api/auth/confirm-login      # 确认登录（踢掉其他设备，创建新会话）
POST   /api/auth/terminate-others   # 终止其他设备会话
GET    /api/auth/me                 # 获取当前用户信息
PUT    /api/auth/password           # 修改密码
GET    /api/auth/login-status       # 检查登录状态
```

### 赛事管理 (`server/api/tournaments/`)
```
GET    /api/tournaments/:id                    # 获取赛事详情
PUT    /api/tournaments/:id                    # 更新赛事信息
DELETE /api/tournaments/:id                    # 删除赛事

# 赛程
GET    /api/tournaments/:id/matches            # 获取比赛列表
POST   /api/tournaments/:id/matches            # 创建单场比赛
POST   /api/tournaments/:id/matches/generate   # 自动生成赛程（6种赛制）
POST   /api/tournaments/:id/draw-lots          # 抽签（分组/辩题/正反方）
POST   /api/tournaments/:id/result-settings    # 结果配置
GET    /api/tournaments/:id/scores             # 获取评分
POST   /api/tournaments/:id/scores             # 提交评分

# 计时器
GET    /api/tournaments/:id/timer-config       # 获取计时器配置
PUT    /api/tournaments/:id/timer-config       # 更新计时器配置
GET    /api/tournaments/:id/timer-template     # 获取计时器模板
PUT    /api/tournaments/:id/timer-template     # 更新计时器模板

# 报名系统
GET    /api/tournaments/:id/registration-config  # 获取报名配置（公开）
POST   /api/tournaments/:id/register             # 提交报名（公开/鉴权均可）
GET    /api/tournaments/:id/my-registration      # 我的报名记录（需登录）
GET    /api/tournaments/:id/registrations        # 报名列表（管理员）
PUT    /api/tournaments/:id/registrations/:regId # 审核报名（管理员）
PUT    /api/tournaments/:id/registration-settings # 更新报名设置
PUT    /api/tournaments/:id/registration-fields   # 更新自定义字段
POST   /api/tournaments/:id/registrations/auto-match  # 个人报名自动组队
POST   /api/tournaments/:id/registrations/convert-teams # 转为正式队伍
POST   /api/tournaments/:id/registrations/create-accounts # 创建辩手账号
```

### 单场比赛 (`server/api/matches/`)
```
GET    /api/matches/:id              # 获取比赛详情
PUT    /api/matches/:id              # 更新比赛信息（乐观锁）
DELETE /api/matches/:id              # 软删除比赛
POST   /api/matches/:id/restore      # 恢复已删除比赛
POST   /api/matches/:id/result       # 提交比赛结果（触发晋级）
POST   /api/matches/:id/start        # 开始比赛
```

### Bot管理 (`server/api/bot/`)
```
# 配置
GET    /api/bot/channels             # 获取频道列表
PUT    /api/bot/config               # 更新Bot配置
POST   /api/bot/unbind               # 解绑Bot
GET    /api/bot/debug/config         # 调试配置

# 赛场管理
POST   /api/bot/arena/create         # 创建赛场
POST   /api/bot/arena/close          # 关闭赛场
GET    /api/bot/arena/list           # 赛场列表
GET    /api/bot/arena/status         # 赛场状态（channelId查询）
POST   /api/bot/arena/claim          # 认领身份
POST   /api/bot/arena/unclaim        # 取消认领
GET    /api/bot/arena/claims         # 认领记录

# 权限控制
POST   /api/bot/permissions/switch-round  # 切换环节权限
POST   /api/bot/permissions/grant-speak   # 授权发言
POST   /api/bot/permissions/revoke-speak  # 撤销发言
POST   /api/bot/permissions/reset         # 重置所有权限

# 日志与调度
GET    /api/bot/permission-logs      # 权限操作日志
POST   /api/bot/schedule             # 启动Bot调度

# WebSocket
WebSocket /api/bot/ws                # 前端Bot WebSocket连接
```

### 团队管理 (`server/api/teams/`)
```
GET    /api/teams                            # 团队列表
POST   /api/teams                            # 创建团队
GET    /api/teams/:teamId                    # 团队详情
PUT    /api/teams/:teamId                    # 更新团队
DELETE /api/teams/:teamId                    # 删除团队
GET    /api/teams/:teamId/members            # 团队成员列表
POST   /api/teams/:teamId/members            # 添加成员
DELETE /api/teams/:teamId/members/:userId    # 移除成员
DELETE /api/teams/:teamId/members/cleanup    # 清理无效成员
GET    /api/teams/:teamId/tournaments        # 团队赛事列表
POST   /api/teams/:teamId/tournaments        # 创建赛事
```

### 管理员接口 (`server/api/admin/`)
```
GET    /api/admin/users              # 用户列表
POST   /api/admin/users              # 创建用户
DELETE /api/admin/users/[id]         # 删除用户
PUT    /api/admin/users/[id]/reset   # 重置密码
GET    /api/admin/teams              # 所有团队
GET    /api/admin/individual-users   # 个人用户列表
```

### 内部接口 (`server/api/internal/`)
```
# 赛事信息
GET    /api/internal/tournament/schedule    # 获取赛程
GET    /api/internal/tournament/topics      # 获取辩题库
GET    /api/internal/tournament/next-match  # 下一场比赛信息
GET    /api/internal/tournament/rankings    # 获取排名
GET    /api/internal/tournament/scores      # 获取评分

# 环节控制
POST   /api/internal/round/switch          # 切换环节
POST   /api/internal/round/reset           # 重置环节

# 观众权限
POST   /api/internal/audience/grant        # 观众授权发言
POST   /api/internal/audience/revoke       # 撤销观众发言
```

---

## 前端组件架构

### 页面路由结构

```
/                           # 首页（仪表盘）
/login                      # 登录页
/individual-team            # 个人团队创建
/teams/:id                  # 团队详情页

/tournaments/create         # 创建赛事
/tournaments/:id            # 赛事主页（Tab导航）
├── info.vue                # 赛事信息
├── teams.vue               # 队伍管理
├── schedule.vue            # 赛程管理
├── timer.vue               # 计时器配置
├── timing.vue              # 计时器运行
├── details.vue             # UI配置
├── skin.vue                # 背景/皮肤配置
├── audio.vue               # 提示音配置
├── offline.vue             # 离线模式
├── register.vue            # 公开报名页（免登录可访问）
└── registrations.vue       # 报名管理（管理员）

/timer/projects             # 计时器项目列表
/timer/projects/:id         # 项目配置
/timer/run/:id/timing       # 项目运行

/standalone                 # 独立比赛列表
/standalone/create          # 创建独立比赛
/standalone/[id].vue        # 独立比赛详情

/bot                        # Bot管理页
```

### 全局认证中间件

**文件**: [app/middleware/auth.global.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/middleware/auth.global.ts)

**规则**:
- 登录页（`/login`）：已认证用户跳转首页
- 公开报名页（`/tournaments/:id/register`）：免登录放行（正则匹配）
- 其他所有页面：需要认证，否则跳转登录页
- 被踢下线检测：localStorage有token但store无认证 → 跳转`/login?reason=kicked`

### 核心组件

#### TimerPreview.vue - 计时器实时预览
**位置**: [app/components/TimerPreview.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/TimerPreview.vue)

**功能**:
- 复刻正式计时器视觉效果
- 1280x720px基准画布，transform scale动态缩放
- 16:9比例自适应
- 横幅、标题、环节、计时器显示
- 不含正式环境控制模块（快捷键、控制栏）

**Props**:
```typescript
interface TimerPreviewProps {
  contestTitle?: string       // 比赛标题
  positiveTopic?: string      // 正方辩题
  negativeTopic?: string      // 反方辩题
  teamPositiveName?: string   // 正方队伍
  teamNegativeName?: string   // 反方队伍
  stages?: StageInfo[]        // 环节配置
  currentStageIndex?: number  // 当前环节索引
  uiConfig?: UIConfig         // UI配置JSON
  skinConfig?: SkinConfig     // 背景配置JSON
  audioConfig?: AudioConfig   // 提示音配置JSON
  teamLogoConfig?: TeamLogoConfig // 队徽配置JSON
  scale?: number              // 缩放因子
}
```

#### BracketView.vue - 对阵图显示
**位置**: [app/components/BracketView.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/BracketView.vue)

**功能**: 可视化对阵关系，支持多种赛制，自动晋级联动

#### StandingsTable.vue - 积分榜
**位置**: [app/components/StandingsTable.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/StandingsTable.vue)

**功能**: 实时积分计算、胜负平统计、净胜分计算、排名排序

#### TimerConfig.vue - 计时器配置表单
**位置**: [app/components/TimerConfig.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/TimerConfig.vue)

**功能**: 环节编辑、时长配置、类型选择、顺序调整

#### MultiDeviceAlert.vue - 多设备登录弹窗
**位置**: [app/components/MultiDeviceAlert.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/MultiDeviceAlert.vue)

**功能**:
- 检测到多设备登录时弹出
- 展示已登录设备信息（设备、时间、IP）
- 操作选项：允许登录 / 强制下线其他设备
- 标准Modal行为（半透明背景、ESC关闭、点击背景关闭）

### Composables (组合式函数)

#### useAuth.ts - 认证管理
**位置**: [app/composables/useAuth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/composables/useAuth.ts)

```typescript
function useAuth(): {
  // 登录（可能返回needConfirm）
  login(username, password): Promise<LoginResponse>
  // 确认登录（踢掉其他设备）
  confirmLogin(username, password): Promise<LoginResponse>
  // 登出
  logout(): void
  // 拉取当前用户信息（检测token失效）
  fetchUser(): Promise<void>
  // 修改密码
  changePassword(oldPassword, newPassword): Promise<void>
}

interface LoginResponse {
  needConfirm: boolean
  token?: string
  sessionId?: string
  existingSessions?: ExistingSessionInfo[]
  newDevice?: NewDeviceInfo
  user: { id, username, role, mode, team }
}
```

#### useTournament.ts - 赛事管理
**位置**: [app/composables/useTournament.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/composables/useTournament.ts)

```typescript
function useTournament(): {
  // 赛事CRUD
  getTournaments(teamId)
  getTournament(id)
  createTournament(teamId, data)
  updateTournament(id, data)
  deleteTournament(id)

  // 比赛管理
  getMatches(tournamentId)
  createMatch(tournamentId, data)
  getMatch(id)
  updateMatch(id, data)
  deleteMatch(id, currentVersion?)
  restoreMatch(matchId, currentVersion) // 恢复软删除
  submitResult(matchId, winner, scoreA, scoreB, ...)

  // 赛程生成与抽签
  generateMatches(tournamentId, options) // 6种赛制
  drawLots(tournamentId, data)

  // 独立比赛
  getStandaloneMatches()
  getStandaloneMatch(id)
  createStandaloneMatch(data)
  updateStandaloneMatch(id, data)
  deleteStandaloneMatch(id)
  createStandaloneMatchMatch(id, data)
}
```

#### useRegistration.ts - 报名系统
**位置**: [app/composables/useRegistration.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/composables/useRegistration.ts)

```typescript
function useRegistration(): {
  // 公开接口
  getRegistrationConfig(tournamentId)        // 获取报名配置
  submitRegistration(tournamentId, data)     // 提交报名
  getMyRegistration(tournamentId)            // 我的报名

  // 管理员接口
  getRegistrations(tournamentId, params?)    // 报名列表
  reviewRegistration(tournamentId, regId, action, reviewNote?)
  updateRegistrationSettings(tournamentId, data)
  updateRegistrationFields(tournamentId, fields)
  autoMatch(tournamentId, teamSize?)         // 自动组队
  convertToTeams(tournamentId, items)        // 转为正式队伍
  createDebaterAccounts(tournamentId, registrationIds?)
}
```

#### useTeam.ts - 团队管理
**位置**: [app/composables/useTeam.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/composables/useTeam.ts)

#### useBotWs.ts - Bot WebSocket客户端
**位置**: [app/composables/useBotWs.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/composables/useBotWs.ts)

### Pinia Stores

#### auth.ts - 认证状态
**位置**: [app/stores/auth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/stores/auth.ts)

```typescript
const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<UserInfo | null>(null)
  const isAuthenticated = computed(() => !!token.value && !!user.value)

  function loadFromStorage()    // 从localStorage恢复
  function setAuth(newToken, newUser)   // 设置认证状态
  function clearAuth()         // 清除认证状态
})
```

#### debate.ts - 计时器状态
**位置**: [app/stores/debate.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/stores/debate.ts)

---

## 权限系统详解

### 角色定义

| 角色 | role值 | 说明 | 所属团队 |
|------|--------|------|---------|
| 系统管理员 | `system_admin` | 全局最高权限 | 无 |
| 团队管理员 | `admin` | 团队所有者，可管理团队内所有资源 | 有 |
| 团队子账号 | `subaccount` | 团队协作账号，只读+部分写 | 有 |
| 辩手 | `debater` | 报名生成的子账号，只读权限 | 有 |
| 个人用户 | `individual` | 未加入团队的个人用户 | 无 |

### 权限判定原则

1. **集中式判定**: 所有权限判定收敛到 [server/utils/tournament-auth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/tournament-auth.ts)
2. **读/写分离**: 读权限和写权限分别判定
3. **teamId匹配**: 团队角色（admin/subaccount/debater）必须teamId与赛事一致
4. **adminId校验**: 写权限需要团队adminId与当前用户匹配

### API权限校验模式

```typescript
// 示例：读取赛事（需要读权限）
export default defineEventHandler(async (event) => {
  const { user, tournament } = await requireReadTournament(
    event, prisma, getRouterParam(event, 'id')
  )
  // ... 业务逻辑
  return tournament
})

// 示例：修改赛事（需要写权限）
export default defineEventHandler(async (event) => {
  const { user, tournament } = await requireWriteTournament(
    event, prisma, getRouterParam(event, 'id')
  )
  // ... 业务逻辑
  return { success: true }
})
```

### 单设备登录机制

**核心原理**: 使用 `User.tokenVersion` 字段实现会话版本控制

```
正常登录:
1. 用户登录 → 创建 UserLoginSession → 生成JWT（含当前tokenVersion）
2. 每次请求 → 校验JWT中的tokenVersion与数据库是否一致

新设备登录:
1. 检测到已有活跃会话 → 返回 needConfirm=true
2. 用户确认 → tokenVersion++ → 旧JWT失效 → 创建新会话

被踢检测:
1. 旧设备发起请求 → tokenVersion不匹配 → 返回401
2. 前端清除localStorage → 跳转/login?reason=kicked
```

---

## 报名系统详解

### 数据模型关系

```
Tournament (1) ──── (N) Registration
                         │
                         ├─ type: "individual" (个人报名)
                         │    └─ members: 1个 RegistrationMember
                         │
                         └─ type: "team" (队伍报名)
                              └─ members: N个 RegistrationMember

Tournament (1) ──── (N) RegistrationField (自定义字段配置)

Registration (1) ──── (N) RegistrationMember
                              │
                              └─ userId: 创建子账号后填充
```

### 核心流程

#### 1. 管理员配置报名
```
1. 进入赛事管理 → 报名管理Tab
2. 设置：是否开放报名、截止时间、是否公开、队伍人数
3. 配置自定义字段（可选）
4. 保存设置 → registrationOpen = true
```

#### 2. 用户提交报名
```
公开报名页（免登录）:
访问 /tournaments/{id}/register
选择报名类型（个人/队伍）
填写基本信息 + 自定义字段
添加成员（队伍报名多人，个人报名1人）
提交 → Registration 记录，userId=null

登录用户报名:
同上，但提交时带上Authorization头
Registration 记录关联 userId
```

#### 3. 管理员审核
```
报名管理页 → 报名列表Tab
查看报名详情 → 审核通过 / 审核拒绝
填写审核备注 → 更新 Registration.status
```

#### 4. 个人报名自动组队
```
1. 审核通过多个个人报名后
2. 点击"自动组队"按钮
3. 系统根据 preferredPosition 匹配：
   - 按位置分组 → 每个位置抽一人组成队伍
   - "不限"位置补充空缺
4. 显示建议队伍列表
5. 管理员确认 → 生成 TournamentTeam 记录
```

#### 5. 创建辩手子账号
```
1. 审核通过后，点击"创建辩手账号"
2. 系统为每个 RegistrationMember 创建 User：
   - username: debater_{姓名}_{4位随机码}
   - password: 8位随机字母数字
   - role: debater（只读）
   - teamId: 赛事所属团队ID
3. 返回账号密码列表 → 管理员分发
4. Registration.accountCreated = true
```

### 页面路由放行规则

**文件**: [app/middleware/auth.global.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/middleware/auth.global.ts)

```typescript
// 公开报名页：允许免登录访问
if (/^\/tournaments\/[^/]+\/register$/.test(to.path)) {
  return // 放行
}
```

---

## 依赖关系图谱

### 前端模块依赖

```
app/pages/*.vue (页面层)
    ├── app/components/*.vue (UI组件)
    │       └── TimerPreview.vue / BracketView.vue / ...
    ├── app/composables/*.ts (业务逻辑封装)
    │       ├── useAuth.ts ──→ app/stores/auth.ts
    │       ├── useTournament.ts ──→ $fetch
    │       ├── useRegistration.ts ──→ $fetch
    │       └── useBotWs.ts ──→ WebSocket
    └── app/middleware/auth.global.ts (路由守卫)
            └── app/stores/auth.ts

app/plugins/ (全局注入)
    ├── auth.client.ts (认证初始化)
    └── auth-fetch.client.ts (fetch拦截器)
```

### 后端模块依赖

```
server/api/*.ts (路由层)
    │
    ├── server/utils/*.ts (工具函数层)
    │       ├── auth.ts ──────────→ server/lib/jwt.ts
    │       ├── tournament-auth.ts ─→ auth.ts + prisma
    │       ├── bracket-generator.ts ─→ prisma
    │       └── internal-auth.ts ───→ auth.ts
    │
    └── server/lib/*.ts (核心库层)
            ├── prisma.ts (数据库连接)
            │       └── generated/client.ts (Prisma生成)
            ├── jwt.ts (JWT工具)
            │       └── bcryptjs + jsonwebtoken
            ├── bot-ws.ts (Bot WebSocket)
            │       ├── bot-manager.ts (调度)
            │       ├── bot-handlers.ts (消息处理)
            │       ├── bot-roles.ts (身份)
            │       ├── bot-permissions.ts (权限)
            │       ├── bot-http.ts (HTTP API)
            │       ├── bot-scoring.ts (计分)
            │       ├── bot-notifications.ts (通知)
            │       └── bot-data-sync.ts (同步)
            └── ...

server/plugins/bot.ts (服务端插件)
    └── 启动时初始化Bot实例
```

### 数据库表依赖关系

```
用户体系:
User ──┬── TeamMember ──── Team
       ├── UserLoginSession (会话管理)
       ├── StandaloneMatch (独立比赛)
       └── Registration (报名提交人)

赛事体系:
Team ── Tournament ──┬── TournamentTeam (参赛队伍)
                     ├── TournamentJudge (评委)
                     ├── Match ──┬── MatchScore (评分)
                     │           ├── Timer (计时器状态)
                     │           └── MemberAssignedMatch
                     ├── TimerTemplate (计时器模板)
                     ├── DebateTimerProject (计时器项目)
                     ├── Registration (报名记录)
                     └── RegistrationField (自定义字段)

Bot体系:
Team ── BotArena ──┬── BotArenaRole (身份组)
                   │       └── BotArenaClaim (认领记录)
                   └── BotPermissionLog (权限日志)
```

---

## 项目运行方式

### 开发环境启动

#### 1. 环境要求
- Node.js 18+
- npm / pnpm / yarn
- Windows 10/11 (本项目Windows开发)

#### 2. 安装依赖
```bash
# 使用npm
npm install

# 或使用pnpm
pnpm install
```

#### 3. 数据库配置
```bash
# 生成Prisma客户端
npx prisma generate

# 应用数据库变更（开发环境）
npx prisma db push

# 查看数据库GUI（可选）
npx prisma studio
```

#### 4. 启动开发服务器
```bash
# 启动Nuxt开发服务器（默认端口3000）
npm run dev

# 访问 http://localhost:3000
```

> **注意**: 启动前会自动检查3000端口是否已有服务，有则不用重新启动。

#### 5. 数据库种子（可选）
```bash
# 运行种子脚本创建初始用户
npx tsx server/db/seed.ts
```

**默认账号**:
| 角色 | 用户名 | 密码 |
|------|--------|------|
| 系统管理员 | admin | admin123 |
| 团队管理员 | teamadmin | team123 |

### 生产环境部署

#### 1. 构建应用
```bash
# 构建Nuxt应用
npm run build
```

#### 2. 预览构建结果
```bash
# 本地预览生产构建
npm run preview
```

#### 3. 环境变量配置
创建 `.env` 文件：
```env
# JWT密钥（生产环境务必修改，至少32字符）
JWT_SECRET=your-production-secret-key-change-this

# Bot环境（沙箱/正式）
BOT_SANDBOX=false

# 数据库路径
DATABASE_URL=file:./production.db
```

#### 4. 启动生产服务
```bash
# 直接启动
node .output/server/index.mjs

# 或使用PM2进程管理
pm2 start .output/server/index.mjs --name debate-timer
```

### Bot环境切换

#### 正式环境
```env
BOT_SANDBOX=false
# Gateway: https://api.sgroup.qq.com/gateway
# API: https://api.sgroup.qq.com
```

#### 沙箱环境
```env
BOT_SANDBOX=true
# Gateway: https://sandbox.api.sgroup.qq.com/gateway
# API: https://sandbox.api.sgroup.qq.com
```

---

## 开发指南

### 代码规范

#### 1. TypeScript规范
- 所有代码使用TypeScript
- 接口定义优先，避免使用any
- 严格类型检查
- 导出类型供其他模块复用

#### 2. Vue组件规范
- 使用 `<script setup lang="ts">` 语法
- Props定义使用interface
- 组件命名: PascalCase
- 文件命名: PascalCase.vue

#### 3. API路由规范
- 文件命名: RESTful风格（`[param].get.ts` / `[param].post.ts`）
- 使用async/await，避免callback风格
- 错误处理: 使用 `createError`
- 权限校验: 使用 `requireReadTournament` / `requireWriteTournament`

#### 4. 数据库规范
- 主键: UUID (`@default(uuid())`)
- 外键: 使用relation字段映射
- 索引: 常用查询条件加 `@@index([...])`
- 软删除: `deletedAt` 字段 + `restore` API
- 乐观锁: `version` 字段，更新时自增

#### 5. 注释规范
- 代码中添加必要的中文注释
- 复杂算法添加说明注释
- 函数使用JSDoc风格注释

### 常见开发任务

#### 1. 新增API路由
```typescript
// server/api/tournaments/[id]/example.get.ts
import { prisma } from '~/server/lib/prisma'
import { requireReadTournament } from '~/server/utils/tournament-auth'

export default defineEventHandler(async (event) => {
  const tournamentId = getRouterParam(event, 'id')!
  const { user, tournament } = await requireReadTournament(event, prisma, tournamentId)

  // 业务逻辑...

  return { success: true, data: tournament }
})
```

#### 2. 新增前端页面
```vue
<!-- app/pages/example.vue -->
<script setup lang="ts">
const store = useAuthStore()
const router = useRouter()

// 页面逻辑...
</script>

<template>
  <div>
    <!-- 页面内容 -->
  </div>
</template>
```

#### 3. 新增数据库表
1. 在 `prisma/schema.prisma` 中定义模型
2. 运行 `npx prisma db push` 应用变更
3. 生成的类型在 `server/lib/generated/` 中

#### 4. 新增Bot命令
在 `server/lib/bot-handlers.ts` 中添加命令处理逻辑

### 调试技巧

#### 1. Prisma调试
```bash
# 查看数据库GUI
npx prisma studio

# 查看生成的模型
ls server/lib/generated/models/
```

#### 2. API调试
- Nuxt DevTools（已启用，开发环境）
- 浏览器Network面板
- 控制台日志

#### 3. Bot调试
查看控制台日志：
```
[Bot][teamName] WebSocket 连接已建立
[Bot][teamName] 收到 Hello, 心跳间隔: 41250ms
[Bot][teamName] 频道消息: user: content
```

---

## 部署指南

### 生产部署清单

#### 1. 数据库备份
```powershell
# Windows PowerShell 备份SQLite数据库
Copy-Item prisma\dev.db prisma\dev.db.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')
```

#### 2. 环境变量
```env
JWT_SECRET=生产环境密钥（至少32字符，务必修改）
DATABASE_URL=file:./production.db
BOT_SANDBOX=false  # 正式环境设为false
```

#### 3. 数据库迁移
```bash
# 应用schema变更到生产数据库
npx prisma db push
```

#### 4. 构建部署
```bash
# 构建
npm run build

# 启动
node .output/server/index.mjs

# 或使用PM2
pm2 start .output/server/index.mjs --name debate-timer
```

### 性能优化

#### 构建优化
- 手动分包：vue/pinia/prisma 分别打包（nuxt.config.ts 中配置）
- CSS代码分割
- 资源内联（小于4KB图片转base64）
- gzip/brotli压缩静态资源

#### 数据库优化
- 使用索引（`@@index`）
- 合理使用include避免过度查询
- 软删除替代物理删除
- 批量操作使用transaction

#### 前端优化
- 使用computed缓存计算结果
- 避免深层响应式对象
- Nuxt自动页面级代码分割

### 安全加固

#### 1. 认证安全
- JWT密钥强度（32+字符，生产环境务必修改）
- 单设备登录控制（tokenVersion递增）
- 会话管理（UserLoginSession表）
- 密码bcrypt哈希存储

#### 2. 权限控制
- 赛事级别读写权限分离
- 集中式权限判定工具函数
- Bot权限操作日志（BotPermissionLog）

#### 3. 数据安全
- SQL注入防护（Prisma ORM参数化查询）
- 敏感字段不返回给前端
- .gitignore排除数据库文件、环境变量

---

## 附录

### 关键文件路径索引

#### 权限认证
- [server/utils/auth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/auth.ts) - 用户认证
- [server/utils/tournament-auth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/tournament-auth.ts) - 赛事权限
- [server/lib/jwt.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/jwt.ts) - JWT工具
- [app/middleware/auth.global.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/middleware/auth.global.ts) - 路由守卫

#### 赛程生成
- [server/utils/bracket-generator.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/bracket-generator.ts) - 赛程算法

#### Bot管理
- [server/lib/bot-ws.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-ws.ts) - WebSocket核心
- [server/lib/bot-manager.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-manager.ts) - 多团队管理
- [server/lib/bot-handlers.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-handlers.ts) - 命令处理
- [server/lib/bot-roles.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-roles.ts) - 身份管理

#### 报名系统
- [app/composables/useRegistration.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/composables/useRegistration.ts) - 前端API封装
- [app/pages/tournaments/[id]/register.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/pages/tournaments/[id]/register.vue) - 公开报名页
- [app/pages/tournaments/[id]/registrations.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/pages/tournaments/[id]/registrations.vue) - 报名管理

#### 计时器
- [app/stores/debate.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/stores/debate.ts) - 计时器状态
- [app/components/TimerPreview.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/components/TimerPreview.vue) - 预览组件

#### 数据库
- [prisma/schema.prisma](file:///d:/Code/DebateTimer/DebateTimerV3/prisma/schema.prisma) - 数据模型

### 参考文档路径
- [README.md](file:///d:/Code/DebateTimer/DebateTimerV3/README.md) - 项目说明
- [DEPLOYMENT.md](file:///d:/Code/DebateTimer/DebateTimerV3/DEPLOYMENT.md) - 部署文档
- [reference/DOC/赛制.md](file:///d:/Code/DebateTimer/DebateTimerV3/reference/DOC/赛制.md) - 赛制说明
- [reference/BOT/内部API文档.md](file:///d:/Code/DebateTimer/DebateTimerV3/reference/BOT/内部API文档.md) - Bot API
- [reference/项目设计文档.md](file:///d:/Code/DebateTimer/DebateTimerV3/reference/项目设计文档.md) - 设计文档

---

## 性能优化与 Bug 修复记录 (v2.1, 2026-07-02)

> 本轮修复基于对全项目的代码审计，共识别 38 个问题，已完成 11 项高/中优先级修复。下表按修复顺序列出。

### 已修复问题清单

| # | 类别 | 严重度 | 文件 | 问题摘要 |
|---|------|--------|------|---------|
| 1 | 数据库字段 | 高 | [prisma/schema.prisma](file:///d:/Code/DebateTimer/DebateTimerV3/prisma/schema.prisma) | `Tournament.format` 默认值 `knockout` 与代码常量 `single_elimination` 等不一致，新建赛事无法调用 generate 接口。已改为 `single_elimination`。 |
| 2 | 数据库字段 | 中 | [prisma/schema.prisma](file:///d:/Code/DebateTimer/DebateTimerV3/prisma/schema.prisma) | `BotArena.channelId`（子频道 ID，业务上唯一）未加唯一约束，可能创建多个绑定同一 channelId 的赛场。已加 `@unique`。 |
| 3 | 数据库字段 | 高 | [prisma/schema.prisma](file:///d:/Code/DebateTimer/DebateTimerV3/prisma/schema.prisma) | `Registration.user` 关系缺少 `onDelete`，删除用户后产生孤儿数据。已加 `onDelete: SetNull` 保留报名记录用于审计。 |
| 4 | 数据库性能 | 中 | [server/lib/prisma.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/prisma.ts) | Prisma 客户端缺少日志配置与 DATABASE_URL 环境变量支持。已加 `log` 配置（开发环境 `warn+error`，生产环境 `error`）与 DATABASE_URL 回退。 |
| 5 | 认证 Bug | 中 | [server/api/auth/password.put.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/auth/password.put.ts) | 修改密码后未递增 `tokenVersion`，旧 token 仍可使用 7 天。已用事务同时更新密码、递增 tokenVersion、失效所有 session。 |
| 6 | 权限 Bug | 中 | [server/api/bot/arena/list.get.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/arena/list.get.ts), [server/api/tournaments/[id]/scores.get.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/tournaments/[id]/scores.get.ts) | 角色判定使用不存在的 `'member'` 角色，导致 `subaccount` 用户无法访问。已改为 `'subaccount'`。 |
| 7 | Bot Bug | 高 | [server/lib/bot-manager.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-manager.ts) | `setTimeout` 内使用 `require('./bot-ws')` 在 ESM 环境下报 `require is not defined`，错峰启动功能不可用。已改为顶部 `import { createBotInstance }`。 |
| 8 | 越权漏洞 | 高 | [server/api/bot/arena/claim.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/arena/claim.post.ts) | 查询 arena 未按 `teamId` 过滤，任意团队 admin 可对其他团队的赛场创建认领记录（横向越权）。已强制按 `currentUser.teamId` 过滤。 |
| 9 | 软删除 Bug | 高 | [server/api/matches/[id].put.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id].put.ts), [server/api/matches/[id]/result.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id]/result.post.ts), [server/lib/bot-scoring.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-scoring.ts) | 大量 Match 查询未过滤 `deletedAt: null`，允许对已软删除的比赛进行修改、录入赛果、累计评分。已统一加 `deletedAt: null` 过滤。 |
| 10 | 并发 Bug | 高 | [server/api/matches/[id]/result.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id]/result.post.ts), [server/api/matches/[id].put.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id].put.ts) | 录入赛果与修改比赛未使用乐观锁，两个管理员同时操作会互相覆盖，且 `updateTeamPoints` 会执行两次 increment 导致积分翻倍。已加 `version` 乐观锁、防重复录入校验、`updateMany + version` 条件更新。 |
| 11 | 性能优化 | 中 | [server/api/tournaments/[id]/draw-lots.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/tournaments/[id]/draw-lots.post.ts), [server/lib/bot-scoring.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-scoring.ts), [server/api/tournaments/[id]/registrations.get.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/tournaments/[id]/registrations.get.ts) | 抽签/排名计算在循环内逐条 `await update`（N+1 写入），抽签未用事务存在部分失败风险；报名列表无分页。已改为 `prisma.$transaction + Promise.all` 批量更新；报名列表加 `page/pageSize` 分页（默认 50，最大 200）。 |
| 12 | 安全加固 | 高 | [server/lib/jwt.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/jwt.ts), [server/utils/internal-auth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/internal-auth.ts) | `JWT_SECRET` 与 `INTERNAL_API_KEY` 默认值硬编码在源码中，部署时若未设置环境变量则可被伪造。已加启动时强制校验：生产环境缺失则 `process.exit(1)`，开发环境打印警告。 |
| 13 | 认证 Bug | 高 | [server/api/admin/users/[id].delete.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/admin/users/[id].delete.ts), [server/api/admin/users/[id]/reset.put.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/admin/users/[id]/reset.put.ts), [server/api/tournaments/[id]/scores.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/tournaments/[id]/scores.post.ts) | 关键敏感写操作 API 使用 `getUserFromEvent` 而非 `getUserFromEventWithSession`，被踢下线后旧 token 在 7 天过期前仍可删除用户、重置密码、提交评分。已改用 `getUserFromEventWithSession` 校验 tokenVersion。 |
| 14 | 数据清理 | 中 | [server/api/admin/users/[id].delete.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/admin/users/[id].delete.ts) | 删除用户时未清理关联数据（会话、计时器项目、独立比赛），导致 SQLite 外键约束错误或孤儿数据。已用事务先清理再删除。 |
| 15 | 敏感数据泄露 | 中 | [server/api/admin/users.get.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/admin/users.get.ts) | `include: { team: true }` 拉取整条 team 记录（含 `botAppSecret` 等敏感字段），无分页限制。已改用 `select` 仅取必要字段，加分页（默认 50，最大 200）。 |
| 16 | 权限 Bug | 高 | [server/api/tournaments/[id]/scores.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/tournaments/[id]/scores.post.ts) | 仅校验 `role` 未校验 `teamId`，任意团队 admin 可对其他团队的赛事提交评分。已用 `canWriteTournament` 统一判定。 |
| 17 | 数据库字段 | 高 | [prisma/schema.prisma](file:///d:/Code/DebateTimer/DebateTimerV3/prisma/schema.prisma) | `Team.adminId` 是纯字符串字段，未指向 `User.id`，删除管理员用户后 team.adminId 变成悬挂引用。已建立外键关系 `@relation("TeamAdmin", fields: [adminId], references: [id], onDelete: Restrict)`。 |
| 18 | 认证 Bug | 高 | [server/api/matches/[id].delete.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id].delete.ts), [server/api/tournaments/[id]/draw-lots.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/tournaments/[id]/draw-lots.post.ts), [server/api/tournaments/[id]/register.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/tournaments/[id]/register.post.ts) | 关键写操作 API 使用 `getUserFromEvent` 而非 `getUserFromEventWithSession`，被踢下线后旧 token 仍可删除比赛、执行抽签、提交报名。已改用 `getUserFromEventWithSession`。 |
| 19 | 软删除 Bug | 高 | [server/api/matches/[id].delete.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id].delete.ts) | 删除比赛时未过滤 `deletedAt: null`，允许对已软删除的比赛再次删除。已统一加 `deletedAt: null` 过滤。 |
| 20 | Bot Bug | 中 | [server/lib/bot-ws.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-ws.ts) `disconnectBot` | 主动断开时未 `removeAllListeners`，`close` 事件触发 `scheduleReconnect` 导致立即重连。已先 `removeAllListeners` 再 `close`。 |
| 21 | 前端 Bug | 中 | [app/composables/useBotWs.ts](file:///d:/Code/DebateTimer/DebateTimerV3/app/composables/useBotWs.ts) | `onclose` 无条件 3 秒重连，认证失败时形成死循环。已加 `shouldReconnect` 标志，`auth_error` 和主动 `disconnect` 时关闭重连。 |
| 22 | 认证 Bug | 高 | [server/api/matches/[id]/result.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id]/result.post.ts), [server/api/matches/[id].put.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id].put.ts), [server/api/matches/[id]/restore.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id]/restore.post.ts), [server/api/matches/[id]/start.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id]/start.post.ts), [server/api/auth/password.put.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/auth/password.put.ts), [server/api/bot/arena/create.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/arena/create.post.ts), [server/api/bot/arena/close.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/arena/close.post.ts), [server/api/bot/permissions/*.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/permissions), [server/api/teams/[teamId]/tournaments.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/teams/[teamId]/tournaments.post.ts), [server/api/teams/[teamId].put.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/teams/[teamId].put.ts), [server/api/teams/[teamId]/members.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/teams/[teamId]/members.post.ts), [server/api/bot/arena/unclaim.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/arena/unclaim.post.ts), [server/api/bot/unbind.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/unbind.post.ts), [server/api/bot/schedule.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/schedule.post.ts) | 批量修复约 16 个关键写操作 API 使用 `getUserFromEvent` 而非 `getUserFromEventWithSession`，被踢下线后旧 token 仍可操作。已全部改用 `getUserFromEventWithSession` 校验 tokenVersion。 |
| 23 | 数据一致性 | 高 | [server/api/matches/[id]/result.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id]/result.post.ts) | `updateTeamPoints`（increment 累加）与 `recalculateRankings`（全量覆盖）双机制并存，调用顺序敏感可能导致积分错误。已删除 `updateTeamPoints`，统一使用 `recalculateRankings` 全量重算。 |

### 待后续处理的问题（建议优先级）

以下问题影响面较小或需更大范围改动，建议后续迭代处理：

| 类别 | 严重度 | 文件 | 问题摘要 | 建议 |
|------|--------|------|---------|------|
| 认证 | 高 | 多处 API（约 39 个） | 大量写操作 API 仅用 `getUserFromEvent`，未调用 `getUserFromEventWithSession` 校验 `tokenVersion`，被踢下线后旧 token 在 7 天过期前仍可调用。 | 将所有受保护的写操作 API 改用 `getUserFromEventWithSession`，或在 `getUserFromEvent` 内默认查 DB 校验。改动量大，需分批进行。 |
| 安全 | 高 | [server/lib/jwt.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/jwt.ts), [server/utils/internal-auth.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/utils/internal-auth.ts) | `JWT_SECRET` 与 `INTERNAL_API_KEY` 默认值硬编码在源码中，部署时若未设置环境变量则可被伪造。 | 启动时强制要求环境变量，缺失则 panic。 |
| 数据库 | 中 | [prisma/schema.prisma](file:///d:/Code/DebateTimer/DebateTimerV3/prisma/schema.prisma) | `Team.adminId` 是纯字符串字段，未指向 `User.id`，删除管理员用户后 team.adminId 变成悬挂引用。 | 加 `@relation("TeamAdmin", fields: [adminId], references: [id], onDelete: Restrict)`。 |
| 前端 | 中 | [app/pages/tournaments/[id]/registrations.vue](file:///d:/Code/DebateTimer/DebateTimerV3/app/pages/tournaments/[id]/registrations.vue) | 单文件 1001 行未拆分，含 3 Tab + 3 弹窗。 | 拆分为 `RegistrationsListTab.vue` 等子组件。 |
| Bot | 中 | [server/lib/bot-ws.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-ws.ts) | `disconnectBot` 未 `removeAllListeners('close')`，主动断开会触发 `scheduleReconnect` 立即重连。 | disconnectBot 内先 `removeAllListeners` 再 `close`。 |
| Bot | 中 | [server/lib/bot-ws.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-ws.ts) | 心跳定时器无 ACK 超时检测，半开连接会持续发送心跳。 | 加 `lastHeartbeatAcked` 标志，连续 2 次未收到 ACK 则 `terminate` 重连。 |
| 并发 | 中 | [server/api/tournaments/[id]/register.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/tournaments/[id]/register.post.ts), [server/api/bot/arena/claim.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/bot/arena/claim.post.ts) | 防重复报名/认领存在 TOCTOU 竞态，并发请求可能通过 findFirst 检查后各自 create。 | 加唯一索引或 try/catch P2002 转为 409。 |
| 一致性 | 中 | [server/api/matches/[id]/result.post.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/api/matches/[id]/result.post.ts) `updateTeamPoints` 与 [server/lib/bot-scoring.ts](file:///d:/Code/DebateTimer/DebateTimerV3/server/lib/bot-scoring.ts) `recalculateRankings` | 两套积分计算机制并存：`updateTeamPoints` 用 `increment` 累加，`recalculateRankings` 用绝对值覆盖。调用顺序敏感。 | 统一为 `recalculateRankings` 全量重算，删除 `updateTeamPoints`。 |

### 性能优化建议

#### 数据库层
1. **N+1 查询识别**：开发环境已开启 Prisma `warn` 日志，慢查询与 N+1 会在控制台输出，便于定位。
2. **事务批量更新**：循环内 `await prisma.update` 改为 `prisma.$transaction([...])` 或 `Promise.all`，本轮已应用于抽签、排名计算。
3. **分页**：所有列表 API（`registrations.get.ts`、`admin/users.get.ts` 等）应统一支持 `page/pageSize`，避免一次拉取过多数据。
4. **合理 select**：`admin/users.get.ts` 的 `include: { team: true }` 会拉取整条 team 记录（含 `botAppSecret` 等敏感字段），应改为 `select: { id: true, name: true }`。
5. **SQLite 并发**：SQLite 写入是行级锁，并发写入场景下可考虑启用 WAL 模式（`PRAGMA journal_mode=WAL`）。

#### 前端层
1. **请求去重**：`useRegistration.ts`、`useTournament.ts` 等 composable 直接 `$fetch`，未对相同请求去重。可用 `useFetch` + `getCachedData` 或加 in-flight Promise 缓存。
2. **大组件拆分**：`registrations.vue`（1001 行）应拆分为多个子组件，用 `<component :is>` + `v-if` 延迟加载未激活的 Tab。
3. **Bot WebSocket 重连**：`useBotWs.ts` 的 `onclose` 无条件 3 秒重连，认证失败时会形成死循环。应加 `shouldReconnect` 标志。

#### Bot 层
1. **去重队列隔离**：`bot-ws.ts` 的 `processedMessageIds` 是全局共享 Set，多 Bot 实例下可能互相影响。应按 `teamId` 维护独立队列。
2. **资源监控真实化**：`bot-manager.ts` 的 `estimatedMemoryKB` 用随机值填充，无实际意义。应从 `stateMap` 取真实 `retryCount`，用 `process.memoryUsage()` 估算内存。
3. **Gateway URL 单飞**：`getGatewayUrl` 缓存过期瞬间多个 Bot 同时请求可能触发频率限制。应采用"单飞"模式。

#### 安全加固
1. **环境变量强制**：`JWT_SECRET`、`INTERNAL_API_KEY`、`DATABASE_URL` 应在启动时强制校验，缺失则拒绝启动。
2. **敏感字段脱敏**：`admin/users.get.ts` 返回 team 信息时应剔除 `botAppSecret`。
3. **审计日志完善**：所有写操作应记录到审计表（操作者、时间、操作类型、目标 ID、变更详情）。

### 数据库迁移说明

本轮 schema 改动需执行 `npx prisma db push` 应用以下变更：
1. `Tournament.format` 默认值 `knockout` → `single_elimination`（建议同时执行 `UPDATE Tournament SET format='single_elimination' WHERE format='knockout'` 修正历史数据）。
2. `BotArena.channelId` 加 `@unique` 约束（如有重复数据需先清理）。
3. `Registration.user` 关系加 `onDelete: SetNull`。

**备份建议**：执行迁移前请先备份 `prisma/dev.db`：
```powershell
Copy-Item prisma\dev.db prisma\dev.db.backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')
```

---

**文档版本**: 2.1
**更新日期**: 2026-07-02
**维护者**: DebateTimer开发团队
