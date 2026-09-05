// scripts/validate-debate-templates.mjs
//
// 开发期校验：用 app/data/debate-template.schema.json（JSON Schema）校验
// app/data/debate-templates.ts 导出的 `debateTemplates` 数组，确保字段名/类型与后端
// 「正式」环节结构（prisma DebateTimerStage + server/utils/syncStages.ts）对齐。
// 任何字段漂移都会在 CI / 本地 `npm run validate:templates` 中报错。
//
// 依赖（均为项目间接依赖，已在 node_modules 中，无需额外安装）：
//   - esbuild：将 .ts 数据文件转译为 ESM 后动态导入
//   - ajv    ：JSON Schema 校验

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import esbuildPkg from 'esbuild'
import ajvPkg from 'ajv'

const esbuild = esbuildPkg.default || esbuildPkg
const Ajv = ajvPkg.default || ajvPkg

const cwd = process.cwd()
const tsPath = join(cwd, 'app', 'data', 'debate-templates.ts')
const schemaPath = join(cwd, 'app', 'data', 'debate-template.schema.json')

// 1) 把 TS 数据文件转译为 ESM 并动态导入（该文件无外部运行时依赖）
const tsSource = readFileSync(tsPath, 'utf8')
const { code } = await esbuild.transform(tsSource, {
  loader: 'ts',
  format: 'esm',
  target: 'node18',
})
const dataUrl = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
const mod = await import(dataUrl)
const debateTemplates = mod.debateTemplates

if (!Array.isArray(debateTemplates)) {
  console.error('✗ 未能从 app/data/debate-templates.ts 导出数组 debateTemplates')
  process.exit(1)
}

// 2) 加载 JSON Schema
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

// 3) 校验
const ajv = new Ajv({ allErrors: true })
const validate = ajv.compile(schema)
const valid = validate(debateTemplates)
if (!valid) {
  console.error('✗ debateTemplates 不符合 schema：')
  for (const e of validate.errors || []) {
    const extra =
      e.params && e.params.additionalProperty ? ` (多余字段: ${e.params.additionalProperty})` : ''
    console.error(`  - ${e.instancePath || '/'} ${e.message}${extra}`)
  }
  process.exit(1)
}

const stageCount = debateTemplates.reduce((n, t) => n + (t.stages?.length || 0), 0)
console.log(`✓ debateTemplates 校验通过（${debateTemplates.length} 个模板，${stageCount} 个环节）`)
