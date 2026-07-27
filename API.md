# DebateTimerV3 后端 API 文档

> 文档生成时间：2026-07-27
> 框架：Nuxt 4 + Nitro + Prisma / SQLite
> 本文档由 `server/api/` 下所有 `.ts` 文件逐文件读取整理而成，共 **136 个 HTTP 端点 + 1 个 WebSocket 接口**，按 13 个模块分组。

## 概述

- **项目**：DebateTimerV3，一个辩论赛计时与赛事管理平台（含 QQ 频道机器人集成）。
- **框架**：Nuxt 4（前端）+ Nitro（服务端 API 路由）+ Prisma ORM（SQLite 数据库）。
- **Base URL**：所有接口以 `/api` 为前缀，例如 `GET /api/auth/me`。
- **路由约定**：Nitro 文件路由，`server/api/<path>.get.ts` 对应 `GET /api/<path>`，方法后缀 `.get/.post/.put/.delete` 决定 HTTP 方法；目录与文件名（去掉方法后缀和 `.ts`）即路径，动态段用 `[param]` 表示（文档中替换为 `{param}` 并标注含义）。
- **通用约定见下方「通用约定 / 鉴权」一节**。

---

## 通用约定 / 鉴权

### 用户认证（Bearer JWT）
- 大多数需要登录的接口在请求头携带：`Authorization: Bearer <JWT>`。令牌由登录接口返回。
- `getUserFromEventWithSession(event, prisma)`：校验 JWT 并额外比对用户的 `tokenVersion` 字段；若不一致（如被其他设备踢下线）返回 `401`，消息为「账号已在其他设备登录，请重新登录」。
- `getUserFromEvent(event)`：仅校验 JWT，不校验单设备登录（仅个别公开只读接口使用，如 `standings`）。

### 角色（role）
代码中实际出现的角色（见 `prisma/schema.prisma` User.role 注释）：
- `system_admin`：系统管理员，可管理所有团队、用户、后台。
- `admin`：团队管理员（归属某个团队 `teamId`）。
- `subaccount`：团队子账号（辩手等）。
- `individual`：个人用户（个人模式 `mode='individual'`）。
- 另存在 `mode` 字段（`qq_bot` / `team` / `individual` / `system`），用于区分团队类型；QQ 机器人功能仅对 `mode='qq_bot'` 的团队开放。
- `requireRole(event, ...roles)`：要求调用者角色在给定列表中，否则 `403`。

### 内部接口密钥（INTERNAL_API_KEY）
- 内部自动化接口（`/api/internal/...`）使用 `verifyInternalKey(event)` 校验。
- GET 请求：密钥放在 query 参数 `?internalKey=xxx`。
- POST 请求：密钥放在请求体字段 `internalKey`。

### 服务令牌（Bearer team.apiToken）
- 团队自动化端点（`/api/scheduled-posts/dispatch*`、`/api/scheduled-posts/publish`）使用 `requireServiceToken(event, prisma)` 校验。
- 在 `Authorization: Bearer <team.apiToken>` 中传递（与用户 JWT 隔离）。令牌由 `POST /api/team/api-token` 生成，仅一次性明文返回。

### 错误格式
- 使用 Nitro 的 `createError`，返回 `{ statusCode, message }`（`message` 为中文）。部分接口还会包裹 `{ code, message, data }` 或 `{ success, message, ... }`，以源码实际返回为准。
- 成功响应无统一包装，直接返回业务对象。

### 分页约定
- 列表类接口常用 query 参数 `page`（默认 1）、`pageSize`（默认 50，最大 200），返回 `{ ..., pagination: { page, pageSize, total, totalPages } }`。

---

## 一、认证与账户（`/api/auth`）

### POST /api/auth/login
- **鉴权**：公开（无需登录）
- **请求体**：`username`(string)、`password`(string)
- **响应**：若该账号已有活跃会话，返回 `{ needConfirm: true, userId, existingSessions, newDevice, user, tokenVersion }`；否则创建会话并返回 `{ token, sessionId, needConfirm: false, user }`，并通过 `Set-Cookie` 写入 `auth_token` / `auth_user`。
- **说明**：用户登录。检测到其他设备在线时要求二次确认（走 confirm-login），实现单设备登录限制。

### POST /api/auth/confirm-login
- **鉴权**：公开
- **请求体**：`username`、`password`
- **响应**：`{ token, sessionId, tokenVersion, message, user }`
- **说明**：用户在 login 返回 `needConfirm` 后确认登录：递增 `tokenVersion` 使旧设备令牌失效，强制下线原设备，创建新会话。

### GET /api/auth/login-status
- **鉴权**：登录（单设备校验，`getUserFromEventWithSession`）
- **响应**：`{ currentTokenVersion, currentSession, otherSessions, historySessions, totalActiveCount }`
- **说明**：返回当前用户的所有登录会话，用于多设备检测弹窗。

### GET /api/auth/me
- **鉴权**：登录（单设备校验）
- **响应**：`{ id, username, nickname, email, avatar, role, mode, team }`
- **说明**：获取当前登录用户信息。

### PUT /api/auth/password
- **鉴权**：登录（单设备校验）
- **请求体**：`oldPassword`、`newPassword`
- **响应**：`{ message: '密码修改成功，请使用新密码重新登录' }`
- **说明**：修改密码，成功后递增 `tokenVersion` 并强制所有旧会话下线。

### PUT /api/auth/profile
- **鉴权**：登录（单设备校验）
- **请求体**（均可选）：`username`、`nickname`(string|null)、`email`(string|null)、`avatar`(string|null)
- **响应**：更新后的用户对象（同 me）
- **说明**：更新个人资料；用户名唯一性校验，邮箱格式校验。

### POST /api/auth/terminate-others
- **鉴权**：登录（单设备校验）
- **请求体**：无
- **响应**：`{ success, token, message, tokenVersion }`
- **说明**：强制下线其他设备，递增 `tokenVersion`，返回新 token。

---

## 二、团队管理（`/api/teams`、`/api/team`）

> 注：动态段 `{teamId}` 对应 Team 模型主键（短 ID）。

### GET /api/teams
- **鉴权**：登录（单设备校验）
- **响应**：团队列表。system_admin 看全部，否则只看自己管理的团队（`adminId=userId`）。
- **说明**：获取团队列表。

### POST /api/teams
- **鉴权**：`requireRole(event, 'system_admin')`
- **请求体**：`name`、`mode`(`qq_bot`|`team`)、`adminUsername`、`adminPassword`、`botAppId?`、`botAppSecret?`、`botChannelId?`
- **响应**：`{ id, name, mode, adminId, botConfig, createdAt }`（201）
- **说明**：系统管理员创建团队，同时创建团队管理员账号（role=admin）。

### GET /api/teams/{teamId}
- **鉴权**：公开（无鉴权）
- **响应**：团队详情（含 members、tournaments、botConfig）
- **说明**：获取团队详情。

### PUT /api/teams/{teamId}
- **鉴权**：登录（单设备校验）+ 权限（system_admin 或 `team.adminId === 当前用户`）
- **请求体**（可选）：`name`、`botAppId`(string|null)、`botAppSecret`(string|null)、`botChannelId`(string|null)
- **响应**：更新后的团队对象
- **说明**：更新团队基本信息与 Bot 配置。

### DELETE /api/teams/{teamId}
- **鉴权**：`requireRole(event, 'system_admin')`
- **响应**：`{ message: '团队已删除' }`
- **说明**：删除团队。

### GET /api/teams/{teamId}/members
- **鉴权**：公开（无鉴权）
- **响应**：成员列表（含 userId、username、role、assignedMatches）
- **说明**：获取团队成员列表。

### POST /api/teams/{teamId}/members
- **鉴权**：登录（单设备校验）+ 权限（system_admin 或团队 admin）
- **请求体**：`username`、`password`
- **响应**：`{ id, username, role, createdAt }`（201）
- **说明**：新增团队子账号（role=subaccount）。

### DELETE /api/teams/{teamId}/members/{userId}
- **鉴权**：登录（单设备校验）+ 权限（system_admin 或团队 admin）
- **响应**：`{ message: '子账号已删除' }`
- **说明**：删除成员（不能删团队管理员），并重置其 role/mode/teamId。

### PUT /api/teams/{teamId}/members/{userId}
- **鉴权**：登录（单设备校验）+ 权限
- **请求体**（可选）：`username`、`nickname`(string|null)、`email`(string|null)、`avatar`(string|null)
- **响应**：`{ message, user }`
- **说明**：更新团队成员个人信息。

### PUT /api/teams/{teamId}/members/{userId}/reset-password
- **鉴权**：登录（单设备校验）+ 权限
- **请求体**：`newPassword`
- **响应**：`{ message: '密码重置成功，成员需使用新密码重新登录' }`
- **说明**：团队管理员重置成员密码（不能重置自己）。

### DELETE /api/teams/{teamId}/members/cleanup
- **鉴权**：登录（单设备校验）+ 权限
- **响应**：`{ deleted, message }`
- **说明**：批量清理该团队下所有子账号。

### GET /api/teams/{teamId}/tournaments
- **鉴权**：公开（无鉴权）
- **响应**：该团队的赛事列表（含 teams、judges、matchCount）
- **说明**：获取团队下的赛事列表。

### POST /api/teams/{teamId}/tournaments
- **鉴权**：登录（单设备校验）+ 权限（system_admin 或团队 admin）
- **请求体**：`name`、`description?`、`format?`、`scheduledAt?`、`venue?`、`teams?`(string[])、`judges?`(string[])
- **响应**：新建赛事对象（201）
- **说明**：在团队下创建赛事，并异步推送 Bot 通知。

### POST /api/team/api-token
- **鉴权**：登录（单设备校验）+ `requireRole(event, 'admin', 'system_admin')`
- **请求体**：无
- **响应**：`{ apiToken }`（仅此一次明文返回）
- **说明**：生成/重置当前团队的服务令牌（team.apiToken），用于自动化端点。

---

## 三、赛事管理（`/api/tournaments`）

> 动态段说明：`{id}` = Tournament 主键（短 ID）；`{regId}` = Registration 主键；`{topicId}` = DebateTopic 主键；`{questionnaireId}` = Questionnaire 主键；`{voteId}` = TopicVote 主键。
> 写操作统一使用 `requireWriteTournament`（登录 + 赛事所属团队管理员 / system_admin）；读操作使用 `requireReadTournament`（登录 + 管理员/子账号可读）。

### GET /api/tournaments/{id}
- **鉴权**：登录（单设备校验）+ `canReadTournament`（管理员/已报名参赛者可读，否则 403）
- **响应**：赛事详情（含 team、teams、judges、扩展配置 bestDebaterMode/groupCount/topicPool、报名配置、fields、matches 等）
- **说明**：获取赛事完整详情。

### PUT /api/tournaments/{id}
- **鉴权**：写权限（requireWriteTournament）
- **请求体**（可选）：`name`、`description`、`format`、`status`、`scheduledAt`、`venue`、`teams`(string[])、`judges`(string[])
- **响应**：`{ success, message }`
- **说明**：更新赛事基础信息、队伍列表、评委列表（整体替换）。

### DELETE /api/tournaments/{id}
- **鉴权**：写权限
- **响应**：`{ message: '赛事已删除' }`
- **说明**：删除赛事。

### GET /api/tournaments/{id}/public
- **鉴权**：公开（仅 `isPublic=true` 的赛事，否则 404）
- **响应**：`{ success, data }`（赛事公开信息、报名配置、fields、队伍、评委、统计）
- **说明**：公开赛事详情，用于宣传/报名页。

### GET /api/tournaments/public.list
- **鉴权**：公开
- **查询参数**：`page`、`pageSize`、`keyword`、`status`
- **响应**：`{ success, data: { list, pagination } }`
- **说明**：公开赛事列表（isPublic=true），支持关键词与状态筛选。

### GET /api/tournaments/{id}/my-registration
- **鉴权**：登录（单设备校验）
- **响应**：当前用户在该赛事下的报名记录数组（含 members）
- **说明**：查询「我」在指定赛事的报名记录。

### POST /api/tournaments/{id}/register
- **鉴权**：公开（未登录用户可报名 `isPublic` 赛事；已登录用户需通过单设备校验）
- **请求体**：`type`(`individual`|`team`)、`teamName?`、`submitterName`、`contactPhone`、`contactEmail?`、`notes?`、`customData?`(Record)、`members`(数组：`{ name, preferredPosition?, experience? }`)
- **响应**：`{ code:0, message, data: { id, tournamentId, type, status, ... } }`（201）
- **说明**：提交赛事报名（个人/队伍），含防重复、截止时间校验，并同步写入统一问卷。

### GET /api/tournaments/{id}/registration-config
- **鉴权**：公开
- **响应**：`{ id, name, ...报名设置, fields: [...] }`
- **说明**：获取报名配置（含系统字段+自定义字段）。

### PUT /api/tournaments/{id}/registration-fields
- **鉴权**：写权限
- **请求体**：`{ fields: RegistrationFieldInput[] }`，单字段含 `fieldName, fieldKey, fieldType, fieldOptions?, required, sortOrder, appliesTo, placeholder?, description?, width?, systemField?`
- **响应**：`{ success, fields }`
- **说明**：整体替换报名表单字段配置（系统字段保留，自定义字段重建）。

### PUT /api/tournaments/{id}/registration-settings
- **鉴权**：写权限
- **请求体**（可选）：`registrationOpen`(bool)、`registrationDeadline`(ISO string|null)、`isPublic`(bool)、`registrationType`(`individual`|`team`|`both`)、`teamSize`(number|null)、`registrationInfo`(string|null)
- **响应**：`{ data: {...} }`
- **说明**：更新赛事报名设置。

### GET /api/tournaments/{id}/registrations
- **鉴权**：读权限（requireReadTournament）
- **查询参数**：`status`、`type`、`page`、`pageSize`
- **响应**：`{ registrations, pagination }`
- **说明**：获取报名记录列表（含成员），支持状态/类型筛选。

### PUT /api/tournaments/{id}/registrations/{regId}
- **鉴权**：写权限
- **请求体**：`action`(`approve`|`reject`)、`reviewNote?`
- **响应**：`{ success, status }`
- **说明**：审核（通过/拒绝）某条报名记录。

### POST /api/tournaments/{id}/registrations/auto-match
- **鉴权**：写权限
- **请求体**：`{ teamSize? }`
- **响应**：`{ teams: [{ suggestedName, members }], unmatched: [...] }`
- **说明**：个人报名自动组队预览（按辩位均衡），不写库。

### POST /api/tournaments/{id}/registrations/convert-teams
- **鉴权**：写权限
- **请求体**：`{ items: [{ name, registrationIds: string[] }] }`
- **响应**：`{ success, created, accounts: [{ teamName, username, password, name }] }`
- **说明**：将报名记录合并为参赛队伍（TournamentTeam），并为每位队员创建子账号，明文密码仅此一次返回。

### POST /api/tournaments/{id}/registrations/create-accounts
- **鉴权**：写权限
- **请求体**：`{ registrationIds? }`（缺省处理所有已通过且已转队的报名）
- **响应**：`{ success, created, accounts: [{ username, password, name, registrationId }] }`
- **说明**：为已转队的报名成员批量创建辩手子账号。

### POST /api/tournaments/{id}/draw-lots
- **鉴权**：登录（单设备校验）+ `canWriteTournament`
- **请求体**：`{ drawType: 'groups'|'topics_sides'|'all', groupCount?, topicPool?: {pro,con}[], bestDebaterMode?: 'both'|'winner_only' }`
- **响应**：`{ success, info, groupCount, topicCount, result }`
- **说明**：抽签：分组 / 辩题与正反方随机抽取，事务写入。

### PUT /api/tournaments/{id}/default-fields
- **鉴权**：写权限
- **请求体**：`{ fields: [{ fieldKey, appliesTo, required }] }`
- **响应**：`{ data: { id, defaultFieldsConfig } }`
- **说明**：配置默认报名字段的适用类型与必填性。

### GET /api/tournaments/{id}/matches
- **鉴权**：读权限（requireReadTournament）
- **响应**：该赛事下所有比赛（含队伍、比分、状态、topic、正反方、最佳辩手等）
- **说明**：获取赛程（对阵）列表。

### POST /api/tournaments/{id}/matches
- **鉴权**：写权限
- **请求体**：`round`(string)、`orderNum`(number)、`teamA?`、`teamB?`、`scheduledAt?`
- **响应**：新建比赛对象（201）
- **说明**：手动新增一场比赛。

### POST /api/tournaments/{id}/matches/generate
- **鉴权**：写权限
- **请求体**：`{ format, teams: [{name, seed?}], seedMethod?, byeHandling?, roundRobinMode?, enableRevivalFinal?, rounds?, pairingAlgo?, groupSize?, promotePerGroup?, knockoutFormat?, clearExisting? }`
- **响应**：`{ code, message, data: { format, formatLabel, totalMatches, roundCount, matchIds } }`
- **说明**：按赛制（单败/双败/循环/佩寄/瑞士/小组+淘汰）自动生成赛程。

### GET /api/tournaments/{id}/judge/matches
- **鉴权**：登录（单设备校验）+ `canReadTournament`（未登录也可凭 `judgeName` 查询）
- **查询参数**：`judgeName`(必填)
- **响应**：`{ success, data: { tournament, judgeName, stats, matches } }`
- **说明**：评委视角比赛列表，含该评委是否已评分。

### GET /api/tournaments/{id}/match-score-stats
- **鉴权**：读权限
- **响应**：`{ success, hasTemplate, questionnaireId, title, settings, matches, overall, submissionTotal }`
- **说明**：评分问卷统计聚合（各场 scale 题均值/分布）。

### GET /api/tournaments/{id}/standings
- **鉴权**：公开（isPublic 赛事直接可读；非公开需登录 + `canReadTournament`，否则 404）
- **响应**：`{ success, data: { tournament, standings, groupStandings, matchStats, bestDebaters, judgeRankings } }`
- **说明**：积分榜与赛事统计（含最佳辩手、评委评分榜）。

### GET /api/tournaments/{id}/scores
- **鉴权**：登录（单设备校验）+ 角色 admin/system_admin/subaccount
- **查询参数**：`matchId?`、`type?`(`rankings`|`stats`)
- **响应**：`{ success, ...排名/统计/单场评分 }`
- **说明**：获取赛事评分（排名、统计或指定比赛评分详情）。

### POST /api/tournaments/{id}/scores
- **鉴权**：登录（单设备校验，管理员/子账号）+ 或评委身份（在评委名单中）
- **请求体**：`{ matchId, judgeName, dimensions, reason?, scoreTeamA, scoreTeamB, winner, bestDebaterA?, bestDebaterB? }`
- **响应**：`{ success, message, scoreId }`
- **说明**：提交评委评分（管理员可代录；评委只能提交本人评分）。

### POST /api/tournaments/{id}/result-settings
- **鉴权**：登录（单设备校验）+ 管理员（system_admin 或团队 admin）
- **请求体**：`{ bestDebaterMode: 'both'|'winner_only' }`
- **响应**：`{ success, bestDebaterMode }`
- **说明**：保存最佳辩手评选模式。

### GET /api/tournaments/{id}/timer-config
- **鉴权**：读权限
- **响应**：`{ data: { ...计时器完整配置(含 stages), isNew } }`
- **说明**：获取赛事关联计时器项目配置。

### PUT /api/tournaments/{id}/timer-config
- **鉴权**：写权限
- **请求体**：`title, positiveTopic?, negativeTopic?, teamPositiveName?, teamNegativeName?, uiConfig?, skinConfig?, audioConfig?, teamLogoConfig?, stages?`
- **响应**：`{ data: { ...更新后的计时器配置 } }`
- **说明**：保存/更新赛事计时器配置（upsert）。

### GET /api/tournaments/{id}/timer-template
- **鉴权**：读权限
- **响应**：`{ id?, phases, updatedAt? }`（无则 `{ phases: '[]' }`）
- **说明**：获取赛事计时器环节模板。

### PUT /api/tournaments/{id}/timer-template
- **鉴权**：写权限
- **请求体**：`{ phases: string(JSON) }`
- **响应**：`{ id, phases, updatedAt }`
- **说明**：保存赛事计时器环节模板。

### GET /api/tournaments/{id}/debate-topics
- **鉴权**：读权限
- **查询参数**：`search?`、`category?`
- **响应**：`{ topics: [...] }`
- **说明**：获取赛事辩题库列表。

### POST /api/tournaments/{id}/debate-topics
- **鉴权**：写权限
- **请求体**：`{ affirmative, negative, category?, note? }`
- **响应**：`{ topic }`
- **说明**：新增辩题库条目。

### DELETE /api/tournaments/{id}/debate-topics/{topicId}
- **鉴权**：写权限
- **响应**：`{ success }`
- **说明**：删除辩题库条目。

### PUT /api/tournaments/{id}/debate-topics/{topicId}
- **鉴权**：写权限
- **请求体**（可选）：`affirmative`、`negative`、`category`、`note`
- **响应**：`{ topic }`
- **说明**：更新辩题库条目。

### POST /api/tournaments/{id}/debate-topics/import
- **鉴权**：写权限
- **请求体**：`{ topics: [{ affirmative?, negative?, category?, note? }] }`
- **响应**：`{ created, skipped, total }`
- **说明**：批量导入辩题（CSV 整理后的数组），按 正|反 去重。

### GET /api/tournaments/{id}/questionnaires
- **鉴权**：读权限
- **查询参数**：`sourceType?`、`status?`
- **响应**：问卷列表（含题目数、提交数）
- **说明**：获取通用问卷列表（报名/投票/评分）。

### POST /api/tournaments/{id}/questionnaires
- **鉴权**：写权限
- **请求体**：`{ sourceType, sourceId, title, description?, status?, settings?, questions: [...] }`
- **响应**：`{ success, id }`
- **说明**：保存问卷设计（upsert），题型含 text/radio/checkbox/select/scale 等。

### GET /api/tournaments/{id}/questionnaires/{questionnaireId}
- **鉴权**：读权限
- **响应**：问卷详情（含 questions 与最近 100 条 submissions）
- **说明**：获取单份问卷详情。

### POST /api/tournaments/{id}/questionnaires/{questionnaireId}/submit
- **鉴权**：依问卷 `settings.audience`（`public` 匿名 / `loggedIn` 登录 / `judges` 评委）
- **请求体**：`{ matchId, answers, respondentName? }`
- **响应**：`{ success, submissionId, updated }`
- **说明**：提交评分问卷（match_score 来源），含受众校验与防重复。

### GET /api/tournaments/{id}/topic-votes
- **鉴权**：读权限
- **查询参数**：`status?`、`matchId?`（`none` 表示赛事级）
- **响应**：投票列表（含每条 totalVotes 统计）
- **说明**：获取辩题投票列表。

### POST /api/tournaments/{id}/topic-votes
- **鉴权**：写权限
- **请求体**：`{ title, description?, topics: any[], matchId?(null=赛事级), allowedVoters?: string[], multipleChoice?, deadline?, showResults?, status? }`
- **响应**：新建投票对象（201）
- **说明**：创建辩题投票（赛事级或场次级）。

### GET /api/tournaments/{id}/topic-votes/{voteId}
- **鉴权**：公开（`allowedVoters` 含 `public`）或登录 + 读权限（非公开）
- **响应**：投票详情；`showResults` 或管理员可见 stats，否则仅总票数
- **说明**：获取投票详情。

### PUT /api/tournaments/{id}/topic-votes/{voteId}
- **鉴权**：写权限
- **请求体**（可选）：`title`、`description`、`topics`、`matchId`、`allowedVoters`、`multipleChoice`、`deadline`、`showResults`、`status`
- **响应**：`{ id, title, ..., updatedAt }`
- **说明**：编辑投票配置。

### DELETE /api/tournaments/{id}/topic-votes/{voteId}
- **鉴权**：写权限
- **响应**：`{ success, message }`
- **说明**：删除投票（级联清理记录与统一问卷索引）。

### POST /api/tournaments/{id}/topic-votes/{voteId}/cast
- **鉴权**：公开或登录（按 `allowedVoters` 判定；登录用户按角色自动判定 voterType，未登录可自报 judge/debater）
- **请求体**：`{ topicIndices: number[], voterName?, voterType? }`
- **响应**：`{ success, message, recordId, topicIndices }`（201）
- **说明**：提交投票（防重复、截止校验、单选校验）。

### GET /api/tournaments/{id}/topic-votes/{voteId}/my-record
- **鉴权**：登录（单设备校验，可选；未登录返回 `{ record: null }`）
- **响应**：`{ record: { id, topicIndices, voterType, createdAt } | null }`
- **说明**：查询当前登录用户在该投票中的记录。

### GET /api/tournaments/{id}/topic-votes/{voteId}/stats
- **鉴权**：读权限
- **响应**：`{ id, title, topics, status, multipleChoice, deadline, allowedVoterTypes, totalVotes, results, byType, voters }`
- **说明**：投票详细统计（含各选项得票、投票者类型分布、投票者列表）。

---

## 四、独立赛事（`/api/standalone-matches`）

> `{id}` = StandaloneMatch 主键（短 ID）。仅 `mode='individual'` 的个人用户可访问。

### GET /api/standalone-matches
- **鉴权**：登录（单设备校验）+ 个人模式
- **响应**：当前用户的独立赛事列表（含 matchCount）
- **说明**：获取个人独立赛事列表。

### POST /api/standalone-matches
- **鉴权**：登录（单设备校验）+ 个人模式
- **请求体**：`name`、`description?`、`venue?`、`scheduledAt?`
- **响应**：新建独立赛事（201）
- **说明**：创建个人独立赛事。

### GET /api/standalone-matches/{id}
- **鉴权**：登录（单设备校验）+ 创建者本人或 system_admin
- **响应**：独立赛事详情（含 matches 及关联计时器状态）
- **说明**：获取独立赛事详情。

### PUT /api/standalone-matches/{id}
- **鉴权**：登录（单设备校验）+ 创建者本人
- **请求体**（可选）：`name`、`description`、`venue`、`status`、`scheduledAt`
- **响应**：更新后的赛事对象
- **说明**：更新独立赛事信息。

### DELETE /api/standalone-matches/{id}
- **鉴权**：登录（单设备校验）+ 创建者本人
- **响应**：`{ message: '独立赛事已删除' }`
- **说明**：删除独立赛事。

### POST /api/standalone-matches/{id}/matches
- **鉴权**：登录（单设备校验）+ 创建者本人
- **请求体**：`round`、`orderNum`、`teamA?`、`teamB?`、`scheduledAt?`
- **响应**：新建比赛（201）
- **说明**：在独立赛事下新增一场比赛。

### GET /api/standalone-matches/{id}/timer-config
- **鉴权**：登录（单设备校验）+ 创建者本人或 system_admin
- **响应**：`{ data: { ...计时器配置(含 stages), isNew } }`
- **说明**：获取独立赛事计时器配置。

### PUT /api/standalone-matches/{id}/timer-config
- **鉴权**：登录（单设备校验）+ 创建者本人或 system_admin
- **请求体**：同赛事 timer-config（title、topics、configs、stages）
- **响应**：`{ data: { ...更新后的配置 } }`
- **说明**：保存独立赛事计时器配置。

### GET /api/standalone-matches/{id}/timer-template
- **鉴权**：登录（单设备校验）+ 创建者本人或 system_admin
- **响应**：`{ id?, phases, updatedAt? }`
- **说明**：获取独立赛事计时器环节模板。

### PUT /api/standalone-matches/{id}/timer-template
- **鉴权**：登录（单设备校验）+ 创建者本人或 system_admin
- **请求体**：`{ phases: string(JSON) }`
- **响应**：`{ id, phases, updatedAt }`
- **说明**：保存独立赛事计时器环节模板。

---

## 五、对局管理（`/api/matches`）

> `{id}` = Match 主键（UUID）。顶层 matches 指独立/赛事下比赛的通用操作，涉及赛事时要求赛事写权限（`canWriteTournament`）。

### GET /api/matches/{id}
- **鉴权**：公开（无鉴权）
- **响应**：比赛详情（含 tournament、standaloneMatch、timer、assignedUsers）
- **说明**：获取单场比赛详情。

### PUT /api/matches/{id}
- **鉴权**：登录（单设备校验）+ `canWriteTournament`（须归属赛事）
- **请求体**（可选）：`round`、`orderNum`、`teamA`、`teamB`、`scheduledAt`、`status`、`currentVersion`(乐观锁)
- **响应**：更新后的比赛对象（含 version）
- **说明**：更新比赛信息，含乐观锁防并发覆盖。

### DELETE /api/matches/{id}
- **鉴权**：登录（单设备校验）+ `canWriteTournament`
- **请求体**：`{ currentVersion?, deleteReason? }`
- **响应**：`{ code:0, message, data: { match: { id, status:'deleted', version, deletedAt } } }`
- **说明**：软删除比赛（有晋级依赖时拒绝），乐观锁校验。

### POST /api/matches/{id}/restore
- **鉴权**：登录（单设备校验）+ `canWriteTournament`
- **请求体**：`{ currentVersion? }`
- **响应**：`{ code:0, message, data: { match: { id, deletedAt:null, version } } }`
- **说明**：恢复已软删除的比赛。

### POST /api/matches/{id}/result
- **鉴权**：登录（单设备校验）+ `canWriteTournament`
- **请求体**：`{ winner: 'A'|'B'|'draw', scoreA, scoreB, bestDebaterA?, bestDebaterB?, judge?, currentVersion? }`
- **响应**：`{ code:0, message, data: { id, winner, scoreA, scoreB, status:'finished', version, advanced, format } }`
- **说明**：录入赛果，自动累计积分、晋级胜者（淘汰赛/小组出线/瑞士重配对），并触发 Bot 通知。

### POST /api/matches/{id}/start
- **鉴权**：登录（单设备校验）+ `canWriteTournament`
- **请求体**：无
- **响应**：`{ success, message, data: { id, status:'in_progress', teamA, teamB } }`
- **说明**：开始比赛（pending→in_progress），触发 Bot 通知。

---

## 六、计时器项目（`/api/timer`）

> `{id}` = DebateTimerProject 主键。仅项目创建者本人可访问。

### GET /api/timer/projects
- **鉴权**：登录（单设备校验）
- **响应**：当前用户的计时器项目列表（含 stages）
- **说明**：获取我的计时器项目列表。

### POST /api/timer/projects
- **鉴权**：登录（单设备校验）
- **请求体**：`{ name?, title?, positiveTopic?, negativeTopic?, teamPositiveName?, teamNegativeName?, uiConfig? }`
- **响应**：`{ success, data: { id, name, title } }`
- **说明**：创建计时器项目。

### GET /api/timer/projects/{id}
- **鉴权**：登录（单设备校验）+ 创建者本人
- **响应**：`{ success, data: { ...项目与 stages } }`
- **说明**：获取单个计时器项目详情。

### PUT /api/timer/projects/{id}
- **鉴权**：登录（单设备校验）+ 创建者本人
- **请求体**：`{ title?, name?, positiveTopic?, negativeTopic?, teamPositiveName?, teamNegativeName?, uiConfig?, stages? }`
- **响应**：`{ success, data: { id, name, title, stageCount } }`
- **说明**：更新项目与环节（diff 同步）。

### DELETE /api/timer/projects/{id}
- **鉴权**：登录（单设备校验）+ 创建者本人
- **响应**：`{ success, message: '已删除' }`
- **说明**：删除计时器项目（级联删除环节）。

---

## 七、机器人 / QQ 频道（`/api/bot`，含 WebSocket `/api/bot/ws`）

> 鉴权统一：登录（单设备校验）+ 角色 `admin` 或 `system_admin`，且团队 `mode='qq_bot'`（部分只读接口允许 subaccount）。
> 详见 WebSocket 专节。

### GET /api/bot/status
- **鉴权**：登录 + admin/system_admin
- **响应**：`readBotRuntimeStatus(...)` 的 Bot 运行时状态快照
- **说明**：获取 Bot 状态（HTTP 替代 WS 轮询）。

### PUT /api/bot/config
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ botAppId?, botAppSecret?, botChannelId?, botIsPrivate? }`
- **响应**：`{ success, message, config: { appId(脱敏), channelId } }`
- **说明**：更新 Bot 配置并按需重启/停止实例。

### POST /api/bot/unbind
- **鉴权**：登录 + admin/system_admin
- **请求体**：无
- **响应**：`{ success, message: 'Bot 已解绑...' }`
- **说明**：解绑 Bot（清除配置并断开连接）。

### GET /api/bot/channels
- **鉴权**：登录 + admin/system_admin
- **响应**：`{ guilds: [{ id, name, ownerId?, joinedAt? }], error? }`
- **说明**：获取 Bot 加入的频道/服务器列表（调用 QQ API）。

### GET /api/bot/channels/{guildId}/subchannels
- **鉴权**：登录 + admin/system_admin
- **路径参数**：`{guildId}` = 频道（服务器）ID
- **响应**：`{ channels: [{ id, name, type?, subType?, parentId? }], error? }`
- **说明**：获取指定频道下的子频道列表。

### POST /api/bot/forum/post
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ channelId, title, content }`
- **响应**：`{ success, threadId, taskId }`（502 表示 QQ API 失败）
- **说明**：测试发帖（论坛主题）。

### POST /api/bot/schedule
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ teamId, priority?, customDelayMs?, enabled? }`
- **响应**：`{ success, message }`
- **说明**：设置 Bot 启动调度配置。

### GET /api/bot/debug/config
- **鉴权**：**无（公开）⚠️ 见注意事项**
- **响应**：`{ success, count, teams: [{ id, name, botAppId, botAppSecret(明文), botSecretLength, botChannelId }] }`
- **说明**：读取数据库中已配置 Bot 凭证的团队及其 `botAppSecret` 明文。**存在严重安全隐患**。

### GET /api/bot/permission-logs
- **鉴权**：登录 + admin/system_admin
- **查询参数**：`teamId?`、`limit?`(≤200)、`action?`、`offset?`
- **响应**：`{ success, total, limit, offset, logs }`
- **说明**：查询权限操作日志（BotPermissionLog）。

### POST /api/bot/permissions/apply-stage
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ channelId, targetRoles?: string[] }`（空数组=默认权限）
- **响应**：`{ success, targetRoles, isDefault, applied, allowed, denied }`
- **说明**：按当前环节发言方套用赛场发言权限。

### POST /api/bot/permissions/grant-speak
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ userId, username, channelId, durationMs? }`
- **响应**：`{ success, message, ... }`
- **说明**：授权观众在指定频道临时发言。

### POST /api/bot/permissions/reset
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ channelId }`
- **响应**：`{ success, message, ... }`
- **说明**：重置赛场所有身份组发言权限。

### POST /api/bot/permissions/revoke-speak
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ userId, username, channelId }`
- **响应**：`{ success, message, ... }`
- **说明**：撤销观众临时发言。

### POST /api/bot/permissions/set-role
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ channelId, qqRoleId, allow: boolean }`
- **响应**：`{ success, allow, label }`
- **说明**：按单个身份组切换发言权限（含越权校验：身份组须属本团队活跃赛场）。

### POST /api/bot/permissions/switch-round
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ targetSide: 'affirmative'|'negative'|'judge'|'audience', channelId }`
- **响应**：`{ success, message, ... }`
- **说明**：切换环节白名单（按阵营放开发言）。

### POST /api/bot/arena/claim
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ arenaId, roleId, userId, username, guildId? }`
- **响应**：`{ success, message, claimId }`
- **说明**：管理员通过 HTTP 认领赛场身份（含跨团队越权防护）。

### GET /api/bot/arena/claims
- **鉴权**：登录 + admin/system_admin/（含 `member` 角色判断，见注意事项）
- **查询参数**：`arenaId?`、`teamId?`
- **响应**：`{ success, arena: { id, name, roles:[{label, claims, isFull}], ... } }`
- **说明**：获取赛场认领列表。

### POST /api/bot/arena/close
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ channelId, guildId? }`
- **响应**：关闭结果（成功则物理删除赛场）
- **说明**：关闭并清理赛场。

### POST /api/bot/arena/create
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ name, matchFormat: '4v4'|'3v3'|'2v2', channelId, guildId? }`
- **响应**：创建结果（含角色与认领结构）
- **说明**：创建赛场（在 QQ 频道建身份组）。

### GET /api/bot/arena/list
- **鉴权**：登录 + admin/system_admin/subaccount
- **查询参数**：`teamId?`、`status?`(默认 active)
- **响应**：`{ success, total, arenas: [...] }`
- **说明**：获取团队赛场列表。

### GET /api/bot/arena/status
- **鉴权**：登录 + admin/system_admin
- **查询参数**：`channelId?`
- **响应**：`{ active, total, arenas: [...] }`
- **说明**：获取赛场状态（按 channelId 筛选或返回全部活跃赛场）。

### GET /api/bot/arena/unclaim
- **鉴权**：登录 + admin/system_admin
- **请求体**：`{ arenaId, userId, roleId? }`
- **响应**：`{ success, message }`
- **说明**：取消某用户的赛场身份认领（并尝试移除 QQ 身份组）。

---

## 八、WebSocket：`/api/bot/ws`

> 文件 `server/api/bot/ws.ts` 顶部注释即协议定义，完整抄录如下。

### 客户端 → 服务端（JSON 消息）

| type | 字段 | 说明 |
|------|------|------|
| `auth` | `token` | 首次认证（Bearer JWT 内容） |
| `connect` | — | 连接 Bot |
| `disconnect` | — | 断开 Bot |
| `status` | — | 获取状态 |
| `send` | `targetId`, `content`, `messageType?`(`channel`\|`group`\|`private`) | 发送测试消息 |
| `monitor` | `monitorType?`(`summary`\|`health`\|`detail`\|`alert`) | 资源监控 |

> 所有请求可附带 `requestId`，服务端回传时会带同一 `requestId`。

### 服务端 → 客户端（JSON 消息）

| type | 字段 | 说明 |
|------|------|------|
| `auth_ok` | `team: { id, name, mode }` | 认证成功 |
| `auth_error` | `message` | 认证失败（含「账号已在其他设备登录，请重新登录」） |
| `status` | `data: BotRuntimeStatus` | 实时状态推送 |
| `connect_result` | `success`, `message` | 连接结果 |
| `disconnect_result` | `success`, `message` | 断开结果 |
| `send_result` | `success`, `message`, `result?` | 发送结果 |
| `monitor_result` | `success`, `...data` | 监控结果 |
| `error` | `message` | 错误 |

### 鉴权与行为要点
- 未认证前仅接受 `auth` 指令；认证使用 JWT（同用户接口），并校验 `tokenVersion`（被踢下线返回 `auth_error`）。
- 仅 `admin` / `system_admin` 且 `team.mode='qq_bot'` 可认证成功。
- 认证成功后立即推送 `status`，并启动状态监控：Bot 实例状态变化（已连接/断开/重连中）时自动推送。

---

## 九、定时发布（`/api/scheduled-posts`）

> `{id}` = ScheduledPost 主键。常规 CRUD 需登录；`dispatch`/`publish`/`dispatch-due` 使用团队服务令牌（Bearer team.apiToken）。

### GET /api/scheduled-posts
- **鉴权**：登录（单设备校验）+ 团队
- **响应**：`{ success, tasks: [...] }`
- **说明**：列出当前团队的定时发布任务。

### POST /api/scheduled-posts
- **鉴权**：登录（单设备校验）+ admin/system_admin + 团队
- **请求体**：`title`、`content`、`channelId`、`type?`(`debate`|`discussion`)、`tags?`、`pollOptions?`(string[])、`scheduleType`(`once`|`daily`|`weekly`)、`runAt?`、`timeHHMM?`、`weekday?`(0-6)、`timezone?`(默认 Asia/Shanghai)
- **响应**：`{ success, task }`
- **说明**：创建定时发布任务，自动计算 `nextRunAt`。

### DELETE /api/scheduled-posts/{id}
- **鉴权**：登录（单设备校验）+ admin/system_admin + 团队
- **响应**：`{ success }`
- **说明**：删除定时任务。

### PUT /api/scheduled-posts/{id}
- **鉴权**：登录（单设备校验）+ admin/system_admin + 团队
- **请求体**（可选）：同创建；调度字段变更会重算 `nextRunAt`
- **响应**：`{ success, task }`
- **说明**：编辑定时任务。

### POST /api/scheduled-posts/{id}/dispatch
- **鉴权**：服务令牌（`requireServiceToken`，Bearer team.apiToken）
- **响应**：`{ success, run }`（立即发布，不依赖 nextRunAt）
- **说明**：WorkBuddy 自动化触发入口，立即发布指定任务。

### GET /api/scheduled-posts/{id}/runs
- **鉴权**：登录（单设备校验）+ 团队
- **响应**：`{ success, runs: [...] }`（最近 50 条发布历史）
- **说明**：获取任务发布历史（ScheduledPostRun）。

### POST /api/scheduled-posts/{id}/toggle
- **鉴权**：登录（单设备校验）+ admin/system_admin + 团队
- **请求体**：`{ paused: boolean }`
- **响应**：`{ success, task }`
- **说明**：暂停/恢复任务（仅 pending/paused 状态可切换）。

### POST /api/scheduled-posts/dispatch-due
- **鉴权**：服务令牌（`requireServiceToken`）
- **响应**：`{ triggered: number }`
- **说明**：扫描并发布所有到期任务（外部 cron/保活入口）。

### POST /api/scheduled-posts/publish
- **鉴权**：服务令牌（`requireServiceToken`）
- **请求体**：`{ channelId, title, content, type?, tags?, pollOptions? }`
- **响应**：`{ success, postTaskId }` 或 `{ success:false, message }`
- **说明**：直接生成内容并立即发帖到 QQ 频道（不经过 ScheduledPost 记录）。

---

## 十、内部接口（`/api/internal`）

> 全部使用 `verifyInternalKey(event)` 校验内部密钥（`INTERNAL_API_KEY`）；GET 走 query 参数 `internalKey`，POST 走 body 字段 `internalKey`。由计时程序/Bot 后台等内部模块调用。

### POST /api/internal/audience/grant
- **请求体**：`{ teamId, guildId, channelId, userId, username, durationMs?, internalKey }`
- **响应**：`{ success, message }`
- **说明**：授权观众临时发言（默认 5 分钟）。

### POST /api/internal/audience/revoke
- **请求体**：`{ teamId, guildId, channelId, userId, username, internalKey }`
- **响应**：`{ success, message }`
- **说明**：撤销观众临时发言。

### POST /api/internal/round/reset
- **请求体**：`{ teamId, guildId, channelId, internalKey }`
- **响应**：`{ success, message }`
- **说明**：重置赛场所有发言权限。

### POST /api/internal/round/switch
- **请求体**：`{ teamId, guildId, channelId, targetSide: 'affirmative'|'negative'|'judge'|'audience', internalKey }`
- **响应**：`{ success, message, allowed, denied }`
- **说明**：环节切换时自动调整频道发言白名单。

### GET /api/internal/tournament/next-match
- **查询参数**：`teamId`、`matchId?`、`internalKey`
- **响应**：下一场待比赛信息，或指定 `matchId` 的辩题（`getMatchTopic`）
- **说明**：获取下一场比赛 / 单场辩题。

### GET /api/internal/tournament/rankings
- **查询参数**：`teamId`、`format?`(`text`)、`internalKey`
- **响应**：`{ success, tournamentName, rankings }` 或文本格式 `text`
- **说明**：获取赛事排名（用于 Bot 消息）。

### GET /api/internal/tournament/schedule
- **查询参数**：`teamId`、`status?`、`limit?`、`internalKey`
- **响应**：`{ success, ...赛程列表 }`
- **说明**：获取赛程列表。

### GET /api/internal/tournament/scores
- **查询参数**：`matchId`、`tournamentId?`、`type?`(`stats`)、`internalKey`
- **响应**：`{ success, matchId, match, scores, totalJudges }` 或赛事评分统计
- **说明**：获取比赛评分详情 / 赛事评分统计。

### GET /api/internal/tournament/topics
- **查询参数**：`teamId`、`internalKey`
- **响应**：`{ success, ...辩题库 }`
- **说明**：获取辩题库。

---

## 十一、后台管理（`/api/admin`）

### GET /api/admin/individual-users
- **鉴权**：**无（公开）⚠️ 见注意事项**
- **响应**：个人用户列表（含其独立赛事及比赛数）
- **说明**：获取个人用户及其独立赛事数据。

### GET /api/admin/teams
- **鉴权**：`requireRole(event, 'system_admin')`
- **响应**：团队列表（含 memberCount、tournamentCount）
- **说明**：系统管理员查看所有团队。

### GET /api/admin/users
- **鉴权**：登录（单设备校验）+ system_admin
- **查询参数**：`page`、`pageSize`
- **响应**：`{ users, pagination }`
- **说明**：分页获取用户列表。

### POST /api/admin/users
- **鉴权**：`requireRole(event, 'system_admin')`
- **请求体**：`username`、`password`、`role`(`system_admin`|`admin`|`subaccount`|`individual`)、`mode`(`qq_bot`|`team`|`individual`|`system`)、`teamId?`
- **响应**：`{ id, username, role, mode, team, createdAt }`（201）
- **说明**：创建用户（含角色/模式一致性校验）。

### DELETE /api/admin/users/{id}
- **鉴权**：登录（单设备校验）+ system_admin
- **路径参数**：`{id}` = User 主键
- **响应**：`{ message: '用户已删除' }`
- **说明**：删除用户（不能删自己；若该用户是团队管理员则拒绝并提示转移）。

### PUT /api/admin/users/{id}/reset
- **鉴权**：登录（单设备校验）+ system_admin
- **路径参数**：`{id}` = User 主键
- **请求体**：`{ newPassword }`
- **响应**：`{ message: '密码重置成功，用户需使用新密码重新登录' }`
- **说明**：重置指定用户密码（递增 tokenVersion，强制下线）。

---

## 十二、上传（`/api/upload`）

### POST /api/upload
- **鉴权**：登录（单设备校验）
- **请求体**：`multipart/form-data`，字段 `file`(File)、`folder?`(`images`|`logos`|`audio`)
- **响应**：`{ success, data: { path: '/uploads/...', fileName, originalName, size, type } }`
- **说明**：上传图片/音频文件到 `public/uploads`，返回可访问的相对路径。限制：图片/音频类型，最大 10MB。

---

## 十三、数据模型索引（Prisma）

主要模型（`prisma/schema.prisma`）：

- **User**：用户账号（含 role、mode、teamId、tokenVersion）。
- **Team**：团队（含 mode、adminId、Bot 凭证 botAppId/botAppSecret/botChannelId、apiToken）。
- **TeamMember**：团队成员关联。
- **UserLoginSession**：登录会话（单设备校验，`tokenVersion`/`isActive`）。
- **Tournament**：赛事（含 format、status、报名/计时配置）。
- **TournamentTeam / TournamentJudge**：赛事参赛队伍 / 评委。
- **Match**：比赛（含 teamA/teamB、winner、scoreA/scoreB、status、round、version 乐观锁、deletedAt 软删除）。
- **MatchScore**：评委评分记录。
- **Registration / RegistrationMember / RegistrationField**：报名主记录 / 报名成员 / 报名字段。
- **Questionnaire / QuestionnaireQuestion / QuestionnaireSubmission**：统一问卷底座（报名/投票/评分共用）。
- **TopicVote / TopicVoteRecord**：辩题投票及投票记录。
- **DebateTopic**：辩题库。
- **StandaloneMatch**：个人独立赛事。
- **DebateTimerProject / DebateTimerStage / TimerTemplate / Timer**：计时器项目、环节、模板、运行态。
- **BotArena / BotArenaRole / BotArenaClaim / BotPermissionLog**：QQ 频道赛场、身份组、认领、权限日志。
- **ScheduledPost / ScheduledPostRun**：定时发布任务及执行历史。

---

## 注意事项 / 不一致点

1. **`GET /api/admin/individual-users` 缺少鉴权（公开）**：任何匿名用户可获取个人用户列表及其独立赛事、比赛数等数据，建议加上 system_admin 校验。
2. **`GET /api/bot/debug/config` 缺少鉴权且返回 `botAppSecret` 明文**：严重安全隐患，应加鉴权或直接移除/脱敏。
3. **若干 GET 接口公开**：`GET /api/teams/{teamId}`、`GET /api/teams/{teamId}/members`、`GET /api/teams/{teamId}/tournaments`、`GET /api/matches/{id}` 均无鉴权，会返回团队详情、成员用户名/邮箱、对局关联用户等信息，请确认是否符合预期。
4. **角色判断不一致**：多数 Bot 接口用 `role !== 'admin' && role !== 'system_admin'` 拒绝 subaccount；但 `GET /api/bot/arena/claims` 允许 `role === 'member'`，而 schema 注释称系统无 `member` 角色（该条件可能恒为假，属遗留代码），建议统一。
5. **`standings` 鉴权混合**：非公开赛事对未登录返回 404（隐藏存在性），对已登录用户则按 `canReadTournament` 放行，逻辑与其他只读接口（如 tournament GET）略有差异。
6. **单设备登录语义**：几乎所有「写/敏感读」接口使用 `getUserFromEventWithSession`（校验 `tokenVersion`），被其他设备踢下线会返回 401「账号已在其他设备登录，请重新登录」；而 `login`/`confirm-login`/`register` 允许匿名或宽松校验，用于登录/报名流程本身。
7. **服务令牌 vs 内部密钥**：团队自动化用 `Bearer team.apiToken`（`/api/scheduled-posts/dispatch*`、`publish`）；内部计时联动用 `INTERNAL_API_KEY`（`/api/internal/...`）。二者不同，勿混用。
