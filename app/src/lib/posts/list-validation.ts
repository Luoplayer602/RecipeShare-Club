import { z } from 'zod'

export const listPostsQuerySchema = z.strictObject({
  page: z.coerce.number()
    .int()
    .min(1)
    .max(10_000)
    .default(1),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(50)
    .default(20),

  type: z.enum(['recipe', 'blog']).optional(),

  q: z.string()
    .trim()
    .max(100)
    .optional(),

  tag: z.string()
    .trim()
    .min(1)
    .max(80)
    .optional(),
})

export type ListPostsQuery =
  z.infer<typeof listPostsQuerySchema>