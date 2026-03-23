import {jwtDecode} from 'jwt-decode'
import {logger} from './common/logger'
import {ws} from './factory/websocket-factory'

const isTokenExpired = (token: string, expiryOffsetInSecs: number = 30) => {
  try {
    const decodedToken = jwtDecode(token)
    const currentTime = Date.now() / 1000
    return decodedToken.exp
      ? decodedToken.exp < currentTime + expiryOffsetInSecs
      : false
  } catch (error) {
    logger.error(`Error decoding token: ${error}`)
    return true // Decoding failed, consider it expired
  }
}

const createAuthManager = () => {
  let tokenPromise: Promise<{token: string}> | null = null

  const getJWTPayload = async () => {
    const {token} = await getToken()
    return jwtDecode<{accountUuid: string; userUuid: string}>(token)
  }

  const getToken = async (forceRefresh?: boolean) => {
    let tokenExpired = false
    if (tokenPromise) {
      const {token} = await tokenPromise
      tokenExpired = isTokenExpired(token)
    }
    if (!tokenPromise || forceRefresh || tokenExpired) {
      tokenPromise = ws.send<{token: string}>({
        type: 'publish',
        action: 'getAiApiToken',
        sender: 'mcp8',
        channel: 'studio-use',
        parameters: {},
        timeoutMs: 5000,
      })

      logger.info('Fetched new Ai API token 🔒')
    }
    return tokenPromise
  }

  return {
    getToken,
    getJWTPayload,
  }
}

const auth = createAuthManager()

export {auth}
