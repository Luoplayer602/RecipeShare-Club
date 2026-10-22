import { z } from 'zod'

function emptyToNull(value: unknown): unknown {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return value
}

const emailSchema = z.preprocess(
  emptyToNull,
  z.string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Invalid email address.').max(254))
    .nullable(),
)

const phoneSchema = z.preprocess(
  emptyToNull,
  z.string()
    .trim()
    .regex(
      /^\+[1-9]\d{7,14}$/,
      'Enter a phone number in international format, for example +84901234567.',
    )
    .nullable(),
)

export const registerSchema = z.strictObject({
  username: z.string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must contain at least 3 characters.')
    .max(32, 'Username must contain at most 32 characters.')
    .regex(
      /^[a-z][a-z0-9_]*$/,
      'Username must start with a letter and contain only ASCII letters, digits, and underscores.',
    ),

  displayName: z.string()
    .trim()
    .min(1, 'Please enter a display name.')
    .max(80, 'Display name must contain at most 80 characters.'),

  email: emailSchema,
  phone: phoneSchema,

  password: z.string()
    .min(15, 'Password must contain at least 15 characters.')
    .max(128, 'Password must contain at most 128 characters.'),
}).refine(
  data => data.email !== null || data.phone !== null,
  {
    message: 'An email address or phone number is required.',
    path: ['email'],
  },
)

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.strictObject({
  identifier: z
    .string()
    .trim()
    .min(1, 'Please enter a username, email, or phone number.')
    .max(254, 'Login identifier must contain at most 254 characters.'),

  password: z
    .string()
    .min(1, 'Please enter a password.')
    .max(128, 'Password must contain at most 128 characters.'),
})

export type LoginInput = z.infer<typeof loginSchema>

export type LoginIdentifier =
  | { type: 'username'; value: string }
  | { type: 'email'; value: string }
  | { type: 'phone'; value: string }

/**
 * Classify and normalize the identifier according to the rules of `users`:
 * Username and email are stored in lowercase; phone uses international format.
 * Leave the password unchanged.
 */
export function classifyLoginIdentifier(raw: string): LoginIdentifier {
  const value = raw.trim()

  if (value.includes('@')) {
    return { type: 'email', value: value.toLowerCase() }
  }

  if (value.startsWith('+')) {
    return { type: 'phone', value }
  }

  return { type: 'username', value: value.toLowerCase() }
}