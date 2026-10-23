import { z } from 'zod'
import { normalizeVideoUrl } from './video-url'

export const createVideoUrlSchema = z.strictObject({
  url: z.string()
    .trim()
    .max(2048)
    .transform((value, context) => {
      const video = normalizeVideoUrl(value)

      if (!video) {
        context.addIssue({
          code: 'custom',
          message:
            'Use a valid HTTPS YouTube link or a direct MP4/WebM URL.',
        })
        return z.NEVER
      }

      return video
    }),
})

export type CreateVideoUrlInput =
  z.infer<typeof createVideoUrlSchema>