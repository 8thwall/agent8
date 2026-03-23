import {Server} from '@modelcontextprotocol/sdk/server/index.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import {flushAll, getTrackContext, track} from 'opik'
import {auth} from './auth'
import {logger} from './common/logger'
import {setupOpikRedirect} from './common/opik-redirect'

// Tools
import codeGenTool from './tools/code-gen/handler'
import docsTool from './tools/docs/handler'
import sceneGenTool from './tools/scene-gen/handler'
import {
  validateComponentTool,
  validateProjectBuildTool,
} from './tools/validator/handler'
import type {ToolRegistration} from './types'

const server = new Server(
  {
    name: '8w-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

// Tools to be registered.
// biome-ignore lint/suspicious/noExplicitAny: < Having `any` type is ok as we will parse each tool's arguments using `parseArgs` func.>
const tools: ToolRegistration<any>[] = [
  codeGenTool,
  sceneGenTool,
  validateComponentTool,
  validateProjectBuildTool,
  docsTool,
]

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({handler, parseArgs, ...tool}) => tool),
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const {name, arguments: args} = request.params

  // Create a tracked function for the MCP request
  const {accountUuid, userUuid} = await auth.getJWTPayload()
  const handleMcpRequest = track(
    {name: 'MCP: handleMcpRequest', type: 'llm'},
    // biome-ignore lint/suspicious/noExplicitAny: <any type is ok>
    (toolName: string, toolArgs: any) => {
      const context = getTrackContext()
      if (context?.trace) {
        context.trace.update({
          threadId: args?.threadId as string,
          metadata: {
            accountUuid,
            userUuid,
            toolName,
            requestUuid: args?.requestUuid as string,
          },
          input: toolArgs,
        })
      }
      const tool = tools.find((t) => t.name === toolName)

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`)
      }

      const parsedArgs = tool.parseArgs(toolArgs)
      return tool.handler(parsedArgs)
    },
  )

  try {
    return await handleMcpRequest(name, args)
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  } finally {
    await flushAll()
  }
})

setupOpikRedirect()

const transport = new StdioServerTransport()
server.connect(transport)
logger.info('MCP server started and listening for requests... 🚀')
