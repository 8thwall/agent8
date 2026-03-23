import {getTrackContext, track} from 'opik'
import {ws} from '../../factory/websocket-factory'
import type {ComponentValidationResult} from './validator-types'

const validateComponents = track(
  {name: 'validateComponents', type: 'tool'},
  async (
    fileContents: {filePath: string; content: string}[],
  ): Promise<ComponentValidationResult[]> => {
    const context = getTrackContext()
    const result = ws.send<{filePath: string; errors: string[]}[]>({
      type: 'publish',
      action: 'validateComponents',
      sender: 'mcp8',
      channel: 'studio-use',
      parameters: {fileContents},
      timeoutMs: 5000,
    })

    if (context) {
      context.span.update({
        input: {fileContents},
        output: {result},
      })
    }
    return result
  },
)

export {validateComponents}
