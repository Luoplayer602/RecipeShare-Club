import { z } from 'zod'

export const postIdSchema = z.uuid('Invalid post ID.')
