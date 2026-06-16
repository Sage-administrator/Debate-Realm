import { prisma } from './server/lib/prisma'
import { hashPassword } from './server/lib/jwt'

async function main() {
  const hashed = await hashPassword('123456')
  const result = await prisma.user.update({
    where: { username: 'adminA' },
    data: { password: hashed },
  })
  console.log('Updated adminA password to 123456')

  const hashed2 = await hashPassword('123456')
  await prisma.user.update({
    where: { username: 'adminB' },
    data: { password: hashed2 },
  })
  console.log('Updated adminB password to 123456')

  const hashed3 = await hashPassword('123456')
  await prisma.user.upsert({
    where: { username: 'system-admin' },
    update: { password: hashed3 },
    create: { username: 'system-admin', password: hashed3, role: 'system_admin', mode: 'individual' },
  })
  console.log('Updated/Created system-admin password to 123456')
}

main().catch(console.error).finally(async () => { await prisma.$disconnect() })
