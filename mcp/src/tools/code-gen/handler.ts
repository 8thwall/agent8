import {HumanMessage} from '@langchain/core/messages'
import {getTrackContext, track} from 'opik'
import z from 'zod'
import {convertZodToJsonSchema} from '../../common/helpers'
import {getAiApiLlm} from '../../dependencies/llm'
import type {ToolRegistration} from '../../types'
import {getFilesInPromptFormat, getRuntimeVersion} from './helpers'

const generateCode = async (prompt: string, rootPath: string) => {
  const runtimeVersionTarget = await getRuntimeVersion(rootPath)
  const filesFormattedPrompt = await getFilesInPromptFormat(rootPath)
  const human = new HumanMessage(
    `${filesFormattedPrompt}\n\nHuman: ${prompt}\nAssistant:\n`,
  )
  const llm = getAiApiLlm()
  const response = await llm.invoke([human], {
    runtimeVersionTarget,
  })

  return {
    content: response.content,
    usage_metadata: response.usage_metadata,
    _meta: response.response_metadata,
  }
}

const codeGenInputSchema = z.object({
  prompt: z.string().describe('The prompt to generate code'),
  rootPath: z
    .string()
    .describe(
      'The absolute root path of the project. This will only be used for readonly purposes and will not perform any writes.',
    ),
})

const codeGenToolDesc = `Generates 8thWall Studio component code based on the prompt provided. Use this tool to create (or) edit one component at a time. 
This tool only generates code but does not save the contents into a file. You will need to save the contents yourself. 
**Important Note**: DO NOT create components that are responsible for creating entities/objects unless you need the entities to be spawned at runtime. Instead use the \`sceneAgent\` tool which can create the objects/entities such that they are visible in the Scene Viewport on 8th Wall Studio platform for the user to interact with before runtime.`

const studioCodeGenTool: ToolRegistration<z.infer<typeof codeGenInputSchema>> =
  {
    name: 'studioCodeGenerator',
    title: 'Generate 8thWall Studio Component Code',
    description: codeGenToolDesc,
    inputSchema: convertZodToJsonSchema(codeGenInputSchema),
    handler: async (args) => {
      const {prompt, rootPath} = args
      const result = await generateCode(prompt, rootPath)

      track({name: 'studioCodeGenerator', type: 'tool'}, () => {
        const context = getTrackContext()
        const usage = result.usage_metadata
        if (usage) {
          context?.span?.update({
            usage: {
              prompt_tokens: usage.input_tokens,
              completion_tokens: usage.output_tokens,
              total_tokens: usage.total_tokens,
            },
          })
        }

        return {
          prompt: prompt,
          responseContent: result.content.toString(),
        }
      })()

      return {
        content: [{type: 'text', text: result.content.toString()}],
        _meta: result._meta,
      }
    },
    parseArgs: (args) => codeGenInputSchema.parse(args),
  }

export default studioCodeGenTool
