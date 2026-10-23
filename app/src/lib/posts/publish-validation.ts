import { saveEditorSchema } from './editor-validation'

export const publishEditorSchema = saveEditorSchema
  .superRefine((input, context) => {
    if (!input.coverMediaId) {
      context.addIssue({
        code: 'custom',
        path: ['coverMediaId'],
        message: 'A cover image is required to publish.',
      })
    }

    const hasContent = input.blocks.some(block => {
      if (block.type === 'heading') return false
      if (block.type === 'paragraph') return block.text.trim().length > 0

      return block.type === 'image' || block.type === 'video'
    })

    if (!hasContent) {
      context.addIssue({
        code: 'custom',
        path: ['blocks'],
        message: 'Add a paragraph, image, or video before publishing.',
      })
    }

    if (!input.excerpt.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['excerpt'],
        message: 'A short description is required to publish.',
      })
    }

    if (input.recipe !== null) {
      const recipe = input.recipe

      for (const field of [
        'prepMinutes',
        'cookMinutes',
        'servings',
        'difficulty',
      ] as const) {
        if (recipe[field] === null) {
          context.addIssue({
            code: 'custom',
            path: ['recipe', field],
            message: 'This field is required to publish a recipe.',
          })
        }
      }

      if (recipe.ingredients.length === 0) {
        context.addIssue({
          code: 'custom',
          path: ['recipe', 'ingredients'],
          message: 'Add at least one ingredient before publishing.',
        })
      }
    }
  })