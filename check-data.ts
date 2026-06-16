import { prisma } from './server/lib/prisma'

async function main() {
  console.log('=== Users ===')
  const users = await prisma.user.findMany({
    include: { team: true, teamMemberships: true },
  })
  users.forEach((u) => {
    console.log(`  User: ${u.username} (${u.id})`)
    console.log(`    role: ${u.role}, mode: ${u.mode}`)
    console.log(`    teamId: ${u.teamId}`)
    console.log(`    team: ${u.team ? `${u.team.id} / ${u.team.name}` : 'null'}`)
    console.log(`    teamMemberships: ${u.teamMemberships.length} entries`)
  })

  console.log('\n=== Teams ===')
  const teams = await prisma.team.findMany({
    include: {
      _count: { select: { users: true, tournaments: true } },
      members: true,
      tournaments: { select: { id: true, name: true } },
    },
  })
  teams.forEach((t) => {
    console.log(`  Team: ${t.name} (${t.id})`)
    console.log(`    adminId: ${t.adminId}`)
    console.log(`    user count (_count.users): ${t._count.users}`)
    console.log(`    teamMembers count: ${t.members.length}`)
    console.log(`    tournaments: ${t.tournaments.length} ${JSON.stringify(t.tournaments)}`)
  })

  console.log('\n=== Tournaments ===')
  const tournaments = await prisma.tournament.findMany({
    include: { team: { select: { id: true, name: true } } },
  })
  tournaments.forEach((t) => {
    console.log(`  Tournament: ${t.name} (${t.id})`)
    console.log(`    teamId: ${t.teamId}`)
    console.log(`    team: ${t.team.id} / ${t.team.name}`)
    console.log(`    status: ${t.status}`)
  })

  console.log('\n=== Team Members ===')
  const teamMembers = await prisma.teamMember.findMany({
    include: { team: { select: { id: true, name: true } }, user: { select: { id: true, username: true } } },
  })
  teamMembers.forEach((tm) => {
    console.log(`  TeamMember: team=${tm.team.name} user=${tm.user.username}`)
  })
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await prisma.$disconnect() })
