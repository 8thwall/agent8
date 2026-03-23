import {createReactAgent} from '@langchain/langgraph/prebuilt'
import {getAiApiLlm} from '../../dependencies/llm'
import {getMetaTools} from './meta-tools'
import {getSystemPrompt} from './prompts'
import {getSceneTools} from './scene-tools'

const getSceneAgent = async (sceneReadonly: boolean) => {
  const llm = getAiApiLlm('scene')
  return createReactAgent({
    llm,
    tools: [...getMetaTools(sceneReadonly), ...getSceneTools(sceneReadonly)],
    prompt: getSystemPrompt(sceneReadonly),
  })
}

export {getSceneAgent}
