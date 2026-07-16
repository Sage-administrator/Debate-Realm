# DebateTimerV3 路由文档

> 项目：DebateTimerV3 — 辩论赛管理系统
> 框架：Nuxt 4.4.8 + Vue 3.5 + Vue Router 5.1
> 路由模式：约定式路由（文件路由）

---

## 目录

1. [概述](#概述)
2. [路由系统原理](#路由系统原理)
3. [布局系统](#布局系统)
4. [路由中间件](#路由中间件)
5. [完整路由列表](#完整路由列表)
6. [动态路由参数](#动态路由参数)
7. [路由跳转方式](#路由跳转方式)
8. [权限与鉴权](#权限与鉴权)
9. [路由规则配置](#路由规则配置)
10. [路由树状图](#路由树状图)

---

## 概述

本项目使用 **Nuxt 4 约定式路由**，路由路径由 `app/pages/` 目录下的文件结构自动生成，无需手动配置路由表。

总计约 **43 个页面路由**，涵盖：
- 首页/仪表盘
- 用户认证（登录、设置）
- 赛事管理（创建、列表、详情、配置）
- 独立赛事管理
- 计时器项目
- 队伍管理
- 机器人（Bot）配置
- 评委打分
- 报名系统
- 辩题投票
- 公开页面

---

## 路由系统原理

### 约定式路由规则

Nuxt 4 自动根据 `app/pages/` 目录结构生成路由：

| 文件路径 | 生成路由 | 说明 |
|---------|----------|------|
| `pages/index.vue` | `/` | 首页 |
| `pages/login.vue` | `/login` | 静态路由 |
| `pages/tournaments/index.vue` | `/tournaments` | 嵌套路由父级 |
| `pages/tournaments/create.vue` | `/tournaments/create` | 子路由 |
| `pages/tournaments/[id].vue` | `/tournaments/:id` | 动态路由 |
| `pages/tournaments/[id]/index.vue` | `/tournaments/:id` | 动态路由子页面 |
| `pages/tournaments/[id]/teams.vue` | `/tournaments/:id/teams` | 嵌套动态路由 |

### 特殊语法

- `[param]` — 动态路由参数
- `index.vue` — 目录默认路由
- `.vue` 文件 — 单个页面路由

---

## 布局系统

项目定义了 **3 个布局**，不同路由使用不同布局。布局文件位于 `app/layouts/`。

### 布局列表

| 布局文件 | 布局名 | 适用页面 | 说明 |
|---------|--------|----------|------|
| `default.vue` | `default` | 首页、设置、bot、队伍详情等 | 通用侧边栏布局，含主导航 |
| `tournament.vue` | `tournament` | `/tournaments/[id]/*` | 赛事详情布局，含赛事侧边导航 |
| `standalone.vue` | `standalone` | `/standalone/[id]/*` | 独立赛事布局，类似 tournament |

> 登录页、公开报名页等不需要侧边栏的页面也使用 default 布局，但内容区不显示侧边栏（通过条件渲染控制）。

### 布局结构

所有侧边栏布局底部统一包含：
1. **用户信息区** — 头像、用户名、角色
2. **操作按钮行** — 设置（5份）、退出（4份）、主题切换（3份），比例 `5:4:3`

---

## 路由中间件

### 全局中间件

文件：`app/middleware/auth.global.ts`

**作用**：全局路由守卫，处理鉴权逻辑。

**执行时机**：每次路由跳转前执行。

**主要逻辑**：

1. **认证状态恢复**
   - SSR 阶段：从 Cookie 读取 `auth_token` 和 `auth_user`
   - 客户端：从 localStorage 读取（仅首次）
   - 使用 Pinia store 缓存状态，避免重复读取

2. **公开页面放行**（免登录）
   - `/login` — 登录页
   - `/` — 首页（未登录显示简介，已登录显示仪表盘）
   - `/tournaments/[id]/register` — 公开报名页
   - `/tournaments/[id]/topic-vote` — 公开辩题投票页

3. **已登录用户访问登录页** → 自动跳转首页

4. **未登录用户访问受保护页面** → 跳转登录页
   - 若 localStorage 有残留 token，识别为"被踢下线"场景，带 `?reason=kicked` 参数

5. **性能优化**
   - 模块级缓存 `clientStorageChecked`，避免每次路由跳转读 localStorage
   - 优先使用 Pinia store 中的认证状态

---

## 完整路由列表

### 一、顶级页面

| 路由路径 | 文件 | 权限 | 布局 | 说明 |
|----------|------|------|------|------|
| `/` | `pages/index.vue` | 公开 | default | 首页/仪表盘（未登录显示介绍，已登录显示赛事列表） |
| `/login` | `pages/login.vue` | 公开 | default | 登录页 |
| `/settings` | `pages/settings.vue` | 需登录 | default | 账户设置 |
| `/individual-team` | `pages/individual-team.vue` | 需登录 | default | 个人队伍页 |
| `/bot` | `pages/bot/index.vue` | 需登录 | default | 机器人配置 |

### 二、赛事管理（tournaments）

| 路由路径 | 文件 | 权限 | 布局 | 说明 |
|----------|------|------|------|------|
| `/tournaments` | `pages/tournaments/index.vue` | 需登录 | default | 赛事列表 |
| `/tournaments/create` | `pages/tournaments/create.vue` | 需登录 | default | 创建赛事 |
| `/tournaments/[id]` | `pages/tournaments/[id]/index.vue` | 需登录 | tournament | 赛事概览/首页 |
| `/tournaments/[id]/info` | `pages/tournaments/[id]/info.vue` | 需登录 | tournament | 赛事信息编辑 |
| `/tournaments/[id]/details` | `pages/tournaments/[id]/details.vue` | 需登录 | tournament | 界面元素设置 |
| `/tournaments/[id]/teams` | `pages/tournaments/[id]/teams.vue` | 需登录 | tournament | 参赛队伍管理 |
| `/tournaments/[id]/timing` | `pages/tournaments/[id]/timing.vue` | 需登录 | tournament | 环节配置/计时规则 |
| `/tournaments/[id]/schedule` | `pages/tournaments/[id]/schedule.vue` | 需登录 | tournament | 赛程管理 |
| `/tournaments/[id]/standings` | `pages/tournaments/[id]/standings.vue` | 需登录 | tournament | 积分榜/排名 |
| `/tournaments/[id]/audio` | `pages/tournaments/[id]/audio.vue` | 需登录 | tournament | 提示音设置 |
| `/tournaments/[id]/skin` | `pages/tournaments/[id]/skin.vue` | 需登录 | tournament | 皮肤/主题设置 |
| `/tournaments/[id]/registrations` | `pages/tournaments/[id]/registrations.vue` | 需登录 | tournament | 报名管理 |
| `/tournaments/[id]/register` | `pages/tournaments/[id]/register.vue` | 公开 | tournament | 选手报名页 |
| `/tournaments/[id]/topic-vote` | `pages/tournaments/[id]/topic-vote.vue` | 公开 | tournament | 辩题投票（单题） |
| `/tournaments/[id]/topic-votes` | `pages/tournaments/[id]/topic-votes.vue` | 需登录 | tournament | 辩题投票管理（问卷式） |
| `/tournaments/[id]/judge` | `pages/tournaments/[id]/judge.vue` | 需登录 | tournament | 评委打分页 |
| `/tournaments/[id]/public` | `pages/tournaments/[id]/public.vue` | 需登录 | tournament | 赛事公开页设置 |
| `/tournaments/[id]/timer` | `pages/tournaments/[id]/timer.vue` | 需登录 | tournament | 在线计时器 |
| `/tournaments/[id]/offline` | `pages/tournaments/[id]/offline.vue` | 需登录 | tournament | 导出离线版 |

### 三、独立赛事（standalone）

| 路由路径 | 文件 | 权限 | 布局 | 说明 |
|----------|------|------|------|------|
| `/standalone` | `pages/standalone/index.vue` | 需登录 | default | 独立赛事列表 |
| `/standalone/create` | `pages/standalone/create.vue` | 需登录 | default | 创建独立赛事 |
| `/standalone/[id]` | `pages/standalone/[id]/index.vue` | 需登录 | standalone | 独立赛事概览 |
| `/standalone/[id]/info` | `pages/standalone/[id]/info.vue` | 需登录 | standalone | 信息编辑 |
| `/standalone/[id]/details` | `pages/standalone/[id]/details.vue` | 需登录 | standalone | 界面设置 |
| `/standalone/[id]/teams` | `pages/standalone/[id]/teams.vue` | 需登录 | standalone | 队伍管理 |
| `/standalone/[id]/timing` | `pages/standalone/[id]/timing.vue` | 需登录 | standalone | 环节配置 |
| `/standalone/[id]/audio` | `pages/standalone/[id]/audio.vue` | 需登录 | standalone | 提示音设置 |
| `/standalone/[id]/skin` | `pages/standalone/[id]/skin.vue` | 需登录 | standalone | 皮肤设置 |
| `/standalone/[id]/timer` | `pages/standalone/[id]/timer.vue` | 需登录 | standalone | 在线计时器 |
| `/standalone/[id]/offline` | `pages/standalone/[id]/offline.vue` | 需登录 | standalone | 导出离线版 |

### 四、计时器项目（timer）

| 路由路径 | 文件 | 权限 | 布局 | 说明 |
|----------|------|------|------|------|
| `/timer/projects` | `pages/timer/projects.vue` | 需登录 | default | 计时器项目列表 |
| `/timer/projects/[id]` | `pages/timer/projects/[id].vue` | 需登录 | default | 计时器项目编辑 |
| `/timer/run/[id]/timing` | `pages/timer/run/[id]/timing.vue` | 需登录 | default | 运行计时器 |

### 五、队伍详情

| 路由路径 | 文件 | 权限 | 布局 | 说明 |
|----------|------|------|------|------|
| `/teams/[id]` | `pages/teams/[id].vue` | 需登录 | default | 队伍详情页 |

---

## 动态路由参数

### 参数列表

| 参数名 | 所在路由 | 说明 | 获取方式 |
|--------|----------|------|----------|
| `id` | `/tournaments/[id]/*` | 赛事 ID | `route.params.id` |
| `id` | `/standalone/[id]/*` | 独立赛事 ID | `route.params.id` |
| `id` | `/timer/projects/[id]` | 计时器项目 ID | `route.params.id` |
| `id` | `/timer/run/[id]/timing` | 计时器运行 ID | `route.params.id` |
| `id` | `/teams/[id]` | 队伍 ID | `route.params.id` |

### 用法示例

```vue
<script setup lang="ts">
const route = useRoute()
const tournamentId = route.params.id as string
</script>
```

---

## 路由跳转方式

### 1. 声明式跳转（NuxtLink）

```vue
<template>
  <!-- 基本用法 -->
  <NuxtLink to="/login">登录</NuxtLink>

  <!-- 动态路由 -->
  <NuxtLink :to="`/tournaments/${tournamentId}`">
    进入赛事
  </NuxtLink>

  <!-- Nuxt UI 按钮跳转 -->
  <UButton :to="`/tournaments/${id}`">
    详情
  </UButton>
</template>
```

### 2. 编程式跳转（navigateTo）

```ts
// 基本跳转
navigateTo('/login')

// 带参数跳转
navigateTo(`/tournaments/${id}`)

// 带查询参数
navigateTo('/login?reason=kicked')
```

### 3. 页面内路由参数监听

```ts
const route = useRoute()

// 监听参数变化
watch(() => route.params.id, (newId) => {
  // 重新加载数据
})
```

---

## 权限与鉴权

### 公开页面（免登录）

| 路由路径 | 说明 |
|----------|------|
| `/` | 首页（根据登录状态显示不同内容） |
| `/login` | 登录页 |
| `/tournaments/[id]/register` | 选手报名页 |
| `/tournaments/[id]/topic-vote` | 辩题投票页 |

### 受保护页面（需登录）

除上述公开页面外，所有页面都需要登录认证。

### 被踢下线处理

当用户在其他设备登录导致当前设备被踢下线时：
1. 跳转 `/login?reason=kicked`
2. 清除本地残留认证数据
3. 重置 localStorage 缓存标记

### 认证状态存储

| 存储位置 | 内容 | 用途 |
|----------|------|------|
| Cookie | `auth_token`, `auth_user` | SSR 阶段读取，服务端渲染鉴权 |
| localStorage | `auth_token`, `auth_user` | 客户端兜底，持久化存储 |
| Pinia Store | `auth.ts` | 运行时状态，页面间共享 |

---

## 路由规则配置

在 `nuxt.config.ts` 中配置的路由规则：

### 预渲染与缓存

```ts
routeRules: {
  // 登录页不预渲染，缓存 5 分钟
  '/login': { prerender: false, headers: { 'cache-control': 'max-age=300' } },
  '/register': { prerender: false, headers: { 'cache-control': 'max-age=300' } },
}
```

### Nitro 路由规则（生产环境）

| 路径模式 | 缓存策略 | 说明 |
|----------|----------|------|
| `/_nuxt/**` | max-age=31536000, immutable | 构建资源永久缓存 |
| `/assets/**` | max-age=31536000, immutable | 静态资源永久缓存 |
| `/fonts/*.woff2` | max-age=31536000, immutable | 字体文件永久缓存 |
| `/*.png` | max-age=31536000, immutable | 图片永久缓存 |
| `/*.ico` | max-age=31536000, immutable | 图标永久缓存 |
| `/*.mp3` | max-age=31536000, immutable | 音频永久缓存 |
| `/` | max-age=300 | 首页缓存 5 分钟 |
| `/login` | max-age=300 | 登录页缓存 5 分钟 |
| `/register` | max-age=300 | 注册页缓存 5 分钟 |
| `/api/**` | no-store | API 不缓存 |

### 页面过渡

```ts
app: {
  pageTransition: false,    // 禁用页面过渡
  layoutTransition: false,  // 禁用布局过渡
}
```

> 原因：页面过渡与 View Transition API 叠加会导致子页面切换卡顿，需要刷新才能进入。禁用后保证切换瞬时稳定。

---

## 路由树状图

```
app/pages/
├── index.vue ............................. /
├── login.vue ............................. /login
├── settings.vue .......................... /settings
├── individual-team.vue ................... /individual-team
│
├── bot/
│   └── index.vue ......................... /bot
│
├── teams/
│   └── [id].vue .......................... /teams/:id
│
├── timer/
│   ├── projects.vue ...................... /timer/projects
│   ├── projects/
│   │   └── [id].vue ...................... /timer/projects/:id
│   └── run/
│       └── [id]/
│           └── timing.vue ................ /timer/run/:id/timing
│
├── standalone/
│   ├── index.vue ......................... /standalone
│   ├── create.vue ........................ /standalone/create
│   └── [id]/
│       ├── index.vue ..................... /standalone/:id
│       ├── info.vue ...................... /standalone/:id/info
│       ├── details.vue ................... /standalone/:id/details
│       ├── teams.vue ..................... /standalone/:id/teams
│       ├── timing.vue .................... /standalone/:id/timing
│       ├── audio.vue ..................... /standalone/:id/audio
│       ├── skin.vue ...................... /standalone/:id/skin
│       ├── timer.vue ..................... /standalone/:id/timer
│       └── offline.vue ................... /standalone/:id/offline
│
└── tournaments/
    ├── index.vue ......................... /tournaments
    ├── create.vue ........................ /tournaments/create
    └── [id]/
        ├── index.vue ..................... /tournaments/:id
        ├── info.vue ...................... /tournaments/:id/info
        ├── details.vue ................... /tournaments/:id/details
        ├── teams.vue ..................... /tournaments/:id/teams
        ├── timing.vue .................... /tournaments/:id/timing
        ├── schedule.vue .................. /tournaments/:id/schedule
        ├── standings.vue ................. /tournaments/:id/standings
        ├── audio.vue ..................... /tournaments/:id/audio
        ├── skin.vue ...................... /tournaments/:id/skin
        ├── registrations.vue ............. /tournaments/:id/registrations
        ├── register.vue .................. /tournaments/:id/register
        ├── topic-vote.vue ................ /tournaments/:id/topic-vote
        ├── topic-votes.vue ............... /tournaments/:id/topic-votes
        ├── judge.vue ..................... /tournaments/:id/judge
        ├── public.vue .................... /tournaments/:id/public
        ├── timer.vue ..................... /tournaments/:id/timer
        └── offline.vue ................... /tournaments/:id/offline
```

---

## 相关文件索引

| 类别 | 文件路径 | 说明 |
|------|----------|------|
| 根组件 | `app/app.vue` | 应用根组件，含全局 Toast |
| 布局 | `app/layouts/default.vue` | 默认布局 |
| 布局 | `app/layouts/tournament.vue` | 赛事详情布局 |
| 布局 | `app/layouts/standalone.vue` | 独立赛事布局 |
| 中间件 | `app/middleware/auth.global.ts` | 全局鉴权中间件 |
| 配置 | `nuxt.config.ts` | Nuxt 配置（含路由规则） |
| 状态 | `app/stores/auth.ts` | 认证状态管理 |
| 组合式函数 | `app/composables/useAuth.ts` | 认证逻辑封装 |
| 组合式函数 | `app/composables/useTournament.ts` | 赛事数据获取 |

---

*文档生成时间：2026-07-07*
*项目版本：DebateTimerV3*
