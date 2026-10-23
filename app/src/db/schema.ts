import type { SaveEditorInput } from '@/lib/posts/editor-validation'
import type { ProfileImageEdits } from '@/lib/image-crop'
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
  json,
  uniqueIndex,
  primaryKey,
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

export const mediaAssets = mysqlTable(
  'media_assets',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    ownerId: varchar('owner_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    kind: mysqlEnum('kind', ['image', 'video']).notNull(),

    source: mysqlEnum('source', ['upload', 'url']).notNull(),

    storageKey: varchar('storage_key', { length: 512 }),

    externalUrl: varchar('external_url', { length: 2048 }),

    originalName: varchar('original_name', { length: 255 }),

    mimeType: varchar('mime_type', { length: 127 }),

    metadata: json('metadata')
      .$type<{
        sizeBytes?: number
        width?: number
        height?: number
        durationSeconds?: number
      }>(),

    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  table => [
    index('media_assets_owner_id_idx').on(table.ownerId),
    check(
      'media_assets_source_required',
      sql`(
        ${table.source} = 'upload'
        AND CHAR_LENGTH(TRIM(${table.storageKey})) > 0
        AND ${table.storageKey} IS NOT NULL
        AND ${table.externalUrl} IS NULL
      ) OR (
        ${table.source} = 'url'
        AND CHAR_LENGTH(TRIM(${table.externalUrl})) > 0
        AND ${table.externalUrl} IS NOT NULL
        AND ${table.storageKey} IS NULL
      )`,
    ),
  ],
)

export const userProfiles = mysqlTable('user_profiles', {
  userId: varchar('user_id', { length: 36 }).primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  bio: varchar('bio', { length: 240 }).notNull().default(''),
  location: varchar('location', { length: 80 }).notNull().default(''),
  coverMediaId: varchar('cover_media_id', { length: 36 }).references(() => mediaAssets.id, { onDelete: 'restrict' }),
  avatarMediaId: varchar('avatar_media_id', { length: 36 }).references(() => mediaAssets.id, { onDelete: 'restrict' }),
  imageEdits: json('image_edits').$type<ProfileImageEdits>(),
  coverY: int('cover_y', { unsigned: true }).notNull().default(50),
}, table => [check('user_profiles_cover_y_check', sql`${table.coverY} BETWEEN 0 AND 100`)])

export const posts = mysqlTable(
  'posts',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    authorId: varchar('author_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    type: mysqlEnum('type', ['recipe', 'blog']).notNull(),

    title: varchar('title', { length: 200 }).notNull(),

    slug: varchar('slug', { length: 220 }).notNull().unique(),

    excerpt: varchar('excerpt', { length: 500 }).notNull(),

    coverMediaId: varchar('cover_media_id', { length: 36 })
      .references(() => mediaAssets.id, { onDelete: 'restrict' }),

    status: mysqlEnum('status', ['draft', 'published', 'hidden'])
      .notNull()
      .default('draft'),

    publishedAt: datetime('published_at', {
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

    deletedAt: datetime('deleted_at', {
      mode: 'date',
      fsp: 3,
    }),
  },
  table => [
    index('posts_author_id_idx').on(table.authorId),
    index('posts_cover_media_id_idx').on(table.coverMediaId),

    index('posts_feed_idx').on(
      table.status,
      table.deletedAt,
      table.publishedAt,
      table.id,
    ),

    check(
      'posts_published_at_required',
      sql`${table.status} <> 'published'
          OR ${table.publishedAt} IS NOT NULL`,
    ),

    check(
      'posts_title_required',
      sql`CHAR_LENGTH(TRIM(${table.title})) > 0`,
    ),
  ],
)

export const recipeDetails = mysqlTable(
  'recipe_details',
  {
    postId: varchar('post_id', { length: 36 })
      .primaryKey()
      .references(() => posts.id, { onDelete: 'cascade' }),

    prepMinutes: int('prep_minutes', { unsigned: true }),

    cookMinutes: int('cook_minutes', { unsigned: true }),

    servings: int('servings', { unsigned: true }),

    difficulty: int('difficulty', { unsigned: true }),
  },
  table => [
    check(
      'recipe_details_servings_positive',
      sql`${table.servings} IS NULL OR ${table.servings} > 0`,
    ),
    check(
      'recipe_details_difficulty_range',
      sql`${table.difficulty} IS NULL
          OR ${table.difficulty} BETWEEN 1 AND 5`,
    ),
  ],
)

export const recipeIngredients = mysqlTable(
  'recipe_ingredients',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    postId: varchar('post_id', { length: 36 })
      .notNull()
      .references(() => recipeDetails.postId, {
        onDelete: 'cascade',
      }),

    name: varchar('name', { length: 150 }).notNull(),

    quantity: varchar('quantity', { length: 80 }),

    unit: varchar('unit', { length: 40 }),

    note: varchar('note', { length: 255 }),

    position: int('position', { unsigned: true }).notNull(),
  },
  table => [
    uniqueIndex('recipe_ingredients_post_position_unique').on(
      table.postId,
      table.position,
    ),
    check(
      'recipe_ingredients_name_required',
      sql`CHAR_LENGTH(TRIM(${table.name})) > 0`,
    ),
  ],
)

export type PostBlockData =
  | {
      type: 'heading'
      level: 1 | 2 | 3
      text: string
    }
  | {
      type: 'paragraph'
      text: string
    }
  | {
      type: 'image'
      mediaId: string
      alt: string
      caption?: string
    }
  | {
      type: 'video'
      mediaId: string
      caption?: string
    }
  | {
      type: 'list'
      style: 'disc' | 'circle' | 'square' | 'decimal'
        | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman'
      items: string[]
    }

export const postBlocks = mysqlTable(
  'post_blocks',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    postId: varchar('post_id', { length: 36 })
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),

    data: json('data').$type<PostBlockData>().notNull(),

    position: int('position', { unsigned: true }).notNull(),
  },
  table => [
    uniqueIndex('post_blocks_post_position_unique').on(
      table.postId,
      table.position,
    ),
  ],
)

export const tags = mysqlTable(
  'tags',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    name: varchar('name', { length: 60 }).notNull().unique(),

    slug: varchar('slug', { length: 80 }).notNull().unique(),

    createdBy: varchar('created_by', { length: 36 })
      .references(() => users.id, { onDelete: 'set null' }),

    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  table => [
    check(
      'tags_name_required',
      sql`CHAR_LENGTH(TRIM(${table.name})) > 0`,
    ),
  ],
)

export const postTags = mysqlTable(
  'post_tags',
  {
    postId: varchar('post_id', { length: 36 })
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),

    tagId: varchar('tag_id', { length: 36 })
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  table => [
    primaryKey({ columns: [table.postId, table.tagId] }),
    index('post_tags_tag_id_idx').on(table.tagId),
  ],
)

export type PostRevisionSnapshot = {
  schemaVersion: 1
  type: 'recipe' | 'blog'
  title: string
  slug: string
  excerpt: string
  coverMediaId: string | null

  recipe: {
    prepMinutes: number | null
    cookMinutes: number | null
    servings: number | null
    difficulty: number | null
    ingredients: Array<{
      name: string
      quantity: string | null
      unit: string | null
      note: string | null
      position: number
    }>
  } | null

  blocks: Array<{
    data: PostBlockData
    position: number
  }>

  tags: Array<{
    id: string
    name: string
    slug: string
  }>
}

export const postRevisions = mysqlTable(
  'post_revisions',
  {
    id: varchar('id', { length: 36 })
      .primaryKey()
      .$defaultFn(() => randomUUID()),

    postId: varchar('post_id', { length: 36 })
      .notNull()
      .references(() => posts.id, { onDelete: 'restrict' }),

    version: int('version', { unsigned: true }).notNull(),

    editedBy: varchar('edited_by', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),

    snapshot: json('snapshot')
      .$type<PostRevisionSnapshot>()
      .notNull(),

    createdAt: datetime('created_at', { mode: 'date', fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  table => [
    uniqueIndex('post_revisions_post_version_unique').on(
      table.postId,
      table.version,
    ),
    index('post_revisions_edited_by_idx').on(table.editedBy),
    check(
      'post_revisions_version_positive',
      sql`${table.version} > 0`,
    ),
  ],
)
export const savedPosts = mysqlTable('saved_posts', {
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  postId: varchar('post_id', { length: 36 }).notNull().references(() => posts.id, { onDelete: 'cascade' }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
}, table => [primaryKey({ columns: [table.userId, table.postId] }), index('saved_posts_user_created_idx').on(table.userId, table.createdAt, table.postId)])

export const userFollows = mysqlTable('user_follows', {
  followerId: varchar('follower_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  authorId: varchar('author_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
}, table => [primaryKey({ columns: [table.followerId, table.authorId] }), index('user_follows_author_idx').on(table.authorId), index('user_follows_recent_idx').on(table.followerId, table.createdAt, table.authorId), check('user_follows_not_self', sql`${table.followerId} <> ${table.authorId}`)])

export const postEdits = mysqlTable('post_edits', {
  postId: varchar('post_id',{length:36}).primaryKey().references(()=>posts.id,{onDelete:'cascade'}),
  content: json('content').$type<SaveEditorInput>().notNull(),
  updatedAt: datetime('updated_at',{mode:'date',fsp:3}).notNull().default(sql`CURRENT_TIMESTAMP(3)`),
})
