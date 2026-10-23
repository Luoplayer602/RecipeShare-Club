// Creates one isolated test account and removes its records/files in finally.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })
const base = process.env.TEST_BASE_URL || 'http://localhost:3000'
const suffix = randomBytes(6).toString('hex')
const username = `uitest_${suffix}`
const password = randomBytes(24).toString('base64url')
const db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME })
let cookie = '', userId, otherUserId
async function request(url, method = 'GET', body, expected = 200, authenticated = true) {
  const form = body instanceof FormData
  const response = await fetch(base + url, { method, headers: { ...(authenticated && cookie ? { Cookie: cookie } : {}), ...(body && !form ? { 'Content-Type': 'application/json' } : {}) }, body: body ? form ? body : JSON.stringify(body) : undefined })
  const data = await response.json()
  assert.equal(response.status, expected, `${method} ${url}: ${data.code || response.status}`)
  if (url === '/api/auth/login') cookie = response.headers.get('set-cookie').split(';')[0]
  return data
}
try {
  const account = await request('/api/auth/register', 'POST', { username, displayName: 'Editor integration check', email: `${username}@example.invalid`, password }, 201)
  userId = account.user.id
  await request('/api/auth/login', 'POST', { identifier: username, password })
  const form = new FormData()
  form.set('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' }), 'check.png')
  const { media: image } = await request('/api/media/upload', 'POST', form, 201)
  const profilePath = `/api/profiles/${username}`
  const profileInput = { displayName: 'Profile integration', bio: 'Profile biography', location: 'Vietnam', coverMediaId: image.id, avatarMediaId: image.id, coverY: 73 }
  await request('/api/profile', 'PATCH', profileInput, 401, false)
  await request('/api/profile', 'PATCH', profileInput)
  await request('/api/profile', 'PATCH', { ...profileInput, role: 'admin' }, 422)
  await request('/api/profile', 'PATCH', { ...profileInput, coverY: 101 }, 422)
  const ownProfile = await request(profilePath)
  assert.equal(ownProfile.own, true)
  assert.equal(ownProfile.profile.displayName, profileInput.displayName)
  assert.equal(ownProfile.profile.coverY, 73)
  const guestProfile = await request(profilePath, 'GET', undefined, 200, false)
  assert.equal(guestProfile.own, false)
  assert.equal(guestProfile.stats.draftCount, null)
  assert.equal(guestProfile.profile.coverUrl, `/api/media/${image.id}/file`)
  await request(`${profilePath}?tab=drafts`, 'GET', undefined, 403, false)
  const publicImage = await fetch(`${base}/api/media/${image.id}/file`)
  assert.equal(publicImage.status, 200)
  await publicImage.arrayBuffer()
  const firstCookie = cookie
  const other = await request('/api/auth/register', 'POST', { username: `uitest_other_${suffix}`, displayName: 'Other profile check', email: `uitest_other_${suffix}@example.invalid`, password }, 201)
  otherUserId = other.user.id
  await request('/api/auth/login', 'POST', { identifier: `uitest_other_${suffix}`, password })
  await request(`${profilePath}?tab=drafts`, 'GET', undefined, 403)
  await request('/api/profile', 'PATCH', { ...profileInput, displayName: 'Foreign media attempt' }, 422)
  cookie = firstCookie
  assert.equal((await request(profilePath)).profile.displayName, profileInput.displayName)
  const { media: video } = await request('/api/media/video-url', 'POST', { url: 'https://www.youtube.com/watch?v=abcdefghijk' }, 201)
  const listBlocks = ['disc', 'circle', 'square', 'decimal', 'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman'].map(style => ({ type: 'list', style, items: ['First item', '<script>plain text</script>'] }))
  for (const type of ['recipe', 'blog']) {
    const { post } = await request('/api/posts', 'POST', { type, title: `Integration ${suffix} ${type}`, excerpt: 'Integration content' }, 201)
    await request(`/api/posts/${post.id}`, 'GET', undefined, 404, false)
    const drafts = await request(`${profilePath}?tab=drafts`)
    assert(drafts.items.some(item => item.id === post.id))
    const publicPosts = await request(profilePath, 'GET', undefined, 200, false)
    assert(!publicPosts.items.some(item => item.id === post.id))
    await request(`/api/posts/${post.id}/edit`, 'GET', undefined, 401, false)
    await request(`/api/posts/${post.id}/publish`, 'POST', undefined, 422)
    const body = { title: post.title, excerpt: 'Integration content', coverMediaId: image.id,
      recipe: type === 'recipe' ? { prepMinutes: 10, cookMinutes: 5, servings: 2, difficulty: 1, ingredients: [{ name: 'Ingredient', quantity: '1/2', unit: null, note: null }] } : null,
      blocks: [{ type: 'heading', level: 2, text: 'Heading' }, { type: 'paragraph', text: 'Paragraph' }, { type: 'image', mediaId: image.id, alt: 'Check', caption: 'Caption' }, { type: 'video', mediaId: video.id, caption: 'Video' }, ...listBlocks],
      tagNames: [`check_${suffix}`],
    }
    await request(`/api/posts/${post.id}/edit`, 'PATCH', body)
    const { post: restored } = await request(`/api/posts/${post.id}/edit`)
    assert.equal(restored.title, post.title)
    assert.equal(restored.blocks.length, body.blocks.length)
    assert.deepEqual(restored.blocks.filter(block => block.data.type === 'list').map(block => block.data), listBlocks)
    assert.equal(restored.media.length, 2)
    assert.equal(restored.media.find(item => item.id === video.id).url, video.url)
    assert.equal(restored.recipe?.prepMinutes ?? null, type === 'recipe' ? 10 : null)
    assert.equal(restored.recipe?.cookMinutes ?? null, type === 'recipe' ? 5 : null)
    for (const invalid of [
      { type: 'list', style: 'invalid', items: ['Item'] },
      { type: 'list', style: 'disc', items: [''] },
      { type: 'list', style: 'disc', items: ['a'.repeat(501)] },
      { type: 'list', style: 'disc', items: Array(101).fill('Item') },
    ]) await request(`/api/posts/${post.id}/edit`, 'PATCH', { ...body, blocks: [invalid] }, 422)
    if (type === 'blog') {
      await request(`/api/posts/${post.id}/edit`, 'PATCH', { ...body, blocks: [{ type: 'list', style: 'disc', items: [] }] })
      await request(`/api/posts/${post.id}/publish`, 'POST', undefined, 422)
      body.blocks = listBlocks
      await request(`/api/posts/${post.id}/edit`, 'PATCH', body)
    }
    await request(`/api/posts/${post.id}/publish`, 'POST')
    const { post: published } = await request(`/api/posts/${post.id}`, 'GET', undefined, 200, false)
    assert.equal(published.blocks.length, body.blocks.length)
    assert.deepEqual(published.blocks.filter(block => block.data.type === 'list').map(block => block.data), listBlocks)
    const list = await request(`/api/posts?q=${suffix}`, 'GET', undefined, 200, false)
    assert(list.posts.some(item => item.id === post.id))
    await request(`/api/posts/${post.id}/edit`, 'PATCH', body, 409)
  }
  const finalProfile = await request(profilePath)
  assert.equal(finalProfile.stats.publishedCount, 2)
  assert.equal(finalProfile.stats.draftCount, 0)
  const profileSearch = await request(`${profilePath}?q=missing_profile_search_${suffix}`)
  assert.equal(profileSearch.pagination.total, 0)
  assert.equal(profileSearch.stats.publishedCount, 2)
  console.log('PASS: persisted profile/cover/avatar, public image access, private drafts, other-user/media guards and profile post counts/search.')
  const empty = await request(`/api/posts?q=no_result_${suffix}`, 'GET', undefined, 200, false)
  assert.equal(empty.posts.length, 0)
  console.log('PASS: login, upload, create/save/restore/publish recipe and blog, media restoration, public list/detail, all eight list styles, list-only publication, empty/invalid list rejection and auth/draft guards.')
} finally {
  // Every mutation below is scoped to the randomly generated account from this run.
  if (!userId) {
    const [accounts] = await db.execute('SELECT id FROM users WHERE username = ?', [username])
    userId = accounts[0]?.id
  }
  if (userId) {
    const [accounts] = await db.execute('SELECT username FROM users WHERE id = ?', [userId])
    assert.equal(accounts[0]?.username, username)
    const [files] = await db.execute('SELECT storage_key FROM media_assets WHERE owner_id = ?', [userId])
    await db.beginTransaction()
    try {
      await db.execute('DELETE FROM post_revisions WHERE edited_by = ?', [userId])
      await db.execute('DELETE FROM posts WHERE author_id = ?', [userId])
      await db.execute('DELETE FROM tags WHERE created_by = ?', [userId])
      await db.execute('DELETE FROM user_profiles WHERE user_id = ?', [userId])
      await db.execute('DELETE FROM media_assets WHERE owner_id = ?', [userId])
      await db.execute('DELETE FROM users WHERE id = ? AND username = ?', [userId, username])
      await db.commit()
    } catch (error) { await db.rollback(); throw error }
    const directory = path.resolve(process.env.MEDIA_UPLOAD_DIR?.trim() || '.uploads')
    for (const file of files) {
      if (!file.storage_key) continue
      assert.match(file.storage_key, /^[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm)$/)
      const target = path.resolve(directory, file.storage_key)
      assert.equal(path.dirname(target), directory)
      await unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error })
    }
    console.log('PASS: isolated test account, content and uploaded files cleaned up.')
  }
  if (otherUserId) await db.execute('DELETE FROM users WHERE id = ? AND username = ?', [otherUserId, `uitest_other_${suffix}`])
  await db.end()
}
