import 'server-only'

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const N = 131072
const r = 8
const p = 1
const keyLength = 64
const maxmem = 256 * 1024 * 1024

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      { N, r, p, maxmem },
      (error, key) => {
        if (error) reject(error)
        else resolve(key)
      },
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || Buffer.byteLength(password, 'utf8') > 1024) {
    throw new Error('Password is empty or exceeds the processing limit.')
  }

  const salt = randomBytes(16)
  const key = await derive(password, salt)

  return [
    'scrypt',
    String(N),
    String(r),
    String(p),
    salt.toString('hex'),
    key.toString('hex'),
  ].join('$')
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!password || Buffer.byteLength(password, 'utf8') > 1024) {
    return false
  }

  const parts = storedHash.split('$')
  if (parts.length !== 6) return false

  const [algorithm, storedN, storedR, storedP, saltHex, keyHex] = parts

  if (
    algorithm !== 'scrypt' ||
    storedN !== String(N) ||
    storedR !== String(r) ||
    storedP !== String(p) ||
    !/^[a-f0-9]{32}$/.test(saltHex) ||
    !/^[a-f0-9]{128}$/.test(keyHex)
  ) {
    return false
  }

  const expectedKey = Buffer.from(keyHex, 'hex')
  const actualKey = await derive(password, Buffer.from(saltHex, 'hex'))

  return timingSafeEqual(actualKey, expectedKey)
}