import {tool} from '@langchain/core/tools'
import type {z} from 'zod'
import {ws} from './websocket-factory'

const createToolFactory = () => {
  const create = <T extends z.AnyZodObject>(
    action: string,
    description: string,
    schema: T,
    handler?: (args: z.infer<T>) => any,
  ) => {
    const dynamicTool = tool(
      (parameters) => {
        // Let callers provide a handler if you need to run logic before sending the request.
        if (handler && typeof handler === 'function') {
          return handler(parameters)
        }
        return ws.send({
          type: 'publish',
          action,
          sender: 'mcp8',
          channel: 'studio-use',
          parameters,
          timeoutMs: 5000,
        })
      },
      {name: action, description, schema},
    )
    return dynamicTool
  }

  return {
    create,
  }
}

const Tool = createToolFactory()

export {Tool}
