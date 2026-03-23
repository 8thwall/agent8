import {randomUUID} from 'node:crypto'
import type {
  ConverseStreamCommandInput,
  ConverseStreamOutput,
  ToolConfiguration,
} from '@aws-sdk/client-bedrock-runtime'
import type {ChatBedrockConverseToolType} from '@langchain/aws'
import type {CallbackManagerForLLMRun} from '@langchain/core/callbacks/manager'
import type {
  BaseLanguageModelInput,
  StructuredOutputMethodOptions,
  ToolDefinition,
} from '@langchain/core/language_models/base'
import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
} from '@langchain/core/language_models/chat_models'
import {AIMessageChunk, type BaseMessage} from '@langchain/core/messages'
import {ChatGenerationChunk} from '@langchain/core/outputs'
import {
  type Runnable,
  RunnableLambda,
  RunnablePassthrough,
  RunnableSequence,
} from '@langchain/core/runnables'
import {toJsonSchema} from '@langchain/core/utils/json_schema'
import {
  getSchemaDescription,
  type InteropZodType,
  isInteropZodSchema,
} from '@langchain/core/utils/types'
import type WebSocket from 'ws'
import {logger} from '../../common/logger'
import {realtimeApiClient} from './client'
import {
  type BedrockConverseToolChoice,
  convertToBedrockToolChoice,
  convertToConverseMessages,
  convertToConverseTools,
  handleConverseStreamContentBlockDelta,
  handleConverseStreamContentBlockStart,
  handleConverseStreamMetadata,
  supportedToolChoiceValuesForModel,
} from './helpers'

interface ChatRealtimeModelInputs extends BaseChatModelParams {
  accountUuid: string
  userUuid: string
  modelId: string
  generationType: 'code' | 'scene'
  temperature?: number
  maxTokens?: number
  topP?: number
}

interface ChatRealtimeModelCallOptions extends BaseChatModelCallOptions {
  tools?: ChatBedrockConverseToolType[]
  tool_choice?: BedrockConverseToolChoice
  stop?: string[] // List of stop words to stop generation
}

type ConverseStreamWithIndex = ConverseStreamOutput & {rtIndex: number}
type RealtimeStop = {rtStop: Record<string, unknown>}
type RealtimeOutput = ConverseStreamWithIndex & RealtimeStop

// Note (sai): This class was created with inspiration from Bedrock's ChatBedrockConverse class.
// Realtime API currently wraps Bedrock's Converse API and hence the similarity in structure.
// https://github.com/langchain-ai/langchainjs/blob/caf5579b1a2ed8a708b01a140379be077b9b768c/libs/langchain-aws/src/chat_models.ts#L637
export class ChatRealtimeModel
  extends BaseChatModel<ChatRealtimeModelCallOptions>
  implements ChatRealtimeModelInputs
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return 'ChatRealtimeModel'
  }

  modelId: string
  accountUuid: string
  userUuid: string
  generationType: 'code' | 'scene'
  temperature?: number | undefined = undefined
  maxTokens?: number | undefined = undefined
  topP?: number
  supportsToolChoiceValues?: Array<'auto' | 'any' | 'tool'>
  sessionId: string

  // _llmType is an abstract method in BaseChatModel that needs to be implemented.
  // This is used to identify the type of LLM being used.
  _llmType(): string {
    return 'chat_realtime_model'
  }

  constructor(fields: ChatRealtimeModelInputs) {
    super(fields)
    this.modelId = fields.modelId
    this.accountUuid = fields.accountUuid
    this.userUuid = fields.userUuid
    this.generationType = fields.generationType
    this.temperature = fields.temperature
    this.maxTokens = fields.maxTokens
    this.topP = fields.topP
    this.sessionId = randomUUID()
    this.supportsToolChoiceValues = supportedToolChoiceValuesForModel(
      this.modelId,
    )
  }

  override bindTools(
    tools: ChatBedrockConverseToolType[],
    kwargs?: Partial<this['ParsedCallOptions']>,
  ): Runnable<
    BaseLanguageModelInput,
    AIMessageChunk,
    this['ParsedCallOptions']
  > {
    return this.withConfig({
      tools: convertToConverseTools(tools),
      ...kwargs,
    })
  }

  invocationParams(options?: this['ParsedCallOptions']) {
    let toolConfig: ToolConfiguration | undefined
    if (options?.tools && options.tools.length > 0) {
      const tools = convertToConverseTools(options.tools)
      toolConfig = {
        tools,
        toolChoice: options.tool_choice
          ? convertToBedrockToolChoice(options.tool_choice, tools, {
              model: this.modelId,
              supportsToolChoiceValues: this.supportsToolChoiceValues,
            })
          : undefined,
      }
    }
    return {
      inferenceConfig: {
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        topP: this.topP,
        stopSequences: options?.stop,
      },
      toolConfig,
    }
  }

  // Implementation for streaming responses using Realtime API
  async *_streamFromRealtimeApi(command: Partial<ConverseStreamCommandInput>) {
    const sessionId = randomUUID()
    const buffer: Record<number, ConverseStreamOutput> = {}
    let finished = false
    let nextIndex = 0
    let numChunks = 0

    const messageHandler = async (message: WebSocket.MessageEvent) => {
      const rawEvent = JSON.parse(message.data.toString()).event
      const chunk = JSON.parse(rawEvent) as RealtimeOutput
      if (chunk.rtStop) {
        finished = true
        await realtimeApiClient.unsubscribe(sessionId)
      } else {
        buffer[chunk.rtIndex] = chunk
        numChunks++
      }
    }

    await realtimeApiClient.subscribe(
      `mcp-stream/${this.accountUuid}/${this.userUuid}/${sessionId}`,
      sessionId,
      messageHandler,
    )

    await realtimeApiClient.publish<{
      generationType: 'code' | 'scene'
      request: ConverseStreamCommandInput
    }>(
      `mcp/${this.accountUuid}/${this.userUuid}/${sessionId}`,
      [
        {
          generationType: this.generationType,
          request: {
            ...command,
            modelId: this.modelId,
          },
        },
      ],
      sessionId,
    )

    // Keep yielding messages in order based on rtIndex
    while (!finished || numChunks > nextIndex) {
      if (nextIndex in buffer) {
        const msg = structuredClone(buffer[nextIndex])
        delete buffer[nextIndex] // Free memory
        nextIndex++
        yield msg
      } else {
        // Wait a bit for next index message to arrive
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
    }
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ) {
    const {converseMessages, converseSystem} =
      convertToConverseMessages(messages)
    const params = this.invocationParams(options)
    const stream = this._streamFromRealtimeApi({
      messages: converseMessages,
      system: converseSystem,
      ...params,
    })

    for await (const chunk of stream) {
      if (chunk.contentBlockStart) {
        yield handleConverseStreamContentBlockStart(chunk.contentBlockStart)
      } else if (chunk.contentBlockDelta) {
        const textChatGeneration = handleConverseStreamContentBlockDelta(
          chunk.contentBlockDelta,
        )
        yield textChatGeneration
        await runManager?.handleLLMNewToken(
          textChatGeneration.text,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            chunk: textChatGeneration,
          },
        )
      } else if (chunk.metadata) {
        yield handleConverseStreamMetadata(chunk.metadata, {streamUsage: true})
      } else {
        yield new ChatGenerationChunk({
          text: '',
          message: new AIMessageChunk({
            content: '',
            response_metadata: chunk,
          }),
        })
      }
    }
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun,
  ) {
    const stream = this._streamResponseChunks(messages, options, runManager)
    let finalResult: ChatGenerationChunk | undefined
    for await (const chunk of stream) {
      if (finalResult === undefined) {
        finalResult = chunk
      } else {
        finalResult = finalResult.concat(chunk)
      }
    }
    if (finalResult === undefined) {
      throw new Error(
        'Could not parse final output from Realtime streaming call',
      )
    }
    return {
      generations: [finalResult],
      llmOutput: finalResult.generationInfo,
    }
  }

  withStructuredOutput<
    // biome-ignore lint/suspicious/noExplicitAny: Leave any as is since we can't know the type
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // biome-ignore lint/suspicious/noExplicitAny: Leave any as is since we can't know the type
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<false>,
  ): Runnable<BaseLanguageModelInput, RunOutput>

  withStructuredOutput<
    // biome-ignore lint/suspicious/noExplicitAny: Leave any as is since we can't know the type
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // biome-ignore lint/suspicious/noExplicitAny: Leave any as is since we can't know the type
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<true>,
  ): Runnable<BaseLanguageModelInput, {raw: BaseMessage; parsed: RunOutput}>

  withStructuredOutput<
    // biome-ignore lint/suspicious/noExplicitAny: Leave any as is since we can't know the type
    RunOutput extends Record<string, any> = Record<string, any>,
  >(
    outputSchema:
      | InteropZodType<RunOutput>
      // biome-ignore lint/suspicious/noExplicitAny: Leave any as is since we can't know the type
      | Record<string, any>,
    config?: StructuredOutputMethodOptions<boolean>,
  ):
    | Runnable<BaseLanguageModelInput, RunOutput>
    | Runnable<
        BaseLanguageModelInput,
        {
          raw: BaseMessage
          parsed: RunOutput
        }
      > {
    // biome-ignore lint/suspicious/noExplicitAny: Leave any as is since we can't know the type
    const schema: InteropZodType<RunOutput> | Record<string, any> = outputSchema
    const name = config?.name
    const description =
      getSchemaDescription(schema) ?? 'A function available to call.'
    const method = config?.method
    const includeRaw = config?.includeRaw
    if (method === 'jsonMode') {
      throw new Error(`ChatRealtimeModel does not support 'jsonMode'.`)
    }

    let functionName = name ?? 'extract'
    let tools: ToolDefinition[]
    if (isInteropZodSchema(schema)) {
      tools = [
        {
          type: 'function',
          function: {
            name: functionName,
            description,
            parameters: toJsonSchema(schema),
          },
        },
      ]
    } else {
      if ('name' in schema) {
        functionName = schema.name
      }
      tools = [
        {
          type: 'function',
          function: {
            name: functionName,
            description,
            parameters: schema,
          },
        },
      ]
    }

    const supportsToolChoiceValues = this.supportsToolChoiceValues ?? []
    let toolChoiceObj: {tool_choice: string} | undefined
    if (supportsToolChoiceValues.includes('tool')) {
      toolChoiceObj = {
        tool_choice: tools[0].function.name,
      }
    } else if (supportsToolChoiceValues.includes('any')) {
      toolChoiceObj = {
        tool_choice: 'any',
      }
    }

    const llm = this.bindTools(tools, toolChoiceObj)
    const outputParser = RunnableLambda.from<AIMessageChunk, RunOutput>(
      (input: AIMessageChunk): RunOutput => {
        if (!input.tool_calls || input.tool_calls.length === 0) {
          throw new Error('No tool calls found in the response.')
        }
        const toolCall = input.tool_calls.find((tc) => tc.name === functionName)
        if (!toolCall) {
          throw new Error(`No tool call found with name ${functionName}.`)
        }
        return toolCall.args as RunOutput
      },
    )

    if (!includeRaw) {
      return llm.pipe(outputParser).withConfig({
        runName: 'StructuredOutput',
      }) as Runnable<BaseLanguageModelInput, RunOutput>
    }

    const parserAssign = RunnablePassthrough.assign({
      // biome-ignore lint/suspicious/noExplicitAny: Leave any as is since we can't know the type
      parsed: (input: any, config) => outputParser.invoke(input.raw, config),
    })
    const parserNone = RunnablePassthrough.assign({
      parsed: () => null,
    })
    const parsedWithFallback = parserAssign.withFallbacks({
      fallbacks: [parserNone],
    })
    return RunnableSequence.from<
      BaseLanguageModelInput,
      {raw: BaseMessage; parsed: RunOutput}
    >([
      {
        raw: llm,
      },
      parsedWithFallback,
    ]).withConfig({
      runName: 'StructuredOutputRunnable',
    })
  }
}
