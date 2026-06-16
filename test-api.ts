import { $fetch } from 'ofetch'

const TEAM_ID = '1d6b8b00-03ae-40b0-9e6d-3a503de735e6'

// First, get a real token by logging in
async function login() {
  try {
    const res = await $fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: { username: 'adminA', password: '123456' },
    })
    console.log('Login response:', JSON.stringify(res, null, 2))
    return res.token
  } catch (err) {
    console.error('Login error:', err?.data || err?.message)
    throw err
  }
}

async function testGetTeamMembers(token: string) {
  try {
    const res = await $fetch(`http://localhost:3000/api/teams/${TEAM_ID}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log('Members response:', JSON.stringify(res, null, 2))
  } catch (err) {
    console.error('Get members error:', err?.data || err?.message)
  }
}

async function testGetTournaments(token: string) {
  try {
    const res = await $fetch(`http://localhost:3000/api/teams/${TEAM_ID}/tournaments`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log('Tournaments response count:', Array.isArray(res) ? res.length : 'not array')
    console.log('First tournament:', res[0] ? JSON.stringify(res[0], null, 2).substring(0, 200) : 'none')
  } catch (err) {
    console.error('Get tournaments error:', err?.data || err?.message)
  }
}

async function main() {
  console.log('=== Step 1: Login ===')
  const token = await login()
  console.log('\n=== Step 2: Get team members ===')
  await testGetTeamMembers(token)
  console.log('\n=== Step 3: Get team tournaments ===')
  await testGetTournaments(token)
}

main().catch(console.error)
