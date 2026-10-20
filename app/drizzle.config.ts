import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.migration.local' })

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Thiếu biến môi trường: ${name}`)
  return value
}

export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    host: required('MIGRATION_DB_HOST'),
    port: Number(required('MIGRATION_DB_PORT')),
    database: required('MIGRATION_DB_NAME'),
    user: required('MIGRATION_DB_USER'),
    password: required('MIGRATION_DB_PASSWORD'),
  },
})