import assert from 'node:assert/strict'
import {
  classifyLoginIdentifier,
  loginSchema,
} from '../src/lib/auth/validation.ts'

// Normalize each identifier type.
assert.deepEqual(
  classifyLoginIdentifier('  MinhAn  '),
  { type: 'username', value: 'minhan' },
)

assert.deepEqual(
  classifyLoginIdentifier('DinhNghia@Example.COM '),
  { type: 'email', value: 'dinhnghia@example.com' },
)

assert.deepEqual(
  classifyLoginIdentifier(' +84901234567 '),
  { type: 'phone', value: '+84901234567' },
)

// Accept identifier and password; trim the identifier.
const ok = loginSchema.parse({
  identifier: '  minhan  ',
  password: 'MatKhauThatSuRatDaiHopLe',
})
assert.equal(ok.identifier, 'minhan')
assert.equal(ok.password, 'MatKhauThatSuRatDaiHopLe')

// Do not trim password whitespace.
const spaced = loginSchema.parse({
  identifier: 'minhan',
  password: '  password with whitespace  ',
})
assert.equal(spaced.password, '  password with whitespace  ')

// Reject missing or empty fields.
assert.equal(
  loginSchema.safeParse({ identifier: '   ', password: 'x'.repeat(15) }).success,
  false,
)
assert.equal(
  loginSchema.safeParse({ identifier: 'minhan', password: '' }).success,
  false,
)
assert.equal(loginSchema.safeParse({ identifier: 'minhan' }).success, false)
assert.equal(loginSchema.safeParse({ password: 'x'.repeat(15) }).success, false)

// Reject unknown fields (strictObject).
assert.equal(
  loginSchema.safeParse({
    identifier: 'minhan',
    password: 'x'.repeat(15),
    remember: true,
  }).success,
  false,
)

console.log('PASS: login validation and identifier normalization.')