import assert from 'node:assert/strict'
import { registerSchema } from '../src/lib/auth/validation.ts'

const base = {
  username: 'minhan',
  displayName: 'Minh An',
  password: 'MatKhauThuNghiem-2026!',
}

// Register with email and normalize the input.
const emailUser = registerSchema.parse({
  ...base,
  username: '  MinhAn  ',
  displayName: '  Minh An  ',
  email: '  MinhAn@example.com  ',
})

assert.equal(emailUser.username, 'minhan')
assert.equal(emailUser.displayName, 'Minh An')
assert.equal(emailUser.email, 'minhan@example.com')
assert.equal(emailUser.phone, null)

// Register with phone; convert an empty email to null.
const phoneUser = registerSchema.parse({
  ...base,
  email: '   ',
  phone: '+84901234567',
})

assert.equal(phoneUser.email, null)
assert.equal(phoneUser.phone, '+84901234567')

// Allow both contact methods.
assert.equal(registerSchema.safeParse({
  ...base,
  email: 'minhan@example.com',
  phone: '+84901234567',
}).success, true)

// Preserve the password exactly.
const spacedPassword = ` ${base.password} `
assert.equal(registerSchema.parse({
  ...base,
  email: 'minhan@example.com',
  password: spacedPassword,
}).password, spacedPassword)

// Reject invalid input.
const invalidInputs = [
  { ...base },
  { ...base, email: '', phone: '' },
  { ...base, email: 'khong-phai-email' },
  { ...base, phone: '0901234567' },
  { ...base, email: 'minhan@example.com', username: '123minhan' },
  { ...base, email: 'minhan@example.com', username: 'minh an' },
  { ...base, email: 'minhan@example.com', displayName: '   ' },
  { ...base, email: 'minhan@example.com', password: 'qua-ngan' },
  { ...base, email: 'minhan@example.com', password: 'a'.repeat(129) },
  { ...base, email: 'minhan@example.com', role: 'admin' },
  { ...base, email: 'minhan@example.com', titleId: 1 },
]

for (const input of invalidInputs) {
  assert.equal(registerSchema.safeParse(input).success, false)
}

console.log('PASS: registration validation and input normalization.')