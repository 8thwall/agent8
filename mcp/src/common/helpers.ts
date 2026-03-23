import type {BaseMessage} from '@langchain/core/messages'
import type {ZodSchema} from 'zod'
import zodToJsonSchema from 'zod-to-json-schema'
import type {ToolInput} from '../types'

const convertZodToJsonSchema = (schema: ZodSchema<any>) => {
  return zodToJsonSchema(schema) as ToolInput
}

const getAccumulatedTokenAndCreditData = (
  messages: BaseMessage[],
): Record<string, any> => {
  const aiApiStop = {
    refundType: undefined,
    refundAmountBips: 0,
    totalActionQuantityBips: 0,
    activeCreditGrants: [],
  }
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  }

  for (const message of messages) {
    if (
      !message.response_metadata ||
      Object.keys(message.response_metadata).length === 0 ||
      (!message.response_metadata.aiApiStop &&
        !message.response_metadata.metadata)
    )
      continue

    if (message.response_metadata.aiApiStop) {
      const stop = message.response_metadata.aiApiStop
      aiApiStop.refundAmountBips += stop.refundAmountBips ?? 0
      aiApiStop.totalActionQuantityBips += stop.totalActionQuantityBips ?? 0
      aiApiStop.activeCreditGrants = stop.activeCreditGrants
      // If any of the messages has partial refund, the overall refund type is partial
      // Therefore if we see refundType as 'partial', we don't update it anymore
      if (aiApiStop.refundType !== 'partial') {
        aiApiStop.refundType = stop.refundType
      }
    }

    if (message.response_metadata.metadata?.usage) {
      const msgUsage = message.response_metadata.metadata.usage
      usage.inputTokens += msgUsage.inputTokens ?? 0
      usage.outputTokens += msgUsage.outputTokens ?? 0
      usage.totalTokens += msgUsage.totalTokens ?? 0
    }
  }

  return {
    aiApiStop,
    metadata: {
      usage,
    },
  }
}

export {convertZodToJsonSchema, getAccumulatedTokenAndCreditData}
