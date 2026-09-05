// 环节类型判断 —— 实现已上移到 shared/stageType.ts（前后端共用同一份）
//
// 保留本文件的原因：全仓约 18 个文件依赖 Nuxt 对 app/utils 的**自动导入**
// （直接使用 isDualTimer / hasTimer / typeLabel 等而无需 import）。
// 若删除本文件，这些隐式引用会全部失效。
//
// ⚠️ 两点注意事项：
// 1. 必须用「显式具名 re-export」。unimport 的静态分析不跟随 `export *`，
//    写成 `export * from '#shared/stageType'` 会导致所有自动导入静默失效。
// 2. 新增函数时，需同步在下方列表补一行，否则前端拿不到自动导入。
//
// ⚠️ 不要再在 app/ 或 server/ 下另写一套 type 判断逻辑，一律改 shared/stageType.ts。

export {
  normalizeStageType,
  isSpeech,
  isQuestion,
  isSummary,
  isBilateral,
  isDualTimer,
  isTimerType,
  isNoTimer,
  isPpt,
  hasTimer,
  typeLabel,
} from '#shared/stageType'
