import { safeJsonParse } from './common'

// 默认字段定义：系统内置的报名表单字段，可配置 appliesTo 和 required
export const DEFAULT_FIELDS = [
  { fieldKey: 'submitterName', fieldName: '姓名', defaultAppliesTo: 'both', defaultRequired: true },
  {
    fieldKey: 'contactPhone',
    fieldName: '联系电话',
    defaultAppliesTo: 'both',
    defaultRequired: true,
  },
  {
    fieldKey: 'contactEmail',
    fieldName: '电子邮箱',
    defaultAppliesTo: 'both',
    defaultRequired: false,
  },
  { fieldKey: 'teamName', fieldName: '队伍名称', defaultAppliesTo: 'team', defaultRequired: true },
  { fieldKey: 'members', fieldName: '成员信息', defaultAppliesTo: 'both', defaultRequired: true },
  { fieldKey: 'notes', fieldName: '备注', defaultAppliesTo: 'both', defaultRequired: false },
]

// 解析默认字段配置：合并数据库存储的配置与默认值
// ponytail: 使用 safeJsonParse 消除 try-catch 样板代码
export function parseDefaultFieldsConfig(rawConfig: string | null) {
  const stored = safeJsonParse<Record<string, { appliesTo?: string; required?: boolean }>>(
    rawConfig,
    {},
  )
  return DEFAULT_FIELDS.map((f) => ({
    fieldKey: f.fieldKey,
    fieldName: f.fieldName,
    appliesTo: stored[f.fieldKey]?.appliesTo || f.defaultAppliesTo,
    // ponytail: 用 ?? 替代三元，避免索引访问后 TS 无法缩窄类型
    required: stored[f.fieldKey]?.required ?? f.defaultRequired,
    isDefault: true,
  }))
}
