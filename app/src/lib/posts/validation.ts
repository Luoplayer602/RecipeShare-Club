import { z } from 'zod'

export const createDraftSchema = z.strictObject({
  type: z.enum(['recipe', 'blog']),

  title: z.string()
    .trim()
    .min(1, 'Please enter a title.')
    .max(200, 'Title must contain at most 200 characters.'),

  excerpt: z.string()
    .trim()
    .min(1, 'Please enter a short description.')
    .max(500, 'Description must contain at most 500 characters.'),

  coverMediaId: z.uuid('Invalid cover image ID.')
    .nullable()
    .optional()
    .transform(value => value ?? null),
})

export type CreateDraftInput = z.infer<typeof createDraftSchema>
export { postIdSchema } from './post-id'
