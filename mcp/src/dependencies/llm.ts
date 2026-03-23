import {BedrockRuntimeClient} from '@aws-sdk/client-bedrock-runtime'
import {ChatBedrockConverse} from '@langchain/aws'
import {auth} from '../auth'
import {ChatAiModel} from './ai/model'
import {ChatRealtimeModel} from './realtime/model'

const getBedrockLLM = () => {
  const client = new BedrockRuntimeClient({region: 'us-west-2'})
  return new ChatBedrockConverse({
    model: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    region: 'us-west-2',
    client,
  })
}

const getRealtimeLlm = async (
  generationType?: 'code' | 'scene',
  modelId?: string,
) => {
  const {accountUuid, userUuid} = await auth.getJWTPayload()
  return new ChatRealtimeModel({
    accountUuid,
    userUuid,
    modelId: modelId || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    generationType: generationType || 'code',
  })
}

const getAiApiLlm = (generationType?: 'code' | 'scene', modelId?: string) => {
  return new ChatAiModel({
    modelId: modelId || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
    generationType: generationType || 'code',
  })
}

export {getBedrockLLM, getRealtimeLlm, getAiApiLlm}
