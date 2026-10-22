import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import {
  check,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  varchar,
} from 'drizzle-orm/mysql-core'

export const userTitles = mysqlTable('user_titles', {
  id: int('id', { unsigned: true }).autoincrement().primaryKey(),
  code: varchar('code', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 80 }).notNull(),
  description: varchar('description', { length: 255 }),
})


export const users = mysqlTable(
  'users',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    username: varchar('username', { length: 32 }).notNull().unique(),
    displayName: varchar('display_name', { length: 80 }).notNull(),

    role: mysqlEnum('role', ['member', 'moderator', 'admin'])
      .notNull()
      .default('member'),

    titleId: int('title_id', { unsigned: true })
      .notNull()
      .references(() => userTitles.id, { onDelete: 'restrict' }),

    email: varchar('email', { length: 254 }).unique(),
    phone: varchar('phone', { length: 16 }).unique(),
    passwordHash: varchar('password_hash', { length: 255 }),
    avatarUrl: varchar('avatar_url', { length: 2048 }),

    status: mysqlEnum('status', ['active', 'suspended', 'deactivated'])
      .notNull()
      .default('active'),

    emailVerifiedAt: datetime('email_verified_at', {
      mode: 'date',
      fsp: 3,
    }),
    phoneVerifiedAt: datetime('phone_verified_at', {
      mode: 'date',
      fsp: 3,
    }),

    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),

    updatedAt: datetime('updated_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`)
      .$onUpdate(() => new Date()),
  },
  table => [
    index('users_title_id_idx').on(table.titleId),
    check(
      'users_contact_required',
      sql`COALESCE(CHAR_LENGTH(TRIM(${table.email})), 0) > 0
          OR COALESCE(CHAR_LENGTH(TRIM(${table.phone})), 0) > 0`,
    ),
  ],
)

export const userSessions = mysqlTable(
  'user_sessions',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),

    userId: varchar('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    expiresAt: datetime('expires_at', {
      mode: 'date',
      fsp: 3,
    }).notNull(),

    createdAt: datetime('created_at', {
      mode: 'date',
      fsp: 3,
    })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  table => [
    index('user_sessions_user_id_idx').on(table.userId),
    index('user_sessions_expires_at_idx').on(table.expiresAt),
  ],
)