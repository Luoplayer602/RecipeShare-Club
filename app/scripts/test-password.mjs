import assert from 'node:assert/strict'
import {
  hashPassword,
  verifyPassword,
} from '../src/lib/auth/password.ts'

const password = 'MatKhauThuNghiem-2026!'
const first = await hashPassword(password)
const second = await hashPassword(password)

// Generate different salts for the same password.
assert.notEqual(first, second)

assert.equal(await verifyPassword(password, first), true)
assert.equal(await verifyPassword(password, second), true)
assert.equal(await verifyPassword('SaiMatKhau', first), false)
assert.equal(await verifyPassword('', first), false)
assert.equal(await verifyPassword(password, 'invalid-hash'), false)

// Preserve whitespace.
assert.equal(await verifyPassword(` ${password}`, first), false)

// Enforce processing limits.
await assert.rejects(() => hashPassword(''))
await assert.rejects(() => hashPassword('a'.repeat(1025)))
assert.equal(await verifyPassword('a'.repeat(1025), first), false)

console.log('PASS: password hashing, salting, verification, and limits.')