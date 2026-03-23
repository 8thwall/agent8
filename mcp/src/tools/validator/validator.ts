import WebSocket from 'ws'
import {logger} from '../../common/logger'

const MAX_BUILD_MESSAGES = 50

interface BuildStatus {
  success: boolean
  buildOutput: string
}

interface BuildMessage {
  type: string
  message: string
}

const createValidator = () => {
  // TODO(chloe): Store web sockets and build messages by appKey.
  let ws: WebSocket | null = null
  const buildMessages: BuildMessage[] = []

  const updateBuildWebSocketUrl = (webSocketUrl: string) => {
    // Close existing connection if any
    if (ws && ws.url !== webSocketUrl) {
      ws.close()
      ws = null
    }

    const url = new URL(webSocketUrl)
    const host = `${url.hostname}:${url.port}`
    const origin = `${url.protocol}//${host}`
    ws = new WebSocket(webSocketUrl, {
      headers: {Host: host, Origin: origin},
    })

    ws.onerror = (error) => {
      logger.error(`Validator WebSocket error: ${error.message}`)
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data.toString())
      const isNewResult = message.type === 'ok' || message.type === 'errors'
      const isValidMessage = isNewResult || message.type === 'warnings'

      if (!isValidMessage) {
        return
      }

      if (isNewResult) {
        buildMessages.length = 0
      }

      if (message.data) {
        message.data.forEach((o) => {
          buildMessages.push({type: message.type, message: o.message})
        })
      } else {
        buildMessages.push({type: message.type, message: ''})
      }

      if (buildMessages.length > MAX_BUILD_MESSAGES) {
        buildMessages.splice(0, buildMessages.length - MAX_BUILD_MESSAGES)
      }
    }

    // TODO(chloe): Expose the validateProjectBuild tool once the connection is established.
  }

  const validateBuild = (): BuildStatus => {
    const buildResult: BuildStatus = {
      success: false,
      buildOutput: '',
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      buildResult.buildOutput =
        'WebSocket connection is not established. Please ensure the build process is running.'
      return buildResult
    }

    if (buildMessages.length === 0) {
      buildResult.buildOutput = 'No build messages received.'
      return buildResult
    }

    return {
      success: !buildMessages.some((msg) => msg.type === 'errors'),
      buildOutput: buildMessages
        .map((msg) => `[${msg.type.toUpperCase()}] ${msg.message}`)
        .join('\n'),
    }
  }

  return {
    validateBuild,
    updateBuildWebSocketUrl,
  }
}

const validator = createValidator()

export {validator}
