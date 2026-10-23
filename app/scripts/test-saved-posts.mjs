import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config({ path: new URL('../.env.local', import.meta.url), quiet: true })
const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
const users = [], posts = [], tags = []
async function request(path, cookie, method = 'GET', origin) {
  const response = await fetch(base + path, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) } })
  return { status: response.status, body: await response.json() }
}
try {
  for (let i = 0; i < 2; i++) {
    const username = 'qasave_' + randomBytes(6).toString('hex'), password = randomBytes(24).toString('base64url')
    const response = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, displayName: 'Save QA', email: username + '@example.invalid', password }) })
    assert.equal(response.status, 201)
    const data = await response.json(); users.push({ id: data.user.id, cookie: '' })
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: username, password }) })
    assert.equal(login.status, 200); users[i].cookie = login.headers.get('set-cookie').split(';')[0]
  }
  for (let i = 0; i < 12; i++) {
    const id = randomUUID(); posts.push(id)
    await db.execute('INSERT INTO posts (id,author_id,type,title,slug,excerpt,status,published_at) VALUES (?,?,?,?,?,?,?,NOW(3))', [id, users[0].id, 'blog', 'Save QA ' + i, 'qasave-' + id, 'Fixture', i === 11 ? 'draft' : 'published'])
  }
  for (let i = 0; i < 3; i++) { const id = randomUUID(); tags.push(id); await db.execute('INSERT INTO tags (id,name,slug) VALUES (?,?,?)',[id,'QA tag '+i,'qa-'+id]) }
  for (const [post,tag] of [[posts[0],tags[0]],[posts[0],tags[1]],[posts[1],tags[0]],[posts[2],tags[2]]]) await db.execute('INSERT INTO post_tags (post_id,tag_id) VALUES (?,?)',[post,tag])
  const a = users[0].cookie, b = users[1].cookie, path = '/api/posts/' + posts[0] + '/save'
  assert.equal((await request('/api/posts?saved=1')).status, 401)
  assert.equal((await request(path, null, 'PUT')).status, 401)
  assert.equal((await request(path, a, 'PUT', 'https://example.invalid')).status, 403)
  assert.equal((await request('/api/posts/' + posts[11] + '/save', a, 'PUT')).status, 404)
  await Promise.all(Array.from({ length: 3 }, () => request(path, a, 'PUT').then(r => assert.equal(r.status, 200))))
  assert.equal((await request('/api/saved-posts', a)).body.total, 1)
  const collection = (await request('/api/posts?saved=1',a)).body
  assert.equal(collection.popularTags.length,2)
  assert.ok(collection.popularTags.every(tag=>tag.postCount===1))
  assert.ok(!collection.popularTags.some(tag=>tag.id===tags[2]))
  const intersection = (await request('/api/posts?tags=qa-'+tags[0]+',qa-'+tags[1],a)).body
  assert.deepEqual(intersection.posts.map(post=>post.id),[posts[0]])
  assert.equal((await request('/api/posts?tag=qa-'+tags[0]+'&tags=qa-'+tags[1],a)).body.pagination.total,1)
  assert.equal((await request('/api/posts?tags='+Array.from({length:11},(_,i)=>'t'+i).join(','),a)).status,400)
  assert.equal((await request(path, b)).body.saved, false)
  assert.equal((await request('/api/posts?saved=1', b)).body.pagination.total, 0)
  for (const id of posts.slice(1, 11)) assert.equal((await request('/api/posts/' + id + '/save', a, 'PUT')).status, 200)
  let list = await request('/api/posts?saved=1&limit=10', a)
  assert.equal(list.status, 200); assert.equal(list.body.posts.length, 10); assert.equal(list.body.pagination.total, 11)
  assert.equal(list.body.posts[0].id, posts[10])
  assert.equal((await request('/api/posts?saved=1&limit=10&page=2', a)).body.posts.length, 1)
  assert.equal((await request('/api/posts?saved=1&q=Save%20QA%2010', a)).body.posts.length, 1)
  await db.execute('UPDATE posts SET status = ? WHERE id = ?', ['hidden', posts[10]])
  assert.equal((await request('/api/saved-posts', a)).body.total, 10)
  assert.equal((await request('/api/posts?saved=1', a)).body.pagination.total, 10)
  assert.equal((await request(path, a, 'DELETE')).status, 200)
  assert.equal((await request(path, a, 'DELETE')).status, 200)
  assert.equal((await request(path, a)).body.saved, false)
  console.log('PASS: authentication, origin, isolation, duplicate saves, ordering, search, pagination, hidden posts and idempotent removal.')
} finally {
  for (const id of posts) await db.execute('DELETE FROM posts WHERE id = ?', [id])
  for (const id of tags) await db.execute('DELETE FROM tags WHERE id = ?', [id])
  for (const user of users) await db.execute('DELETE FROM users WHERE id = ?', [user.id])
  await db.end()
  console.log('Isolated fixtures cleaned up.')
}
