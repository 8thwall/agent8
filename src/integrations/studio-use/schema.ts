import z from 'zod'

const responseSchema = z.object({
  requestId: z.string().uuid(),
  response: z.optional(z.any().or(z.object({
    isError: z.literal(true),
    error: z.unknown(),
  }))),
})

export {
  responseSchema,
}
