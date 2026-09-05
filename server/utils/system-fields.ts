import { safeJsonParse } from './common'

// 系统字段定义：报名表单中内置的系统字段（不可删除，映射到 Registration 表的独立列）
// 这些字段是业务逻辑（自动组队、辩手账号创建、报名管理展示）所依赖的

export interface SystemFieldDef {
  fieldKey: string
  fieldName: string
  fieldType: string
  defaultRequired: boolean
  defaultAppliesTo: string
  placeholder?: string
  description?: string
  width?: string
}

// 系统字段定义列表（按 sortOrder 排列）
export const SYSTEM_FIELDS: SystemFieldDef[] = [
  {
    fieldKey: 'submitterName',
    fieldName: '姓名',
    fieldType: 'text',
    defaultRequired: true,
    defaultAppliesTo: 'both',
    placeholder: '请输入您的姓名',
    width: 'half',
  },
  {
    fieldKey: 'contactPhone',
    fieldName: '联系电话',
    fieldType: 'phone',
    defaultRequired: true,
    defaultAppliesTo: 'both',
    placeholder: '请输入手机号或电话',
    width: 'half',
  },
  {
    fieldKey: 'contactEmail',
    fieldName: '电子邮箱',
    fieldType: 'email',
    defaultRequired: false,
    defaultAppliesTo: 'both',
    placeholder: '请输入邮箱地址',
    width: 'full',
  },
  {
    fieldKey: 'teamName',
    fieldName: '队伍名称',
    fieldType: 'text',
    defaultRequired: true,
    defaultAppliesTo: 'team',
    placeholder: '请输入队伍名称',
    width: 'full',
  },
  {
    fieldKey: 'members',
    fieldName: '成员信息',
    fieldType: 'members',
    defaultRequired: true,
    defaultAppliesTo: 'both',
    description: '支持动态增减成员，每位成员包含姓名、意向职位、辩论经历',
    width: 'full',
  },
  {
    fieldKey: 'notes',
    fieldName: '备注',
    fieldType: 'textarea',
    defaultRequired: false,
    defaultAppliesTo: 'both',
    placeholder: '如有特殊需求或说明，请在此填写',
    width: 'full',
  },
]

// 系统字段的 fieldKey 列表（用于快速判断）
export const SYSTEM_FIELD_KEYS = SYSTEM_FIELDS.map((f) => f.fieldKey)

/**
 * 判断一个 fieldKey 是否为系统字段
 */
export function isSystemFieldKey(fieldKey: string): boolean {
  return SYSTEM_FIELD_KEYS.includes(fieldKey)
}

/**
 * 获取系统字段的默认配置
 */
export function getSystemFieldDef(fieldKey: string): SystemFieldDef | undefined {
  return SYSTEM_FIELDS.find((f) => f.fieldKey === fieldKey)
}

/**
 * 为赛事初始化系统字段记录（如果不存在）
 * 在赛事首次访问报名配置时调用
 */
export async function ensureSystemFieldsForTournament(
  prisma: any,
  tournamentId: string,
): Promise<void> {
  const existing = await prisma.registrationField.findFirst({
    where: { tournamentId, systemField: true },
    select: { id: true },
  })
  if (existing) return

  const toCreate = SYSTEM_FIELDS.map((f, idx) => ({
    tournamentId,
    fieldName: f.fieldName,
    fieldKey: f.fieldKey,
    fieldType: f.fieldType,
    required: f.defaultRequired,
    sortOrder: idx,
    appliesTo: f.defaultAppliesTo,
    placeholder: f.placeholder ?? null,
    description: f.description ?? null,
    width: f.width ?? 'full',
    systemField: true,
  }))

  await prisma.registrationField.createMany({ data: toCreate })
}

/**
 * 向后兼容：解析旧的 defaultFieldsConfig 字符串
 * 用于数据迁移：把旧的默认字段配置转换为 RegistrationField 更新
 * ponytail: 使用 safeJsonParse 消除 try-catch 样板代码
 */
export function parseLegacyDefaultFieldsConfig(rawConfig: string | null) {
  const stored = safeJsonParse<Record<string, { appliesTo?: string; required?: boolean }>>(
    rawConfig,
    {},
  )
  return SYSTEM_FIELDS.map((f) => ({
    fieldKey: f.fieldKey,
    fieldName: f.fieldName,
    appliesTo: stored[f.fieldKey]?.appliesTo || f.defaultAppliesTo,
    required:
      stored[f.fieldKey]?.required !== undefined ? stored[f.fieldKey]!.required : f.defaultRequired,
  }))
}
