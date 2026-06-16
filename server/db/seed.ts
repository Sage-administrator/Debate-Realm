import { prisma } from '../lib/prisma'
import { hashPassword } from '../lib/jwt'

async function seed() {
  console.log('开始初始化数据库...')

  // 检查是否已有系统管理员
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'system-admin' },
  })

  if (existingAdmin) {
    console.log('系统管理员已存在，跳过创建')
    return
  }

  // 创建系统管理员
  const hashedPassword = await hashPassword('admin123')
  await prisma.user.create({
    data: {
      username: 'system-admin',
      password: hashedPassword,
      role: 'system_admin',
      mode: 'individual',
    },
  })

  console.log('系统管理员创建成功')
  console.log('  用户名: system-admin')
  console.log('  密码: admin123')
  console.log('  角色: system_admin')
}

seed()
  .then(() => {
    console.log('数据库初始化完成')
    process.exit(0)
  })
  .catch((e) => {
    console.error('数据库初始化失败:', e)
    process.exit(1)
  })
