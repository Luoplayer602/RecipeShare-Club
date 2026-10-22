import 'server-only'

import { drizzle } from 'drizzle-orm/mysql2'
import { createPool, type Pool } from 'mysql2/promise'
import { z } from 'zod'
import * as schema from './schema'

const env = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
}).parse({
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER,
  DB_PASSWORD: process.env.DB_PASSWORD,
})

const globalForDb = globalThis as typeof globalThis & {
  recipePool?: Pool
}

const pool =
  globalForDb.recipePool ??
  createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 20,
    connectTimeout: 10_000,
    enableKeepAlive: true,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.recipePool = pool
}

export const db = drizzle(pool, {
  schema,
  mode: 'default',
})