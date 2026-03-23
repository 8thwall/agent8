import {beforeEach, describe, expect, it, vi} from 'vitest'
import {auth} from '../../../src/auth'
import studioCodeGenTool from '../../../src/tools/code-gen/handler'
import * as helpers from '../../../src/tools/code-gen/helpers'

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

import {createEventSource} from '../../../src/dependencies/ai/es-client'

const getRuntimeSpy = vi.spyOn(helpers, 'getRuntimeVersion')
const getFilesInPromptFormatSpy = vi.spyOn(helpers, 'getFilesInPromptFormat')

describe('studioCodeGenTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(auth, 'getToken').mockResolvedValue({token: 'test-token'})
  })

  it('should generate code based on the prompt and rootPath', async () => {
    const prompt = 'Create a new component'
    const rootPath = '/path/to/project'
    const mockResponses = [
      {messageStart: {p: 'abcd', role: 'assistant'}},
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {text: 'Generated code content'},
        },
      },
      {messageStop: {stopReason: 'end_turn'}},
      {
        metadata: {
          metrics: {latencyMs: 10},
          usage: {
            cacheReadInputTokenCount: 0,
            cacheReadInputTokens: 0,
            cacheWriteInputTokenCount: 0,
            cacheWriteInputTokens: 0,
            inputTokens: 8,
            outputTokens: 65,
            serverToolUsage: {},
            totalTokens: 73,
          },
        },
      },
      {
        aiApiStop: {
          totalActionQuantityBips: '150',
          activeCreditGrants: [],
        },
      },
    ]

    const mockEventSource = {
      [Symbol.asyncIterator]: async function* () {
        for (const event of mockResponses) {
          yield {data: JSON.stringify(event)}
        }
      },
      close: vi.fn(),
    }

    vi.mocked(createEventSource).mockReturnValue(mockEventSource as any)
    getRuntimeSpy.mockResolvedValue('1.0.0')
    getFilesInPromptFormatSpy.mockResolvedValue('<repo></repo>')

    const result = await studioCodeGenTool.handler({prompt, rootPath})
    expect(result).toHaveProperty('content')
    expect(result.content).toStrictEqual([
      {
        text: 'Generated code content',
        type: 'text',
      },
    ])
    expect(result).toHaveProperty('_meta')
    expect(result._meta).toStrictEqual({
      metadata: {
        metrics: {latencyMs: 10},
        usage: {
          cacheReadInputTokenCount: 0,
          cacheReadInputTokens: 0,
          cacheWriteInputTokenCount: 0,
          cacheWriteInputTokens: 0,
          inputTokens: 8,
          outputTokens: 65,
          serverToolUsage: {},
          totalTokens: 73,
        },
      },
      messageStart: {
        p: 'abcd',
        role: 'assistant',
      },
      messageStop: {
        stopReason: 'end_turn',
      },
      aiApiStop: {totalActionQuantityBips: 150, activeCreditGrants: []},
    })
  })

  // Note (sai): Add more tests to cover error cases and edge cases as needed
})
