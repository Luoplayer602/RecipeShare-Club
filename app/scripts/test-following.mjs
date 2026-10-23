import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env.local', import.meta.url), quiet: true })
const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
const users = [], posts = []
async function request(path, cookie, method = 'GET', origin) { const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) } }); return { status: response.status, body: await response.json() } }
const follow = username => '/api/profiles/' + username + '/follow'
try {
  for (let i = 0; i < 2; i++) {
    const username = 'qafollow_' + randomBytes(6).toString('hex'), password = randomBytes(24).toString('base64url')
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, displayName: 'Follow QA ' + i, email: username + '@example.invalid', password }) })
    assert.equal(response.status, 201); const data = await response.json(); users.push({ id: data.user.id, username, cookie: '' })
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: username, password }) }); assert.equal(login.status, 200); users[i].cookie = login.headers.get('set-cookie').split(';')[0]
  }
  const [[title]] = await db.query('SELECT title_id FROM users WHERE id = ?', [users[0].id])
  for (let i = 0; i < 5; i++) { const id = randomUUID(), username = 'qafollow_' + randomBytes(6).toString('hex'); await db.execute('INSERT INTO users (id,username,display_name,title_id,email) VALUES (?,?,?,?,?)', [id, username, 'Fixture kitchen ' + i, title.title_id,username+'@example.invalid']); users.push({ id, username }) }
  for (let i = 0; i < 15; i++) { const id = randomUUID(); posts.push(id); await db.execute('INSERT INTO posts (id,author_id,type,title,slug,excerpt,status,published_at) VALUES (?,?,?,?,?,?,?,?)', [id, i < 12 ? users[1].id : users[2].id, 'blog', 'Follow QA post ' + i, 'qafollow-' + id, 'Fixture', i === 14 ? 'draft' : 'published', new Date(Date.UTC(2026,9,1+i))]) }
  const a = users[0].cookie, b = users[1].cookie
  assert.equal((await request('/api/following')).status, 401)
  assert.equal((await request('/api/posts?following=1')).status, 401)
  assert.equal((await request('/api/posts?following=1&saved=1',a)).status,400)
  assert.equal((await request(follow(users[1].username), null, 'PUT')).status, 401)
  assert.equal((await request(follow(users[0].username), a, 'PUT')).status, 400)
  assert.equal((await request(follow(users[1].username), a, 'PUT', 'https://example.invalid')).status, 403)
  assert.equal((await request(follow('missing_qa_user'), a, 'PUT')).status, 404)
  await Promise.all(Array.from({ length: 3 }, () => request(follow(users[1].username), a, 'PUT').then(r => assert.equal(r.status, 200))))
  assert.equal((await request(follow(users[1].username))).body.followerCount, 1)
  assert.equal((await request(follow(users[0].username), a)).body.followingCount, 1)
  assert.equal((await request('/api/profiles/'+users[1].username)).body.stats.followerCount,1)
  assert.equal((await request('/api/profiles/'+users[0].username,a)).body.stats.followingCount,1)
  assert.equal((await request('/api/posts?following=1', b)).body.pagination.total, 0)
  for (const author of users.slice(2)) assert.equal((await request(follow(author.username), a, 'PUT')).status, 200)
  let directory = (await request('/api/following', a)).body
  assert.ok(directory.authors.every(author => author.followerCount === 1));
  assert.equal(directory.totalFollowing, 6); assert.equal(directory.authors.length, 5); assert.equal(directory.pagination.totalPages, 2)
  assert.ok(!directory.suggestions.some(author => author.id === users[0].id || users.slice(1).some(user => user.id === author.id)))
  assert.equal((await request('/api/following?page=2',a)).body.authors.length,1)
  assert.equal((await request('/api/following?q='+users[1].username,a)).body.authors[0].id,users[1].id)
  const feed = (await request('/api/posts?following=1&limit=10', a)).body
  assert.equal(feed.pagination.total, 14); assert.equal(feed.posts.length, 10); assert.equal(feed.posts[0].id, posts[13])
  assert.equal((await request('/api/posts?following=1&limit=10&page=2',a)).body.posts.length,4)
  assert.equal((await request('/api/posts?following=1&q='+users[1].username,a)).body.pagination.total,12)
  assert.equal((await request(follow(users[1].username), a, 'DELETE')).status,200)
  assert.equal((await request(follow(users[1].username), a, 'DELETE')).status,200)
  assert.equal((await request('/api/posts?following=1', a)).body.pagination.total,2)
  await db.execute('UPDATE users SET status = ? WHERE id = ?', ['suspended',users[2].id])
  assert.equal((await request('/api/posts?following=1', a)).body.pagination.total,0)
  assert.equal((await request('/api/following',a)).body.totalFollowing,4)
  assert.equal((await request(follow(users[2].username), a, 'PUT')).status,404)
  console.log('PASS: permissions, origin, self-follow, duplicate requests, isolation, counts, directory search/pagination, newest-first feed, drafts, author search, unfollow and suspended accounts.')
} finally {
  for (const id of posts) await db.execute('DELETE FROM posts WHERE id = ?', [id])
  for (const user of users) await db.execute('DELETE FROM users WHERE id = ?', [user.id])
  await db.end(); console.log('Isolated fixtures cleaned up.')
}
