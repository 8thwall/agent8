import {HumanMessage} from '@langchain/core/messages'
import {track} from 'opik'
import z from 'zod'
import {
  convertZodToJsonSchema,
  getAccumulatedTokenAndCreditData,
} from '../../common/helpers'
import type {ToolRegistration} from '../../types'
import {getSceneAgent} from './agent'

const processScenePrompt = async (prompt: string, sceneReadonly: boolean) => {
  const sceneAgent = await getSceneAgent(sceneReadonly)
  const {messages} = await sceneAgent.invoke(
    {messages: [new HumanMessage(prompt)]},
    {recursionLimit: 100},
  )
  const accumulatedInfo = getAccumulatedTokenAndCreditData(messages)
  const conclusion = messages.length
    ? messages[messages.length - 1]
    : {type: 'ai', text: 'No response from Scene Agent.'}
  return {
    content: conclusion.text,
    _meta: accumulatedInfo,
  }
}

const sceneAgentSchema = z.object({
  prompt: z
    .string()
    .describe(
      'The prompt to interact with the 8th Wall Studio scene. When requesting to create/modify entities, you may optionally also indicate the type of each entity for precise manipulation.',
    ),
})

const enhancedSceneAgentSchema = sceneAgentSchema.extend({
  sceneReadonly: z
    .boolean()
    .optional()
    .describe(
      'If true, the agent will only read the scene and not make any modifications. Defaults to false.',
    ),
})

const sceneAgentTool: ToolRegistration<
  z.infer<typeof enhancedSceneAgentSchema>
> = {
  name: 'sceneAgent',
  title: 'Scene Agent',
  description: `Manipulates and/or reads an 8thWall Studio scene based on the prompt provided. Use this tool to edit or query a scene by describing the changes you need.

  8th Wall Studio supports the following entity types:
  Special - Empty Object (useful for adding components and doesn't necessarily need a visual representation)
  Primitive - Plane, Box, Sphere, Cylinder, Capsule, Cone, Circle, Polyhedron, Ring, Torus
  UI - Frame, Text, Button, Image
  Lights - Ambient, Directional, Spot, Point, Area`,
  inputSchema: convertZodToJsonSchema(sceneAgentSchema),
  handler: async (args) => {
    const {prompt, sceneReadonly} = args
    const result = await processScenePrompt(prompt, sceneReadonly ?? false)

    track({name: 'processScenePrompt', type: 'tool'}, () => ({
      prompt: prompt,
      responseContent: result.content,
      sceneReadonly: sceneReadonly,
    }))()

    return {
      content: [{type: 'text', text: result.content}],
      _meta: result._meta,
    }
  },
  parseArgs: (args) => enhancedSceneAgentSchema.parse(args),
}

export default sceneAgentTool
