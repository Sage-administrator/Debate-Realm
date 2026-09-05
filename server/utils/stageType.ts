// server 端环节类型 normalize 模块
//
// 实现已收敛到 shared/stageType.ts，与前端共用同一份。
// 此处仅作转发：历史上本文件是 app/utils/stageType.ts 的手工拷贝，
// 靠「修改时请两处同步更新」的注释维系，一旦漏改就会前后端判断不一致。
//
// 说明：
// 1. 此处用**相对路径**而非 `#shared` 别名 —— 全仓 server/ 侧引用 shared/ 的既有写法
//    都是相对路径（见 server/api/tournaments/[id]/matches.post.ts），
//    `#shared` 别名只在 app/ 侧（Nuxt Vite）被验证过，Nitro 运行时未实测，不冒险。
// 2. 用显式具名 re-export 而非 `export *`，与 app/utils/stageType.ts 保持一致，
//    便于一眼看出可用函数全集，也避免将来有人照抄 `export *` 到 app 侧导致自动导入失效。
//
// ⚠️ 不要在 server/ 下另写一套 type 判断逻辑，一律改 shared/stageType.ts。

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
} from '../../shared/stageType'
