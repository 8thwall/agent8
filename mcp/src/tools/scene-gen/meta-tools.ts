import {z} from 'zod'
import {Tool} from '../../factory/tool-factory'
import {getSceneTools} from './scene-tools'

const getToolNames = (sceneReadonly: boolean) => {
  const tools = getSceneTools(sceneReadonly)
  return tools.map((tool) => tool.name) as [string, ...string[]] // enforce non-empty array
}

const getRequestSchema = (sceneReadonly: boolean) =>
  z.object({
    action: z.enum(getToolNames(sceneReadonly)),
    parameters: z.record(z.string(), z.any()),
  })

// TODO(kyle): Adding descriptions to parameters will improve our LLM's understanding.
const createMetaTools = (sceneReadonly: boolean) => [
  Tool.create(
    'batch',
    `Execute multiple requests in a single batch to avoid timeouts and improve performance.${sceneReadonly ? '' : ' This is especially useful for creating or manipulating many objects at once.'}

  CRITICAL: Do NOT batch requests that depend on results from other requests. Each request in a batch executes independently and cannot access results from other requests in the same batch.

  Use batch tool ONLY for:
  - Multiple independent, sequential operations that don't need each other's results
  - Operations on existing objects with known IDs
  - Performance optimization of unrelated requests

  The function returns an array of responses, one for each request.`,
    z.object({requests: z.array(getRequestSchema(sceneReadonly))}),
  ),
]

const META_TOOLS = createMetaTools(false)
const READONLY_META_TOOLS = createMetaTools(true)

const getMetaTools = (sceneReadonly: boolean) =>
  sceneReadonly ? READONLY_META_TOOLS : META_TOOLS

export {getMetaTools}
