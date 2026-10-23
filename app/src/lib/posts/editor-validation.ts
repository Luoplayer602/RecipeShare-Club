import { z } from 'zod'

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable()

const ingredientSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  quantity: optionalText(80),
  unit: optionalText(40),
  note: optionalText(255),
})

const blockSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('heading'),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string().max(200),
  }),

  z.strictObject({
    type: z.literal('paragraph'),
    text: z.string().max(20_000),
  }),

  z.strictObject({
    type: z.literal('image'),
    mediaId: z.uuid(),
    alt: z.string().trim().max(255),
    caption: z.string().trim().max(500).optional(),
  }),

  z.strictObject({
    type: z.literal('video'),
    mediaId: z.uuid(),
    caption: z.string().trim().max(500).optional(),
  }),
  z.strictObject({
    type: z.literal('list'),
    style: z.enum([
      'disc', 'circle', 'square', 'decimal',
      'lower-alpha', 'upper-alpha', 'lower-roman', 'upper-roman',
    ]),
    items: z.array(z.string().trim().min(1).max(500)).max(100),
  }),
])

const recipeSchema = z.strictObject({
  prepMinutes: z.number().int().min(0).max(100_000).nullable(),
  cookMinutes: z.number().int().min(0).max(100_000).nullable(),
  servings: z.number().int().min(1).max(100_000).nullable(),
  difficulty: z.number().int().min(1).max(5).nullable(),
  ingredients: z.array(ingredientSchema).max(200),
})

export const saveEditorSchema = z.strictObject({
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(500),
  coverMediaId: z.uuid().nullable(),

  recipe: recipeSchema.nullable(),

  blocks: z.array(blockSchema).max(300),

  tagNames: z.array(
    z.string().trim().min(1).max(60),
  ).max(20),
})

export type SaveEditorInput = z.infer<typeof saveEditorSchema>