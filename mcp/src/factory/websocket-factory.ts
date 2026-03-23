// No need to import z anymore

import {randomUUID} from 'crypto'
import WebSocket from 'ws'
import {logger} from '../common/logger'
import {responseSchema} from '../schema/common'
import {validator} from '../tools/validator/validator'

const DEFAULT_TIMEOUT_MS = 1000
const WEBSOCKET_SERVER_URI = 'ws://localhost:62008'

type PendingActionRequest = {
  resolve: (value: any) => void
  reject: (reason?: any) => void
  timer: ReturnType<typeof setTimeout>
}

const createWebSocketManager = () => {
  let ws_: WebSocket | null = null
  let connectionPromise: Promise<WebSocket> | null = null
  const pendingRequests = new Map<string, PendingActionRequest>()

  const ensureConnection = () => {
    if (ws_ && ws_.readyState === WebSocket.OPEN) {
      return Promise.resolve(ws_)
    }

    if (connectionPromise) {
      return connectionPromise
    }

    connectionPromise = new Promise<WebSocket>(
      (connectionResolve, connectionReject) => {
        // NOTE(dat): You might get the error `WebSocket is not defined`.
        // Make sure you run `npm run start:debug` with node version 22.
        const ws = new WebSocket(WEBSOCKET_SERVER_URI)

        ws.onopen = () => {
          connectionPromise = null
          ws_ = ws
          try {
            ws.send(
              JSON.stringify({
                type: 'subscribe',
                channel: 'mcp8',
              }),
            )
          } catch (error) {
            logger.error(`Failed to subscribe to channel 'mcp8': ${error}`)
          }
        }

        ws.onerror = (event) => {
          logger.error(`Error with WebSocket connection: ${event}`)
          connectionReject(new Error('Error with WebSocket connection'))
          // An error may occur before establishing a successful connection.
          connectionPromise = null
        }

        ws.onmessage = async (event) => {
          // We should only ever expect JSON.
          if (typeof event.data !== 'string') {
            return
          }
          const {type} = JSON.parse(event.data)
          // By doing this you are not able to fire off publish messages without a subscription.
          if (type === 'subscribed') {
            connectionResolve(ws)
            logger.info('Established WebSocket connection')
          }
          logger.info(`Received message data: ${event.data}`)
          const eventData = JSON.parse(event.data)
          if (eventData.data?.localWebSocketUrl) {
            validator.updateBuildWebSocketUrl(eventData.data.localWebSocketUrl)
          }
          const pendingRequest = pendingRequests.get(eventData.requestId)
          if (!pendingRequest) {
            // No-op if we can't find the requestId.
            return
          }

          const {resolve, reject, timer} = pendingRequest
          clearTimeout(timer)
          pendingRequests.delete(eventData.requestId)
          const messageResponse = responseSchema.safeParse(eventData)
          if (!messageResponse.success) {
            reject(messageResponse.error || new Error('Malformed message'))
            return
          }

          if (messageResponse.data.isError) {
            reject(
              messageResponse.data.error || new Error('Request unsuccessful'),
            )
            return
          }

          resolve(messageResponse.data.response)
        }

        ws.onclose = () => {
          logger.info('WebSocket connection closed')
          pendingRequests.forEach(({reject, timer}) => {
            clearTimeout(timer)
            reject(new Error('WebSocket connection closed'))
          })
          pendingRequests.clear()
          ws_ = null
        }
      },
    )

    return connectionPromise
  }
  const send = async <T = unknown>({
    type,
    action,
    sender,
    channel,
    parameters,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: {
    type: string
    action?: string
    sender?: string
    channel: string
    parameters?: Record<string, any>
    timeoutMs?: number
  }) => {
    const ws = await ensureConnection()
    return new Promise<T>((resolve, reject) => {
      const requestId = randomUUID()
      const timer = setTimeout(() => {
        pendingRequests.delete(requestId)
        reject(
          new Error(`requestId ${requestId} timed out after ${timeoutMs}ms`),
        )
      }, timeoutMs)
      pendingRequests.set(requestId, {resolve, reject, timer})

      ws.send(
        JSON.stringify({
          type,
          requestId,
          sender,
          channel,
          action,
          parameters,
        }),
      )
    })
  }

  return {send}
}

const ws = createWebSocketManager()

export {ws}
