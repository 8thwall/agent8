import {
  AIMessageChunk,
  HumanMessage,
  ToolMessage,
} from '@langchain/core/messages'
import {describe, expect, it} from 'vitest'
import {z} from 'zod'
import {
  convertZodToJsonSchema,
  getAccumulatedTokenAndCreditData,
} from '../../src/common/helpers'

describe('convertZodToJsonSchema', () => {
  it('should convert a simple Zod string schema to JSON schema', () => {
    // Arrange
    const zodSchema = z.string()

    // Act
    const result = convertZodToJsonSchema(zodSchema)

    // Assert
    expect(result).toBeDefined()
    expect(result.type).toBe('string')
  })

  it('should convert a Zod object schema to JSON schema', () => {
    // Arrange
    const zodSchema = z.object({
      name: z.string(),
      age: z.number(),
      isActive: z.boolean(),
    })

    // Act
    const result = convertZodToJsonSchema(zodSchema)

    // Assert
    expect(result).toBeDefined()
    expect(result.type).toBe('object')
    expect(result.properties).toBeDefined()
    expect(result.properties?.name).toEqual({type: 'string'})
    expect(result.properties?.age).toEqual({type: 'number'})
    expect(result.properties?.isActive).toEqual({type: 'boolean'})
  })

  it('should convert a Zod array schema to JSON schema', () => {
    // Arrange
    const zodSchema = z.array(z.string())

    // Act
    const result = convertZodToJsonSchema(zodSchema)

    // Assert
    expect(result).toBeDefined()
    expect(result.type).toBe('array')
    expect(result.items).toEqual({type: 'string'})
  })

  it('should handle optional properties in Zod schema', () => {
    // Arrange
    const zodSchema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    })

    // Act
    const result = convertZodToJsonSchema(zodSchema)

    // Assert
    expect(result).toBeDefined()
    expect(result.type).toBe('object')
    expect(result.required).toEqual(['required'])
    expect(result.properties?.required).toEqual({type: 'string'})
    expect(result.properties?.optional).toEqual({type: 'string'})
  })
})

const olderActiveCreditGrants = [
  {
    uuid: '28d0f9ae-54b6-4c29-9937-759f46085a63',
    category: 'FREE_PROMOTION',
    remainingQuantity: '1000000',
    expiresAt: '2025-10-15T20:34:00.000Z',
  },
]

const newerActiveCreditGrants = [
  {
    uuid: '28d0f9ae-54b6-4c29-9937-759f46085a63',
    category: 'FREE_PROMOTION',
    remainingQuantity: '1000000',
    expiresAt: '2025-10-15T20:34:00.000Z',
  },
  {
    uuid: '88f1bc18-168f-4d7a-9edf-1eaa379b799f',
    category: 'PAID_TOPUP',
    remainingQuantity: '1000000',
    expiresAt: '2025-11-06T22:33:31.000Z',
  },
]

describe('getAccumulatedTokenAndCreditData', () => {
  it('should return zeroed usage and empty aiApiStop for messages without response_metadata', () => {
    const messages = [new HumanMessage('What do you see in the scene?')]

    const result = getAccumulatedTokenAndCreditData(messages as any)

    expect(result).toBeDefined()
    expect(result.aiApiStop).toBeDefined()
    expect(result.aiApiStop.refundType).toBeUndefined()
    expect(result.aiApiStop.refundAmountBips).toBe(0)
    expect(result.aiApiStop.totalActionQuantityBips).toBe(0)
    expect(result.aiApiStop.activeCreditGrants).toEqual([])
    expect(result.metadata).toBeDefined()
    expect(result.metadata.usage).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    })
  })

  it('should accumulate usage and credit data from multiple messages', () => {
    const messages = [
      new HumanMessage('What do you see in the scene?'),
      new AIMessageChunk({
        content:
          'I need to use the getCurrentScene tool to get the current scene.',
        response_metadata: {
          aiApiStop: {
            totalActionQuantityBips: 100,
            activeCreditGrants: olderActiveCreditGrants,
          },
          metadata: {
            usage: {
              inputTokens: 8,
              outputTokens: 20,
              totalTokens: 28,
            },
          },
        },
      }),
      new ToolMessage({
        name: 'getCurrentScene',
        content: 'scene-json',
        tool_call_id: '1234',
      }),
      new AIMessageChunk({
        content: 'In this scene I see a red box.',
        response_metadata: {
          aiApiStop: {
            totalActionQuantityBips: 60,
            activeCreditGrants: newerActiveCreditGrants,
          },
          metadata: {
            usage: {
              inputTokens: 5,
              outputTokens: 23,
              totalTokens: 28,
            },
          },
        },
      }),
    ]

    const result = getAccumulatedTokenAndCreditData(messages)

    expect(result).toBeDefined()
    expect(result.aiApiStop).toBeDefined()
    expect(result.aiApiStop.refundType).toBeUndefined()
    expect(result.aiApiStop.refundAmountBips).toBe(0)
    expect(result.aiApiStop.totalActionQuantityBips).toBe(160)
    expect(result.aiApiStop.activeCreditGrants).toEqual(newerActiveCreditGrants)
    expect(result.metadata).toBeDefined()
    expect(result.metadata.usage).toEqual({
      inputTokens: 13,
      outputTokens: 43,
      totalTokens: 56,
    })
  })

  it('should set refundType to partial if any message has partial refund', () => {
    const messages = [
      new HumanMessage('What do you see in the scene?'),
      new AIMessageChunk({
        content: 'PARTIAL EXCEPTION OCCURED HERE',
        response_metadata: {
          aiApiStop: {
            refundType: 'partial',
            refundAmountBips: 50,
            totalActionQuantityBips: 100,
            activeCreditGrants: olderActiveCreditGrants,
          },
        },
      }),
      new AIMessageChunk({
        content:
          'I need to use the getCurrentScene tool to get the current scene.',
        response_metadata: {
          aiApiStop: {
            totalActionQuantityBips: 100,
            activeCreditGrants: olderActiveCreditGrants,
          },
          metadata: {
            usage: {
              inputTokens: 8,
              outputTokens: 20,
              totalTokens: 28,
            },
          },
        },
      }),
      new ToolMessage({
        name: 'getCurrentScene',
        content: 'scene-json',
        tool_call_id: '1234',
      }),
      new AIMessageChunk({
        content: 'FULL EXCEPTION OCCURED HERE',
        response_metadata: {
          aiApiStop: {
            refundType: 'full',
            refundAmountBips: 60,
            totalActionQuantityBips: 60,
            activeCreditGrants: newerActiveCreditGrants,
          },
        },
      }),
      new AIMessageChunk({
        content: 'In this scene I see a red box.',
        response_metadata: {
          aiApiStop: {
            totalActionQuantityBips: 60,
            activeCreditGrants: newerActiveCreditGrants,
          },
          metadata: {
            usage: {
              inputTokens: 5,
              outputTokens: 23,
              totalTokens: 28,
            },
          },
        },
      }),
    ]

    const result = getAccumulatedTokenAndCreditData(messages)

    expect(result).toBeDefined()
    expect(result.aiApiStop).toBeDefined()
    expect(result.aiApiStop.refundType).toBe('partial')
    expect(result.aiApiStop.refundAmountBips).toBe(110)
    expect(result.aiApiStop.totalActionQuantityBips).toBe(320)
    expect(result.aiApiStop.activeCreditGrants).toEqual(newerActiveCreditGrants)
    expect(result.metadata).toBeDefined()
    expect(result.metadata.usage).toEqual({
      inputTokens: 13,
      outputTokens: 43,
      totalTokens: 56,
    })
  })
})
