# 计时器配置页（timing.vue）+ 数据库设计诊断报告

> 检查范围：`app/pages/tournaments/[id]/timing.vue` + `app/components/StageForm.vue` + `app/components/StageTypeCascader.vue` + `app/components/RolePicker.vue` + `server/api/tournaments/[id]/timer-config.{get,put}.ts` + `prisma/schema.prisma`（DebateTimerProject / DebateTimerStage）

## 问题总览（按严重程度）

| # | 严重度 | 问题 | 位置 |
|---|---|---|---|
| 1 | P0 致命 | 5 个 StageForm 编辑的字段未持久化，刷新即丢失 | schema + GET/PUT API |
| 2 | P1 高 | `type` 字段在四处定义不一致（5/13/8 种） | schema + 前端 + Cascader + typeLabel |
| 3 | P1 高 | 「计时方式」与「语义类别」揉在同一个 `type` 字段 | 数据建模 |
| 4 | P1 高 | PUT 保存策略粗暴（先 deleteMany 再 create），id 全变 | timer-config.put.ts |
| **5** | **P1 高** | **对辩/自由辩论角色配置不全：只有 firstSpeaker 单字段，无法表达正反双方各出哪几位辩手（多选）** | **StageForm + RolePicker + schema** |
| **6** | **P1 高** | **RolePicker 写死 4 个辩手位，BP 制 8 角色 / 3v3 赛制 3 辩手不兼容；不支持多选** | **RolePicker.vue** |
| **7** | **P1 高** | **单方发问时长归属不明：质询环节"提问时间"和"回答时间"分开计时时无法表达** | **Stage 数据模型** |
| **8** | **P1 高** | **老数据 type='speech' 等在 StageTypeCascader 中无对应选项，回显失败，用户重选会污染数据** | **timing.vue loadConfig + Cascader** |
| 9 | P2 中 | `Stage.id` 类型 `number | string` 混乱 | 前端 Stage 接口 |
| 10 | P2 中 | `order` vs `orderIndex` 命名不一致，`order` 是 dead field | 前端 Stage + API |
| 11 | P2 中 | `name` 与 `title` 字段冗余 | DebateTimerProject |
| 12 | P2 中 | 运行时 `ALTER TABLE` 加列（schema 与 DB 真相脱节） | server/lib/prisma.ts |
| 13 | P2 中 | 阵营信息编码在字符串里（"正方·一辩"），无独立 side 字段，难以按阵营统计/筛选 | Stage 数据模型 |
| 14 | P2 中 | 环节缺少「是否启用 / 依赖关系 / 状态」字段，无法临时禁用某环节 | schema + 前端 |
| 15 | P2 中 | 时长只支持秒数输入，不直观，无 mm:ss 或上限/下限校验 | StageForm |
| 16 | P2 中 | `description` 字段语义不明（管理员笔记？显示给辩手？） | schema 注释 |
| 17 | P3 低 | 防抖保存未在 `onBeforeUnmount` flush，切页丢失修改 | timing.vue |
| 18 | P3 低 | 模板硬编码在 SFC，无法扩展 | timing.vue debateTemplates |
| 19 | P3 低 | 模板内置的 stages 用老式 type（speech/question/dual-timer），应用后 Cascader 反显失败 | timing.vue debateTemplates |

---

## P0 致命：5 个字段未持久化

### 现象
用户在 `StageForm` 里设置了「发言方 / 发问人 / 接受人 / 率先发言方 / 保护时间」，防抖保存后看似成功，但**刷新页面后所有这些字段回到默认值**：
- `speaker` → "正方 · 一辩"
- `questioner` → "反方 · 二辩"
- `responder` → "正方 · 一辩"
- `firstSpeaker` → "正方 · 一辩"
- `protectionTime` → 0

### 根因
三段链路都漏了：

**1. `DebateTimerStage` 表根本没有这些列**（`prisma/schema.prisma:547-564`）：
```prisma
model DebateTimerStage {
  id               String   @id @default(uuid())
  projectId        String
  name             String
  duration         Int
  type             String
  description      String?
  orderIndex       Int
  positiveDuration Int?
  negativeDuration Int?
  allowedRoles     String?  // JSON
  // 缺：speaker / questioner / responder / firstSpeaker / protectionTime
}
```

**2. `timer-config.put.ts:64-78 / 95-109` 写库时直接没取这些字段**：
```ts
prisma.debateTimerStage.create({
  data: {
    projectId, name, duration, type, description, orderIndex,
    positiveDuration, negativeDuration, allowedRoles,
    // speaker / questioner / responder / firstSpeaker / protectionTime 全部未写
  },
})
```

**3. `timer-config.get.ts:60-70` 返回时也没读这些字段**。

**4. `timing.vue:274` 直接 `as Stage[]` 强转**，没有任何默认值补齐，所以加载后这些字段就是 `undefined`，再传给 `StageForm` 时落到组件内部的 fallback 默认值（`StageForm.vue:44-47`）。

### 影响
- 用户每次配置完角色信息，刷新页面就丢，是「数据丢失」级别的 bug
- `TimerDisplay` 渲染时 `stage.speaker` 也读不到，只能 fallback 到"正方·一辩"，正反方辩位前缀**永远不会按用户配置显示**
- 辩方辩位·环节名 这个核心视觉信息错误

### 修复
**最小修复**（保持 schema 兼容）：给 `DebateTimerStage` 加 5 列
```prisma
model DebateTimerStage {
  // ... 现有字段
  speaker        String?  // 单方发言的发言方，如 "正方·一辩"
  questioner     String?  // 单方发问的发问人
  responder      String?  // 单方发问的接受人
  firstSpeaker   String?  // 双边对辩/自由辩论的率先发言方
  protectionTime Int?     // 保护时间（秒）
}
```
然后在 `timer-config.put.ts` 的 create data 里补这 5 个字段，`timer-config.get.ts` 的返回里也补上。

**注意**：由于该项目用 SQLite + 运行时 `ALTER TABLE` 风格，加列需要走 `prisma db push` 或者照 `prisma.ts:26` 的方式在启动时 `ALTER TABLE ADD COLUMN`。建议正式走 `prisma db push` 一次，把 schema 与 DB 真相对齐。

---

## P1 高：`type` 字段四处定义不一致

### 现象
同一个 `stage.type` 字符串，四个地方定义的取值集合互不一致：

| 位置 | 取值集合 | 数量 |
|---|---|---|
| `schema.prisma` 注释 | `speech / question / summary / special / dual-timer` | 5 |
| `timing.vue` Stage 联合类型 | 上述 5 + `single_speech / single_question / bilateral_debate / free_debate / no_timer / single_timer / double_timer / ppt_replace` | 13（还 `\| string` 兜底） |
| `StageTypeCascader.vue` 选项 | `single_speech / single_question / bilateral_debate / free_debate / no_timer / single_timer / double_timer / ppt_replace` | 8（**与 schema 完全不重合**） |
| `typeLabel / hasTimer / isDualTimer / getStageSpeaker` | 兼容映射，把 `speech/question/summary` 都映射成"单计时器" | — |

### 根因
- schema 注释是历史版本，从未跟上前端迭代
- 前端有两套命名风格混用：老版用连字符（`dual-timer`），新版用下划线（`single_speech`）
- SQLite 无 enum / CHECK 约束，写入任何字符串都不会报错，问题不会在写入时暴露

### 影响
- 同一种"单计时器"分类可以由 `speech`、`question`、`summary`、`single_timer` 四种字符串表达，兼容判断散落在 `timing.vue` 的 `typeLabel / hasTimer / isDualTimer / getStageSpeaker` + `StageForm.vue` 的 `isSpeech / isQuestion / isBilateral / isTimerType / isNoTimer / isPpt` 等 6+ 个函数里
- 任何一个函数漏判一种字符串都会出 bug，且测试很难覆盖
- 老赛事 DB 里是 `dual-timer`，新赛事用 Cascader 选可能是 `bilateral_debate` 或 `free_debate`，渲染端要全部分支兼容

---

## P1 高：「计时方式」与「语义类别」揉在同一个 `type` 字段

### 现象
`timing.vue:171-189` 的分类栏里有 4 组：
- **计时器数量**：单计时器 / 双计时器 / 无计时器 → 这是「计时方式」
- **单方发言**：立论 / 驳论 / 小结 / 总结陈词 → 这是「语义类别」
- **单方发问**：质询 / 盘问 → 「语义类别」
- **双边对辩**：对辩 / 自由辩论 → 「语义类别」

但所有「单方发言」选项点击后都创建 `type='speech'`，所有「单方发问」都创建 `type='question'`，所有「双边对辩」都创建 `type='dual-timer'`。结果：

| 用户在分类栏点的 | 实际存进 DB 的 type |
|---|---|
| 立论 | `speech` |
| 驳论 | `speech` |
| 小结 | `speech` |
| 总结陈词 | `speech` |
| 质询 | `question` |
| 盘问 | `question` |
| 对辩 | `dual-timer` |
| 自由辩论 | `dual-timer` |

「立论」和「总结陈词」语义完全不同，但 DB 里 type 一样，**用户选了哪个完全没记下来**。后续如果要做"按环节类别统计""模板按类别筛选"等功能，无从下手。

### 修复
把一个 `type` 拆成两个字段：
- `timingMode`: `'single' | 'dual' | 'none'` — 计时方式（驱动 UI 计时器数量）
- `category`: `'speech' | 'question' | 'summary' | 'free_debate' | 'bilateral' | 'ppt' | 'other'` — 语义类别（驱动标题文案、模板筛选）

`name`（如"立论"/"质询"）已经是自由文本，可以保留作为细粒度名称。这样语义类别用于分类聚合，自由名用于显示。

---

## P1 高：PUT 保存策略粗暴（先 deleteMany 再 create）

### 现象
`timer-config.put.ts:89-111`：
```ts
await prisma.debateTimerStage.deleteMany({ where: { projectId: project.id } })
if (stages.length > 0) {
  await Promise.all(stages.map((stage, index) =>
    prisma.debateTimerStage.create({ ... })
  ))
}
```

### 影响
1. **每次保存（防抖 1.5s 触发）都把所有环节删除重建**，N 个环节 = N+1 次写操作
2. **所有 `stage.id` 全变**（uuid 重新生成），导致：
   - 前端 `expandedId` 在保存后可能指向已不存在的 id（虽然 uuid 已从 DB 拿回，但 PUT 没把新 id 回写到前端，前端继续用旧 id）
   - `v-for :key="stage.id"` 每次 save 后 key 全变，组件复用被打断
3. **没有事务**，中途失败会留下空环节列表
4. **历史数据丢失**，无法回溯某环节的修改历史
5. **uuid 主键碎片化**，索引效率下降

### 修复
改用 diff + upsert + 单事务：
```ts
await prisma.$transaction(async (tx) => {
  const existing = await tx.debateTimerStage.findMany({ where: { projectId } })
  const existingIds = new Set(existing.map(s => s.id))
  const incomingIds = new Set(stages.filter(s => s.id).map(s => s.id))

  // 删除被移除的
  await tx.debateTimerStage.deleteMany({
    where: { id: { notIn: [...incomingIds] }, projectId }
  })
  // 更新已存在的 / 创建新的
  for (const [index, stage] of stages.entries()) {
    if (stage.id && existingIds.has(stage.id)) {
      await tx.debateTimerStage.update({ where: { id: stage.id }, data: {...} })
    } else {
      await tx.debateTimerStage.create({ data: {...} })
    }
  }
})
```
并要求前端在 add stage 时**不预生成 id**，由 DB 生成后回写；或者前端预生成临时 id（如 `tmp_xxx`），后端识别 `tmp_` 前缀走 create 分支。

---

## P1 高：对辩/自由辩论角色配置不全

### 现象
`StageForm.vue:138-141` 双边对辩/自由辩论类环节只暴露 `firstSpeaker` 一个字段：
```vue
<div v-if="isBilateral(localData.type)" class="form-field">
  <label class="form-label">率先发言方</label>
  <RolePicker v-model="localData.firstSpeaker" placeholder="请选择率先发言方" />
</div>
```

`Stage` 接口（`timing.vue:32`）也只有 `firstSpeaker?: string` 单字段。

### 真实场景无法表达

| 场景 | 正方参与 | 反方参与 | 率先发言 | 当前能否表达 |
|---|---|---|---|---|
| 自由辩论（全体接力） | 一辩+二辩+三辩+四辩 | 一辩+二辩+三辩+四辩 | 正方（任一辩先开） | ❌ firstSpeaker 只记一个 |
| 二辩对辩 | 二辩 | 二辩 | 正方二辩 | ⚠️ 只能记 firstSpeaker="正方·二辩"，反方二辩参与信息丢失 |
| 三四辩联队对辩 | 三辩+四辩 | 三辩+四辩 | 正方三辩 | ❌ 多人参与完全无法表达 |
| 1v1 自由辩论 | 一辩 | 一辩 | 正方一辩 | ✅ 这种最简单场景才够用 |

### 影响
- 用户配置完对辩环节后，正反双方参与辩手列表根本没地方填
- `TimerDisplay` 渲染"环节标题"时只能显示 `firstSpeaker·环节名`，比如"正方一辩·自由辩论"，但实际上自由辩论是全体参与，标题误导
- 计时页面无法显示"当前应该谁发言"的轮换提示，因为不知道有哪些辩手参与
- 大量真实赛制（联队对辩、自由辩论全员）配置不出来

### 修复
拆成两个数组 + 一个率先发言方：
```prisma
model DebateTimerStage {
  // ... 现有字段
  positiveSpeakers String?  // JSON: ["正方·一辩","正方·二辩","正方·三辩","正方·四辩"]
  negativeSpeakers String?  // JSON: ["反方·一辩","反方·二辩",...]
  firstSpeaker     String?  // 必须在 positiveSpeakers ∪ negativeSpeakers 中
}
```
- SQLite 无原生数组，用 JSON 字符串存（与现有 `allowedRoles` 一致风格）
- `firstSpeaker` 保留单字段（率先发言方只有一个），但其值必须从 `positiveSpeakers ∪ negativeSpeakers` 中选
- StageForm 在双边对辩类环节展示两个多选 RolePicker（正方组、反方组）+ 一个单选 firstPicker

---

## P1 高：RolePicker 写死 4 辩手位，不支持多选

### 现象
`RolePicker.vue:26-32` 辩手选项写死：
```ts
const debaters = [
  { label: '一辩', value: 'de1' },
  { label: '二辩', value: 'de2' },
  { label: '三辩', value: 'de3' },
  { label: '四辩', value: 'de4' },
  { label: '全体', value: 'all' },
]
```

`Props.modelValue: string`（单值），选中即关闭，零多选支持。

### 影响
1. **赛制不兼容**：
   - 4v4 标准赛制 → 4 个辩手 ✓
   - 3v3 赛制 → 多出"四辩"选项
   - 2v2 赛制 → 多出"三辩""四辩"
   - 英国议会制（BP）→ 完全无对应角色（首相/反对党领袖/副首相/反对党副领袖/政府成员/反对党成员/政府党鞭/反对党党鞭）
   - timing.vue 自己就内置了 BP 模板（`debateTemplates[3]`），但 RolePicker 选不出 BP 角色
2. **"全体"语义模糊**：是"四位辩手都参与"还是"该方作为一个整体"？数据上是 `'all'` 字符串，无法解析为具体辩位列表
3. **不支持多选**：对辩/自由辩论需要"正方二辩+三辩"这种多选，当前完全无法表达（见上一节）
4. **阵营信息编码在字符串里**："正方·一辩"是 side+debater 的拼接，需要 `parseValue` 解析，遇到自由格式输入（用户手填"正方队"）会 fallback 到默认值

### 修复
1. 把辩手列表抽为可配置参数（Props 传入），根据赛事 `teamSize` 或赛制动态生成
2. 改造为支持 `modelValue: string | string[]`，单选走原流程，多选走 checkbox 形式
3. 数据模型用结构化对象而非字符串拼接：
   ```ts
   { side: 'positive', debater: 'de1' }
   // 或多选
   [{ side: 'positive', debater: 'de1' }, { side: 'positive', debater: 'de2' }]
   ```
4. "全体" 改为前端展开为 `[de1,de2,de3,de4]`，存储上不保留 `'all'` 字面值

---

## P1 高：单方发问时长归属不明

### 现象
单方发问环节（`type='single_question'` / `'question'`）当前字段：
```ts
{
  questioner: string     // 发问人
  responder: string      // 接受人
  duration: number       // 总时长（秒）
  protectionTime: number // 保护时间
}
```

只有 `duration` 一个总时长，没有区分"提问时间"和"回答时间"。

### 真实场景
辩论赛的盘问/质询环节通常**提问时间和回答时间分开计时**：
- 例如"反方四辩质询正方一辩，提问 30 秒、回答 90 秒，总时长不超过 120 秒"
- 有些赛制提问时间不计入辩手个人时长，回答时间计入
- 计时器需要分别倒计时，并在提问/回答之间切换

### 影响
- 当前一个 `duration` 无法表达分开计时
- 计时页只能倒计时一个总数，到了 0 就结束，分不出"提问结束/回答结束"
- `protectionTime` 语义也不清：是发问人的保护时间（不能被反问）还是接受人的保护时间（开头 N 秒不能被打断）？

### 修复
扩展为：
```prisma
model DebateTimerStage {
  // ... 现有字段
  questionDuration Int?  // 提问时长（秒），单方发问用
  answerDuration   Int?  // 回答时长（秒），单方发问用
  // duration 保留为总时长，= questionDuration + answerDuration
}
```
`protectionTime` 明确文档化：保护谁、保护什么行为。

---

## P1 高：老数据 type 在 Cascader 中无对应项，回显失败

### 现象
- 老数据 / 模板内置数据用 `type='speech'` `'question'` `'summary'` `'dual-timer'` `'special'`
- `StageTypeCascader.categories` 里只有 `single_speech` `single_question` `bilateral_debate` `free_debate` `no_timer` `single_timer` `double_timer` `ppt_replace` 8 种新值
- 两套完全不重合

### 流程
1. 老赛事 DB 里 stage.type = `'speech'`
2. timing.vue 加载，传入 StageForm 的 `modelValue.type = 'speech'`
3. StageForm 把 `localData.type = 'speech'` 传给 `<StageTypeCascader v-model="localData.type">`
4. Cascader 的 `getDisplayText('speech')` 遍历 8 个新值找不到 → 返回 `placeholder`（"请选择环节类型"）
5. 用户看到"请选择环节类型"，以为没设过，重新选了 `single_speech`
6. 保存，DB 里 type 从 `'speech'` 变成 `'single_speech'`
7. 但 `'speech'` 和 `'single_speech'` 在 `typeLabel / hasTimer / isDualTimer / getStageSpeaker` 里走不同分支，可能导致显示差异

### 影响
- 每次加载老数据，Cascader 反显为空，用户体验差
- 用户重选后 type 字符串被悄悄替换，可能改变后续渲染逻辑
- 内置模板 `applyTemplate` 写入 `type='speech'` 等老值，应用后 Cascader 同样反显失败

### 修复
**方案 A（推荐）**：统一收敛到新枚举，写一个迁移函数把老值映射到新值：
```ts
function migrateType(oldType: string): string {
  const map: Record<string, string> = {
    'speech':     'single_speech',
    'question':   'single_question',
    'summary':    'single_speech',  // 小结也是单方发言
    'dual-timer': 'bilateral_debate',
    'special':    'no_timer',
  }
  return map[oldType] || oldType
}
```
- 加载时 `cfg.stages.map(s => ({ ...s, type: migrateType(s.type) }))`
- 保存时如果是新值就正常存
- 内置模板的 `type` 也改成新值

**方案 B**：在 Cascader 的 `categories` 里加上老值作为别名，让 `getDisplayText` 能识别。但这样老值新值并存，问题不会消失。

---

## P2 中：`Stage.id` 类型 `number | string` 混乱

### 现象
`timing.vue:20` `id: number | string`

- 前端 `addStageByType` / `duplicateStage` 用 `++nextStageId`（数字 101、102...）
- 模板 `applyTemplate` 也用数字（从 101 起）
- 但从 DB 加载时是 uuid 字符串
- 保存后 id 又变 uuid

### 影响
- 拖拽排序 `:key="stage.id"` 在保存前后 key 类型不一致，Vue diff 可能误判
- `expandedId` 跟踪 `number | string | null`，比较时 `101 !== "101"` 这种边界
- PUT API 不知道哪些是新增（前端临时数字 id）哪些是更新（DB uuid）

### 修复
统一为 `string`。新增环节时用 `crypto.randomUUID()` 或 `tmp_${Date.now()}_${random}` 作为临时 id，保存成功后由后端回写真实 uuid。

---

## P2 中：`order` vs `orderIndex` 命名不一致

### 现象
- `timing.vue:25` Stage 接口：`order?: number`
- `schema.prisma:554` DebateTimerStage：`orderIndex: Int`
- `timer-config.get.ts:66` 返回 `orderIndex`
- `timer-config.put.ts:72` 用 `orderIndex: typeof stage.orderIndex === 'number' ? stage.orderIndex : index`
- 但 `timing.vue` 的 `addStageByType` 设置 `order: ...`，`applyTemplate` 设置 `order: 1...13`
- 前端从未读取 `stage.orderIndex`，也从未把 `order` 传给 API

### 影响
- 前端的 `order` 是 dead field，写进去读不出来
- 拖拽排序改变数组顺序后，下次加载依赖 DB 的 `orderIndex` 排序，但 `orderIndex` 是保存时用数组下标生成的，所以"刚好能对"，但耦合脆弱

### 修复
前端 Stage 接口统一用 `orderIndex`，删除 `order` 字段；或者反过来后端改名。任选其一，但必须一致。

---

## P2 中：`name` 与 `title` 字段冗余

### 现象
`DebateTimerProject` 有 `name`（"项目名称，后台管理用"）和 `title`（"比赛标题，显示用"）两个字段。
`timing.vue` 的 `fullConfig` 也都有，但 `loadConfig:253-254` 里两者都设为 `tournament.value.name`，从未区分使用。

### 影响
- 用户从未被告知这两个字段的差异
- 保存时写两次相同值
- 字段语义模糊，后续维护者不知道该读哪个

### 修复
二选一。如果未来真有「后台名 vs 显示名」需求，明确文档化；否则合并为 `title`，删 `name`。

---

## P2 中：运行时 `ALTER TABLE` 加列

### 现象
`server/lib/prisma.ts:26`：
```ts
prisma.$executeRawUnsafe('ALTER TABLE "BotArena" ADD COLUMN "originalChannelName" TEXT')
  .catch(() => { /* 列已存在，忽略 */ })
```

`schema.prisma` 里 `BotArena.originalChannelName` 注释说「运行时由 prisma.ts 启动 ALTER 加列，代码用 raw SQL 读写」。

### 影响
- Prisma schema 应该是**真相来源**，运行时再 ALTER 会让 schema 与 DB 不一致
- `prisma generate` 生成的客户端不认识这个列（虽然 schema 里有定义，但 DB 实际是启动时才加的）
- 迁移工具（`prisma migrate`）无法追踪这种变更
- 启动时每次都尝试 ALTER 一次，靠 catch 忽略错误，性能和日志都不优雅
- 一旦 schema 里有列但 DB 没启动 ALTER 就被访问，会报列不存在

### 修复
- schema 里有的列，**就老老实实 `prisma db push`** 一次同步到 DB
- 不要在运行时 ALTER；如果担心 dev.db 没同步，应该在 `package.json` 加 `postinstall` 或 dev 启动脚本里跑 `prisma db push`
- 已有的运行时 ALTER 应当移除，把 `originalChannelName` 改为正常读写

---

## P3 低：防抖保存未在卸载时 flush

### 现象
`timing.vue:450-460`：
```ts
let saveTimeout: ReturnType<typeof setTimeout> | null = null
watch(() => fullConfig.value.stages, () => {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    if (!loading.value) saveConfig()
  }, 1500)
}, { deep: true })
```

### 影响
- 用户改完环节，1.5s 内切换到其他 tab / 关闭页面 → 未保存的修改丢失
- `deep: true` watch 整个 stages 数组，每次子属性变化都触发，环节多时性能不佳
- 保存失败时只 toast 一闪而过，本地 stages 已改但 DB 没改，下次加载出现"我的修改没了"

### 修复
```ts
onBeforeRouteLeave(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveConfig()  // 同步 flush
  }
})
onBeforeUnmount(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
    saveConfig()
  }
})
```

---

## P3 低：模板硬编码在 SFC

### 现象
`timing.vue:57-120` 4 个模板（国际华语辩论邀请赛、世界杯2024、简单标准、英国议会制）作为常量数组写死在组件里。

### 影响
- 无法在不改代码的情况下新增模板
- 不同团队/赛事无法维护自己的模板库
- 模板和组件逻辑耦合，组件文件膨胀

### 修复
- 短期：抽到 `app/data/debate-templates.ts` 独立文件
- 长期：做成 DB 表 `TimerTemplate`（注意现有 `TimerTemplate` 模型已经存在但是另一套 phases JSON 方案，需要决策是合并还是并存）

---

## 附：还有一套并存的 `TimerTemplate` 模型

### 现象
`schema.prisma:484-494` 已有：
```prisma
model TimerTemplate {
  id                String   @id @default(uuid())
  tournamentId      String?  @unique
  standaloneMatchId String?  @unique
  phases            String   @default("[]")  // JSON
}
```

但 `timing.vue` 用的是 `DebateTimerProject + DebateTimerStage` 那套。`TimerTemplate.phases` 是 JSON 字符串数组，没有结构化字段，也没有角色信息。

### 影响
- 两套并存，命名容易混淆（`TimerTemplate` vs `DebateTimerProject`）
- 新人不知道该用哪套
- `Timer / TimerTemplate / DebateTimerProject + DebateTimerStage` 三套 timer 相关模型，职责不清

### 建议
决策：要么废弃 `TimerTemplate`（确认没人用），要么把它改造为「模板库」（用户保存/分享的模板），与「具体赛事的配置」(`DebateTimerProject`) 区分。需要先 grep 一下 `TimerTemplate` 的使用情况再决定。

---

## 修复优先级建议

| 阶段 | 动作 | 工作量 |
|---|---|---|
| **P0 紧急** | schema 加 5 列（speaker/questioner/responder/firstSpeaker/protectionTime）+ GET/PUT 补字段 + 前端 loadConfig 不再强转 | 0.5 天 |
| **P1 高** | 对辩角色配置：新增 `positiveSpeakers` / `negativeSpeakers` JSON 列；StageForm 双边对辩类展示双多选 + firstSpeaker | 1 天 |
| **P1 高** | RolePicker 重构：辩手位参数化（按 teamSize/赛制生成）+ 支持 `string \| string[]` 多选 | 1 天 |
| **P1 高** | 单方发问拆分时长：新增 `questionDuration` / `answerDuration` 列；StageForm 暴露双输入；明确 protectionTime 语义 | 0.5 天 |
| **P1 高** | type 字段拆为 `timingMode` + `category`，废弃老枚举值，统一收敛 + 迁移函数 | 1-2 天（含数据迁移） |
| **P1 高** | PUT 改为 diff + upsert + 事务 | 0.5 天 |
| **P1 高** | 老数据 type 回显：迁移函数 migrateType，loadConfig 时映射，模板内置 type 同步更新 | 0.3 天 |
| **P2 中** | id 统一 string + 临时 id 机制 | 0.5 天 |
| **P2 中** | order/orderIndex 统一 | 0.2 天 |
| **P2 中** | name/title 合并 | 0.2 天 |
| **P2 中** | 移除运行时 ALTER，走 db push | 0.2 天 |
| **P2 中** | 阵营独立 side 字段（结构化角色对象替代字符串拼接） | 0.5 天 |
| **P2 中** | 环节 enabled/依赖/状态字段 | 0.5 天 |
| **P2 中** | 时长支持 mm:ss 输入 + 上下限校验 | 0.3 天 |
| **P2 中** | description 语义明确化（拆为 adminNote / displayNote？） | 0.2 天 |
| **P3 低** | 防抖 flush + 模板外抽 + 模板内置 type 同步 | 0.5 天 |

**建议先做 P0 + 老数据 type 回显**：那 5 个字段丢失是用户能直接感知到的数据丢失 bug，schema 加列 + API 补读写即可，影响面最小，立竿见影。老数据 type 回显问题（P1）只需加一个迁移函数，工作量小但用户体验改善明显。

**关于对辩角色配置（P1）**：这是设计层面的扩展，不是修 bug。如果要做，建议和 RolePicker 多选改造、单方发问时长拆分一起规划——这三件事都涉及 StageForm 表单结构调整和 schema 加列，捆在一个 PR 里改更高效。

---

## 检查方法（已读文件清单）

- `app/pages/tournaments/[id]/timing.vue`（1124 行）
- `app/components/StageForm.vue`（338 行）
- `app/components/StageTypeCascader.vue`（前 120 行）
- `app/components/RolePicker.vue`（全文）
- `server/api/tournaments/[id]/timer-config.get.ts`
- `server/api/tournaments/[id]/timer-config.put.ts`
- `server/lib/prisma.ts`
- `prisma/schema.prisma`（DebateTimerProject / DebateTimerStage / TimerTemplate / BotArena 部分）
