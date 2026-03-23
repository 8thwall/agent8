import { WebSocket } from "ws"
import { responseSchema } from "./schema"
import { getAppKey } from "./app-key"
import { EventEmitter } from "events"

const DEFAULT_TIMEOUT_MS = 1000
const WEBSOCKET_SERVER_URI = "ws://localhost:62008"

type PendingActionRequest = {
	resolve: (value: any) => void
	reject: (reason?: any) => void
	timer: NodeJS.Timeout
}

type WebSocketMessageTypes = "subscribe" | "unsubscribe" | "publish" | "publishAll"

const createWebSocketManager = () => {
	let ws_: WebSocket | null = null
	let connectionPromise: Promise<WebSocket> | null = null
	const pendingRequests = new Map<string, PendingActionRequest>()
	const eventEmitter = new EventEmitter()

	const RETRY_DELAY_MS = 1000
	let tryConnectTimer: NodeJS.Timeout | null = null

	const ensureConnection = (onStateUpdate = () => {}) => {
		if (ws_ && ws_.readyState === WebSocket.OPEN) {
			return Promise.resolve(ws_)
		}

		if (connectionPromise) {
			return connectionPromise
		}

		connectionPromise = new Promise<WebSocket>((connectionResolve, connectionReject) => {
			const tryConnect = () => {
				if (tryConnectTimer) {
					clearTimeout(tryConnectTimer)
					tryConnectTimer = null
				}
				const ws = new WebSocket(WEBSOCKET_SERVER_URI)

				ws.onopen = () => {
					console.log("Established WebSocket connection")
					connectionPromise = null
					ws_ = ws
					onStateUpdate()

					if (tryConnectTimer) {
						clearTimeout(tryConnectTimer)
						tryConnectTimer = null
					}

					getAppKey().then(appKey => {
						if (!appKey) {
							throw new Error("App key is null")
						}

						WsManager.send({
							type: "subscribe",
							channel: `vscode/${appKey}`,
							onStateUpdate,
						}).catch(error => {
							console.log("Error subscribing to channel", error)
							connectionReject(error)
						})

						connectionResolve(ws)
					})
				}

				ws.onerror = (event) => {
					console.log("Error with WebSocket connection", event)
					onStateUpdate()
					if (!tryConnectTimer) {
						tryConnectTimer = setTimeout(() => {
							tryConnectTimer = null
							tryConnect()
						}, RETRY_DELAY_MS)
					}
				}

				ws.onmessage = (event) => {
					if (typeof event.data !== "string") {
						return
					}
					const eventData = JSON.parse(event.data)

					if (eventData.type === "subscribed") {
						connectionResolve(ws)
					}

					if (eventData.data?.action && !eventData.requestId) {
						eventEmitter.emit('action', eventData.data.action, eventData)
						eventEmitter.emit(`action:${eventData.data.action}`, eventData)
						return
					}

					const pendingRequest = pendingRequests.get(eventData.requestId)
					if (!pendingRequest) {
						// No-op if we can't find the requestId.
						return
					}

					const { resolve, reject, timer } = pendingRequest
					clearTimeout(timer)
					pendingRequests.delete(eventData.requestId)
					const messageResponse = responseSchema.safeParse(eventData)
					
					if (!messageResponse.success) {
						reject(messageResponse.error || new Error("Malformed message"))
						return
					}

					if (messageResponse.data.response.isError) {
						reject(messageResponse.data.response.error || new Error("Request unsuccessful"))
						return
					}

					resolve(messageResponse.data.response)
				}

				ws.onclose = () => {
					console.log("WebSocket connection closed")
					pendingRequests.forEach(({ reject, timer }) => {
						clearTimeout(timer)
						reject(new Error("WebSocket connection closed"))
					})
					pendingRequests.clear()
					ws_ = null
					onStateUpdate?.()

					if (!tryConnectTimer) {
						tryConnectTimer = setTimeout(() => {
							tryConnectTimer = null
							tryConnect()
						}, RETRY_DELAY_MS)
					}
				}
			}

			tryConnect()
		})

		return connectionPromise
	}

	const send = async <T = unknown>({
		type,
		action,
		sender,
		channel,
		parameters = {},
		timeoutMs = DEFAULT_TIMEOUT_MS,
		onStateUpdate = () => {}
	}: {
		type: WebSocketMessageTypes
		action?: string
		sender?: string
		channel: string
		parameters?: Record<string, any>
		timeoutMs?: number
		onStateUpdate: () => void
	}) =>  (
		new Promise<T>((resolve, reject) => {
			const requestId = crypto.randomUUID()
			const timer = setTimeout(() => {
				pendingRequests.delete(requestId)
				reject(new Error(`requestId ${requestId} timed out after ${timeoutMs}ms`))
			}, timeoutMs)
			pendingRequests.set(requestId, { resolve, reject, timer })
			ensureConnection(onStateUpdate).then(ws => {
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
			}).catch(error => {
				pendingRequests.delete(requestId)
				clearTimeout(timer)
				reject(error)
			})
		})
	)

	const getConnectedStatus = () => {
		return ws_ && ws_.readyState === WebSocket.OPEN
	}

	ensureConnection()

	return {
		send,
		getConnectedStatus,
		onAction: (action: string, callback: (data: any) => void) => {
			eventEmitter.on(`action:${action}`, callback)
		},
		offAction: (action: string, callback: (data: any) => void) => {
			eventEmitter.off(`action:${action}`, callback)
		},
		onAnyAction: (callback: (action: string, data: any) => void) => {
			eventEmitter.on('action', callback)
		}
	}
}

const WsManager = createWebSocketManager()

export { WsManager }
