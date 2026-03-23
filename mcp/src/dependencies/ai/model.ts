import type {ToolConfiguration} from '@aws-sdk/client-bedrock-runtime'
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
import {aiApi} from './client'
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

interface ChatAiModelInputs extends BaseChatModelParams {
  modelId: string
  generationType: 'code' | 'scene'
  temperature?: number
  maxTokens?: number
  topP?: number
}

interface ChatAiModelCallOptions extends BaseChatModelCallOptions {
  tools?: ChatBedrockConverseToolType[]
  tool_choice?: BedrockConverseToolChoice
  stop?: string[] // List of stop words to stop generation
  runtimeVersionTarget?: string // Optional 8thwall runtime version target
}

// Note (sai): This class was created with inspiration from Bedrock's ChatBedrockConverse class.
// Realtime API currently wraps Bedrock's Converse API and hence the similarity in structure.
// https://github.com/langchain-ai/langchainjs/blob/caf5579b1a2ed8a708b01a140379be077b9b768c/libs/langchain-aws/src/chat_models.ts#L637
export class ChatAiModel
  extends BaseChatModel<ChatAiModelCallOptions>
  implements ChatAiModelInputs
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return 'ChatAiModel'
  }

  modelId: string
  generationType: 'code' | 'scene'
  temperature?: number | undefined = undefined
  maxTokens?: number | undefined = undefined
  topP?: number
  supportsToolChoiceValues?: Array<'auto' | 'any' | 'tool'>

  // _llmType is an abstract method in BaseChatModel that needs to be implemented.
  // This is used to identify the type of LLM being used.
  _llmType(): string {
    return 'chat_realtime_model'
  }

  constructor(fields: ChatAiModelInputs) {
    super(fields)
    this.modelId = fields.modelId
    this.generationType = fields.generationType
    this.temperature = fields.temperature
    this.maxTokens = fields.maxTokens
    this.topP = fields.topP
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
      runtimeVersionTarget: options?.runtimeVersionTarget ?? '1.0.0',
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
    const stream = aiApi.stream(this.generationType, {
      modelId: this.modelId,
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
