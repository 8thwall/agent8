import {tool} from '@langchain/core/tools'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {auth} from '../../../src/auth'
import {createEventSource} from '../../../src/dependencies/ai/es-client'
import sceneAgentTool from '../../../src/tools/scene-gen/handler'

vi.mock('../../../src/dependencies/ai/es-client')
vi.mock('opik', async (importActual) => {
  const actual = await importActual<typeof import('opik')>()
  return {
    ...actual,
    track: vi.fn().mockReturnValue(vi.fn()),
    getTrackContext: vi.fn(() => ({
      span: {
        update: vi.fn(),
      },
    })),
  }
})
vi.mock('../../../src/factory/tool-factory', async (importActual) => {
  const actual =
    await importActual<typeof import('../../../src/factory/tool-factory')>()
  return {
    ...actual,
    Tool: {
      ...actual.Tool,
      create: vi
        .fn()
        .mockImplementation(
          (action: string, description: string, schema, _handler) => {
            return tool((_params) => vi.fn().mockReturnValue({objects: {}}), {
              name: action,
              description,
              schema,
            })
          },
        ),
    },
  }
})

describe('sceneAgentTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(auth, 'getToken').mockResolvedValue({token: 'test-token'})
  })

  it('should call the scene agent tool with the correct input and return the response', async () => {
    const firstRequestMockResponses = [
      {messageStart: {p: 'abc', role: 'assistant'}},
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {text: "I'll get the current scene information"},
        },
      },
      {contentBlockStop: {contentBlockIndex: 0, p: 'abcdefghi'}},
      {
        contentBlockStart: {
          contentBlockIndex: 1,
          p: 'abcd',
          start: {
            toolUse: {
              name: 'getCurrentScene',
              toolUseId: 'tooluse_MBa_uLyPSYOzzWO2tWUENQ',
            },
          },
        },
      },
      {
        contentBlockDelta: {
          contentBlockIndex: 1,
          delta: {toolUse: {input: ''}},
        },
      },
      {
        contentBlockStop: {
          contentBlockIndex: 1,
          p: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0',
        },
      },
      {messageStop: {stopReason: 'tool_use'}},
      {
        metadata: {
          metrics: {latencyMs: 4532},
          usage: {
            inputTokens: 21984,
            outputTokens: 46,
            serverToolUsage: {},
            totalTokens: 22030,
          },
        },
      },
      {
        aiApiStop: {
          totalActionQuantityBips: '50',
        },
      },
    ]
    const finalRequestMockResponses = [
      {messageStart: {p: 'abc', role: 'assistant'}},
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {text: "You're scene is currently empty."},
        },
      },
      {messageStop: {stopReason: 'end_turn'}},
      {
        metadata: {
          metrics: {latencyMs: 4232},
          usage: {
            inputTokens: 22984,
            outputTokens: 34,
            serverToolUsage: {},
            totalTokens: 23018,
          },
        },
      },
      {
        aiApiStop: {
          totalActionQuantityBips: '50',
          activeCreditGrants: [
            {
              uuid: '28d0f9ae-54b6-4c29-9937-759f46085a63',
              category: 'FREE_PROMOTION',
              remainingQuantity: '1000000',
              expiresAt: '2025-10-15T20:34:00.000Z',
            },
          ],
        },
      },
    ]
    const firstMockEventSource = {
      [Symbol.asyncIterator]: async function* () {
        for (const event of firstRequestMockResponses) {
          yield {
            data: JSON.stringify(event),
            event: event.aiApiStop ? 'end' : undefined,
          }
        }
      },
      close: vi.fn(),
    }
    const finalMockEventSource = {
      [Symbol.asyncIterator]: async function* () {
        for (const event of finalRequestMockResponses) {
          yield {data: JSON.stringify(event)}
        }
      },
      close: vi.fn(),
    }
    vi.mocked(createEventSource)
      .mockReturnValueOnce(firstMockEventSource as any)
      .mockReturnValue(finalMockEventSource as any)

    const result = await sceneAgentTool.handler({
      prompt: 'Call the getCurrentScene tool',
      sceneReadonly: false,
    })
    expect(result).toHaveProperty('content')
    expect(result.content).toStrictEqual([
      {type: 'text', text: "You're scene is currently empty."},
    ])
    expect(result).toHaveProperty('_meta')
    expect(result._meta).toStrictEqual({
      metadata: {
        usage: {
          inputTokens: 44968,
          outputTokens: 80,
          totalTokens: 45048,
        },
      },
      aiApiStop: {
        activeCreditGrants: [
          {
            uuid: '28d0f9ae-54b6-4c29-9937-759f46085a63',
            category: 'FREE_PROMOTION',
            remainingQuantity: '1000000',
            expiresAt: '2025-10-15T20:34:00.000Z',
          },
        ],
        totalActionQuantityBips: 100,
        refundAmountBips: 0,
        refundType: undefined,
      },
    })
  })
})
