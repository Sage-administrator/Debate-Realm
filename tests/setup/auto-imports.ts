// 桥接 Nuxt「自动导入」到 vitest（node 环境不跑 unimport 转换）。
//
// 背景：app/stores/debate.ts 里的 isDualTimer / hasTimer / useDebateStore 是 Nuxt
// 自动注入的裸标识符（源码无 import 语句）。vitest 只用 #shared 别名、不启用 Nuxt
// transform，直接 import 该 store 会在运行时抛 ReferenceError。
//
// 做法：在 setup 阶段把真实实现挂到 globalThis，供模块内的裸引用解析。
// 这是测试环境专用桥接，不影响任何生产代码；store 源码保持「自动导入」写法不变。
import { isDualTimer, hasTimer } from '../../app/utils/stageType'
import { useDebateStore } from '../../app/stores/debate'

const g = globalThis as unknown as Record<string, unknown>
g.isDualTimer = isDualTimer
g.hasTimer = hasTimer
g.useDebateStore = useDebateStore
