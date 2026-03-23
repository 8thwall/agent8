import {track} from 'opik'
import z from 'zod'
import {convertZodToJsonSchema} from '../../common/helpers'
import type {ToolRegistration} from '../../types'
import {formatChunks, getChunksFromApi} from './helpers'

const fetchDocumentation = async (search: string) => {
  const chunks = await getChunksFromApi(search)
  const formattedChunks = formatChunks(chunks)

  return {
    content: formattedChunks,
  }
}

const docsToolSchema = z.object({
  search: z
    .string()
    .min(1)
    .describe('The search query to fetch documentation chunks for'),
})

const docsTool: ToolRegistration<z.infer<typeof docsToolSchema>> = {
  name: 'studioDocs',
  title: 'Get 8th Wall Studio Documentation',
  description: `Fetches documentation chunks from 8th Wall Studio based on the provided search query. The chunks are combined into a single formatted text block.
    Use this tool to retrieve information about 8th Wall Studio features, APIs, examples, and more.`,
  inputSchema: convertZodToJsonSchema(docsToolSchema),
  handler: async (args) => {
    const {search} = args
    const result = await fetchDocumentation(search)

    track({name: 'studioDocs', type: 'tool'}, () => ({
      responseContent: result.content,
    }))()

    return {
      content: [{type: 'text', text: result.content}],
    }
  },
  parseArgs: (args) => docsToolSchema.parse(args),
}

export default docsTool
