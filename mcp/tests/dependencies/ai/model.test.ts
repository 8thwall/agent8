import {beforeEach, describe, expect, it, vi} from 'vitest'
import z from 'zod'
import {auth} from '../../../src/auth'
import {ChatAiModel} from '../../../src/dependencies/ai/model'
import {Tool} from '../../../src/factory/tool-factory'

vi.mock('../../../src/dependencies/ai/es-client')

import {createEventSource} from '../../../src/dependencies/ai/es-client'
import {createMockFetchWithError} from '../../mock-fetch'

describe('ChatAiModel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(auth, 'getToken').mockResolvedValue({token: 'test-token'})
  })

  it('Can fetch tokens and convert them to langchain format', async () => {
    const mockResponses = [
      {messageStart: {p: 'abcd', role: 'assistant'}},
      {contentBlockDelta: {contentBlockIndex: 0, delta: {text: 'I'}}},
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {text: "'m designed to help you generate custom E"},
        },
      },
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {text: 'CS components for the @8thwall/ecs library base'},
        },
      },
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {text: 'd on your requirements.'},
        },
      },
      {
        contentBlockStop: {
          contentBlockIndex: 0,
          p: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0',
        },
      },
      {messageStop: {stopReason: 'end_turn'}},
      {
        metadata: {
          metrics: {latencyMs: 7279},
          usage: {
            cacheReadInputTokenCount: 0,
            cacheReadInputTokens: 0,
            cacheWriteInputTokenCount: 52113,
            cacheWriteInputTokens: 52113,
            inputTokens: 8,
            outputTokens: 65,
            serverToolUsage: {},
            totalTokens: 52272,
          },
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

    const llm = new ChatAiModel({
      modelId: 'test-model',
      generationType: 'code',
    })
    const response = await llm.invoke('What are you designed to do?')

    expect(response).toBeDefined()
    expect(response.content).toBe(
      "I'm designed to help you generate custom ECS components for the @8thwall/ecs library based on your requirements.",
    )
    expect(response.usage_metadata).toBeDefined()
    expect(response.usage_metadata?.input_tokens).toBe(8)
    expect(response.usage_metadata?.output_tokens).toBe(65)
    expect(response.usage_metadata?.total_tokens).toBe(52272)
  })

  it('Response includes aiApiStop and metadata within response_metadata', async () => {
    const mockResponses = [
      {messageStart: {p: 'abcd', role: 'assistant'}},
      {
        contentBlockDelta: {
          contentBlockIndex: 0,
          delta: {text: 'Test message'},
        },
      },
      {messageStop: {stopReason: 'end_turn'}},
      {
        metadata: {
          metrics: {latencyMs: 7279},
          usage: {
            cacheReadInputTokenCount: 0,
            cacheReadInputTokens: 0,
            cacheWriteInputTokenCount: 52113,
            cacheWriteInputTokens: 52113,
            inputTokens: 8,
            outputTokens: 65,
            serverToolUsage: {},
            totalTokens: 52272,
          },
        },
      },
      {
        aiApiStop: {
          totalActionQuantityBips: '25',
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

    const llm = new ChatAiModel({
      modelId: 'test-model',
      generationType: 'code',
    })
    const response = await llm.invoke('What are you designed to do?')

    expect(response).toBeDefined()
    expect(response.response_metadata).toBeDefined()
    expect(response.response_metadata.aiApiStop).toBeDefined()
    expect(response.response_metadata.aiApiStop?.totalActionQuantityBips).toBe(
      25,
    )
    expect(response.response_metadata.metadata.metrics).toBeDefined()
    expect(response.response_metadata.metadata.metrics.latencyMs).toBe(7279)
    expect(response.response_metadata.metadata.usage).toBeDefined()
    expect(response.response_metadata.metadata.usage.inputTokens).toBe(8)
    expect(response.response_metadata.metadata.usage.outputTokens).toBe(65)
    expect(response.response_metadata.metadata.usage.totalTokens).toBe(52272)
  })

  it('throws error on failed HTTP response', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(createMockFetchWithError(500))
    const mockEventSource = {
      [Symbol.asyncIterator]: async function* () {
        yield* [
          {
            event: 'error',
            data: JSON.stringify({
              message: 'Stream error: 500 - Internal Server Error',
            }),
          },
        ]
      },
      close: vi.fn(),
    }
    vi.mocked(createEventSource).mockReturnValue(mockEventSource as any)

    const llm = new ChatAiModel({
      modelId: 'test-model',
      generationType: 'code',
    })

    await expect(async () => {
      await llm.invoke('What are you designed to do?')
    }).rejects.toThrowError('Stream error: 500 - Internal Server Error')
  })

  it('should call the code endpoint when generationType is code', async () => {
    const mockEventSource = {
      [Symbol.asyncIterator]: async function* () {
        yield {data: JSON.stringify({type: 'test'})}
      },
      close: vi.fn(),
    }

    vi.mocked(createEventSource).mockReturnValue(mockEventSource as any)

    const llm = new ChatAiModel({
      modelId: 'test-model',
      generationType: 'code',
    })

    const response = await llm.invoke('Example code generation')

    expect(response).toBeDefined()
    expect(createEventSource).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/v1/stream/code'),
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: expect.stringContaining('Bearer '),
        }),
        body: expect.any(String),
      }),
    )
  })

  it('should call the scene endpoint when generationType is scene', async () => {
    const mockEventSource = {
      [Symbol.asyncIterator]: async function* () {
        yield {data: JSON.stringify({type: 'test'})}
      },
      close: vi.fn(),
    }

    vi.mocked(createEventSource).mockReturnValue(mockEventSource as any)

    const llm = new ChatAiModel({
      modelId: 'test-model',
      generationType: 'scene',
    })

    const response = await llm.invoke('Example scene generation')

    expect(response).toBeDefined()
    expect(createEventSource).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/v1/stream/scene'),
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: expect.stringContaining('Bearer '),
        }),
        body: expect.any(String),
      }),
    )
  })

  it('should include runtimeVersionTarget, inference, and tool configurations in the request when provided', async () => {
    const mockEventSource = {
      [Symbol.asyncIterator]: async function* () {
        yield {data: JSON.stringify({type: 'test'})}
      },
      close: vi.fn(),
    }

    vi.mocked(createEventSource).mockReturnValue(mockEventSource as any)

    const llm = new ChatAiModel({
      modelId: 'test-model',
      generationType: 'code',
      maxTokens: 150,
      temperature: 0.7,
      topP: 0.9,
    })

    const tool = Tool.create(
      'exampleTool',
      'This is an example tool description',
      z.object({}),
    )

    const response = await llm.invoke('Use the tool to get data', {
      tools: [tool],
    })

    const requestData = {
      modelId: 'test-model',
      messages: [
        {
          role: 'user',
          content: [
            {
              text: 'Use the tool to get data',
            },
          ],
        },
      ],
      system: [],
      inferenceConfig: {
        maxTokens: 150,
        temperature: 0.7,
        topP: 0.9,
      },
      toolConfig: {
        tools: [
          {
            toolSpec: {
              name: 'exampleTool',
              description: 'This is an example tool description',
              inputSchema: {
                json: {
                  type: 'object',
                  properties: {},
                  additionalProperties: false,
                  $schema: 'http://json-schema.org/draft-07/schema#',
                },
              },
            },
          },
        ],
      },
      runtimeVersionTarget: '1.0.0',
    }
    expect(response).toBeDefined()
    expect(createEventSource).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/v1/stream/code'),
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: expect.stringContaining('Bearer '),
        }),
        body: JSON.stringify(requestData),
      }),
    )
  })

  it('should include runtimeVersionTarget configurations in the request when provided', async () => {
    const mockEventSource = {
      [Symbol.asyncIterator]: async function* () {
        yield {data: JSON.stringify({type: 'test'})}
      },
      close: vi.fn(),
    }

    vi.mocked(createEventSource).mockReturnValue(mockEventSource as any)

    const llm = new ChatAiModel({
      modelId: 'test-model',
      generationType: 'code',
    })

    const response = await llm.invoke('Hello', {
      runtimeVersionTarget: '2.0.0',
    })

    const requestData = {
      modelId: 'test-model',
      messages: [
        {
          role: 'user',
          content: [
            {
              text: 'Hello',
            },
          ],
        },
      ],
      system: [],
      inferenceConfig: {},
      runtimeVersionTarget: '2.0.0',
    }
    expect(response).toBeDefined()
    expect(createEventSource).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/v1/stream/code'),
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: expect.stringContaining('Bearer '),
        }),
        body: JSON.stringify(requestData),
      }),
    )
  })
})
