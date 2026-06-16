import { $fetch } from 'ofetch'

const TEAM_ID = '1d6b8b00-03ae-40b0-9e6d-3a503de735e6'

async function login() {
  const res = await $fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    body: { username: 'adminA', password: '123456' },
  })
  return res.token
}

async function test(url: string, token: string) {
  try {
    const res = await $fetch(`http://localhost:3000${url}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log(`✅ ${url} -> ${Array.isArray(res) ? `${res.length} items` : typeof res === 'object' ? 'object' : res}`)
  } catch (err) {
    console.log(`❌ ${url} -> ${err?.statusCode} ${err?.statusMessage}`)
  }
}

async function main() {
  const token = await login()
  console.log('\n=== Testing team APIs ===')
  await test(`/api/teams/${TEAM_ID}`, token)
  await test(`/api/teams/${TEAM_ID}/members`, token)
  await test(`/api/teams/${TEAM_ID}/tournaments`, token)

  // Also test POST to members
  try {
    const res = await $fetch(`http://localhost:3000/api/teams/${TEAM_ID}/members`, {
      method: 'POST',
      body: { username: 'subuser_test', password: 'test12345' },
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log(`✅ POST /api/teams/${TEAM_ID}/members -> success`)
  } catch (err) {
    console.log(`❌ POST /api/teams/${TEAM_ID}/members -> ${err?.statusCode} ${err?.statusMessage}`)
  }
}

main().catch(console.error)
