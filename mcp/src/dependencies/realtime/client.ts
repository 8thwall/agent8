import {randomUUID} from 'crypto'
import WebSocket from 'ws'
import {auth} from '../../auth'
import {REALTIME_HOST} from '../../common/constants'
import {logger} from '../../common/logger'
import type {
  PendingPromise,
  Subscription,
  SubscriptionPromise,
} from '../../types'

const getAuthProtocol = (authorization: {
  Authorization: string
  host: string
}) => {
  const header = btoa(JSON.stringify(authorization))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header-${header}`
}

// Realtime API uses AWS AppSync Real-time WebSocket protocol
// For more details refer: https://docs.aws.amazon.com/appsync/latest/eventapi/what-is-realtime-api.html
// and https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html
const createRealtimeApiClient = (ws_endpoint: string, host: string) => {
  let ws_: WebSocket | null = null
  let connectionPromise: Promise<WebSocket> | null = null
  let connectionTimeout: NodeJS.Timeout | null = null
  let connectionTimeoutMs = 300000 // Default connection timeout for AppSync is 5 minutes

  const subscriptionPromises = new Map<string, SubscriptionPromise>()
  const publishPromises = new Map<string, PendingPromise>()
  const unsubscribePromises = new Map<string, PendingPromise>()

  const closeConnection = () => {
    if (ws_ && ws_.readyState === WebSocket.OPEN) {
      ws_.close()
    }
    ws_ = null
    connectionPromise = null
    connectionTimeout && clearTimeout(connectionTimeout)
    subscriptionPromises.forEach((sub) => {
      !sub.active && sub.reject(new Error('Connection closed'))
    })
    publishPromises.forEach((pub) => {
      pub.reject(new Error('Connection closed'))
    })
    subscriptionPromises.clear()
    publishPromises.clear()
  }

  const ensureConnection = async () => {
    if (ws_ && ws_.readyState === WebSocket.OPEN) {
      return Promise.resolve(ws_)
    }

    if (connectionPromise) {
      return connectionPromise
    }

    const {token} = await auth.getToken()
    connectionPromise = new Promise<WebSocket>((resolve, reject) => {
      const socket = new WebSocket(ws_endpoint, [
        'aws-appsync-event-ws',
        getAuthProtocol({
          host: host,
          Authorization: `Bearer ${token}`,
        }),
      ])

      socket.onopen = () => {
        // Send connection_init message
        // This returns the connection ack from the server with the connectionTimeoutMs
        // For more details refer: https://docs.aws.amazon.com/appsync/latest/eventapi/event-api-websocket-protocol.html
        socket.send(JSON.stringify({type: 'connection_init'}))
        connectionPromise = null
        logger.info('Connection to Realtime API established 🚀')
      }

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data.toString())

        switch (message.type) {
          case 'connection_ack':
            logger.info('Connection to Realtime API acknowledged ✅')
            connectionTimeoutMs = message.connectionTimeoutMs
            ws_ = socket
            resolve(socket)
            break
          case 'subscribe_success': {
            const subscription = subscriptionPromises.get(message.id)
            if (subscription) {
              subscription.active = true
              logger.info(
                `Subscribed to channel ${subscription.channel} successfully ✅`,
              )
              subscription.resolve(subscription)
            }
            break
          }
          case 'subscribe_error': {
            const subscription = subscriptionPromises.get(message.id)
            if (subscription) {
              subscription.reject(
                new Error(
                  `Subscribe error for channel ${subscription.channel}: ${JSON.stringify(message.errors)}`,
                ),
              )
              subscriptionPromises.delete(message.id)
            }
            break
          }
          case 'unsubscribe_success': {
            const subscription = subscriptionPromises.get(message.id)
            const unsubscribePromise = unsubscribePromises.get(message.id)
            if (unsubscribePromise && subscription) {
              logger.info(
                `Unsubscribed to channel ${subscription.channel} successfully ✅`,
              )
              unsubscribePromise.resolve(undefined)
              subscriptionPromises.delete(message.id)
              unsubscribePromises.delete(message.id)
            }
            break
          }
          case 'unsubscribe_error': {
            const subscription = subscriptionPromises.get(message.id)
            const unsubscribePromise = unsubscribePromises.get(message.id)
            if (unsubscribePromise && subscription) {
              unsubscribePromise.reject(
                new Error(
                  `Unsubscribe error for channel ${subscription.channel}: ${JSON.stringify(message.errors)}`,
                ),
              )
              unsubscribePromises.delete(message.id)
            }
            break
          }
          case 'publish_success': {
            const promise = publishPromises.get(message.id)
            if (promise) {
              logger.info(`Published message to Realtime API successfully ✅`)
              promise.resolve(undefined)
              publishPromises.delete(message.id)
            }
            break
          }
          case 'publish_error': {
            const promise = publishPromises.get(message.id)
            if (promise) {
              promise.reject(
                new Error(`Publish error: ${JSON.stringify(message.errors)}`),
              )
              publishPromises.delete(message.id)
            }
            break
          }
          case 'data': {
            const subscription = subscriptionPromises.get(message.id)
            if (subscription?.active && subscription?.onMessage) {
              subscription.onMessage(event)
            }
            break
          }
          case 'ka':
            logger.debug('Received keep-alive from Realtime API 💓')
            break
          default:
            logger.info(
              `Received message of unknown type: ${event.data.toString()}`,
            )
        }

        // Reset the connection timeout on any message received
        connectionTimeout && clearTimeout(connectionTimeout)
        connectionTimeout = setTimeout(() => {
          logger.warn(
            'No activity from Realtime API, closing connection due to inactivity ⏳',
          )
          socket.close()
          closeConnection()
        }, connectionTimeoutMs)
      }

      socket.onerror = (event) => {
        logger.error(`Realtime API error: ${event}`)
        closeConnection()
        reject(new Error('Realtime API connection error'))
      }

      socket.onclose = () => {
        logger.info('Realtime API connection closed')
        closeConnection()
        reject(new Error('Realtime API connection closed'))
      }
    })

    return connectionPromise
  }

  const publish = async <Event>(
    channel: string,
    events: Event[],
    sessionId?: string,
  ) => {
    const ws = await ensureConnection()
    const {token} = await auth.getToken()
    return new Promise((resolve, reject) => {
      sessionId = sessionId ?? randomUUID().toString()
      publishPromises.set(sessionId, {resolve, reject})
      ws.send(
        JSON.stringify({
          id: sessionId,
          type: 'publish',
          channel,
          events: events.map((event) => JSON.stringify(event)),
          authorization: {
            host,
            Authorization: `Bearer ${token}`,
          },
        }),
      )
    })
  }

  const subscribe = async (
    channel: string,
    sessionId?: string,
    onMessage?: (data: WebSocket.MessageEvent) => void,
  ) => {
    const ws = await ensureConnection()
    const {token} = await auth.getToken()
    return new Promise<Subscription>((resolve, reject) => {
      sessionId = sessionId ?? randomUUID().toString()
      subscriptionPromises.set(sessionId, {
        resolve,
        reject,
        active: false, // Will be set to true on subscribe_success message
        uuid: sessionId,
        channel,
        onMessage,
      })
      ws.send(
        JSON.stringify({
          id: sessionId,
          type: 'subscribe',
          channel,
          authorization: {
            host,
            Authorization: `Bearer ${token}`,
          },
        }),
      )
    })
  }

  const unsubscribe = async (sessionId: string) => {
    if (!subscriptionPromises.has(sessionId)) {
      logger.warn(
        `Attempted to unsubscribe from non-existent subscription ${sessionId}`,
      )
      return
    }
    const ws = await ensureConnection()
    return new Promise((resolve, reject) => {
      unsubscribePromises.set(sessionId, {resolve, reject})
      ws.send(
        JSON.stringify({
          id: sessionId,
          type: 'unsubscribe',
        }),
      )
    })
  }

  return {publish, subscribe, unsubscribe}
}

const realtimeApiClient = createRealtimeApiClient(
  process.env.REALTIME_WS_URL ?? `wss://${REALTIME_HOST}/event/realtime`,
  REALTIME_HOST,
)

export {realtimeApiClient}
