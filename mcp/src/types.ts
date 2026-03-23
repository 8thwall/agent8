import {
  type CallToolResult,
  type Tool,
  ToolSchema,
} from '@modelcontextprotocol/sdk/types.js'
import type WebSocket from 'ws'
import type z from 'zod'

export interface File {
  path: string
  content: string
}

const ToolInputSchema = ToolSchema.shape.inputSchema
export type ToolInput = z.infer<typeof ToolInputSchema>

export interface ToolRegistration<T> extends Tool {
  handler: (args: T) => CallToolResult | Promise<CallToolResult>
  parseArgs: (args: unknown) => T
}

export interface PendingPromise<T = unknown> {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

export interface Subscription {
  uuid: string
  active: boolean
  channel: string
}

export type SubscriptionPromise = PendingPromise<Subscription> &
  Subscription & {
    onMessage?: (data: WebSocket.MessageEvent) => void
  }
