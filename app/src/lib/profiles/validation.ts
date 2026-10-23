import { z } from 'zod'
import { validCrop, type CropSettings } from '@/lib/image-crop'
const imageEdit=z.strictObject({originalId:z.uuid(),settings:z.custom<CropSettings>(validCrop)})
export const profileUsername = z.string().regex(/^[a-z][a-z0-9_]{2,31}$/)
export const profileQuery = z.strictObject({
  tab: z.enum(['posts','drafts']).default('posts'),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(100).default(''),
})
export const updateProfileSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(240), location: z.string().trim().max(80),
  coverMediaId: z.uuid().nullable(), avatarMediaId: z.uuid().nullable(),
  imageEdits:z.strictObject({cover:imageEdit.optional(),avatar:imageEdit.optional()}).optional(),
  coverY: z.number().int().min(0).max(100),
})
