import { jwtDecode } from 'jwt-decode'
import { WsManager } from './websocket-manager-factory'
import { getAppKey } from './app-key'

const isTokenExpired = (token: string, expiryOffsetInSecs: number = 30) => {
  try {
    const decodedToken = jwtDecode(token)
    const currentTime = Date.now() / 1000
    return decodedToken.exp
      ? decodedToken.exp < currentTime + expiryOffsetInSecs
      : false
  } catch (error) {
    console.error(`Error decoding token: ${error}`)
    return true 
  }
}

const createAuthManager = () => {
  let tokenPromise: Promise<{token: string}> | null = null
  let authenticatedStatus: "authenticated" | "unauthenticated" | "authenticating" = "unauthenticated"

  const getJWTPayload = async () => {
    const tokenResult = await getToken()
    if (!tokenResult) {
      throw new Error('Token is null')
    }
    const {token} = tokenResult
    return jwtDecode(token) as {
      accountUuid: string; 
      userUuid: string, 
      familyName: string,
      givenName: string,
      accountName: string,
      shortName: string,
      email: string
    }
  }

  const getToken = async ({forceRefresh = false, onStateUpdate = () => {}, timeoutMs = 5000} = {}) => {
    let tokenExpired = false
    authenticatedStatus = "authenticating"
    onStateUpdate()

    const checkToken = async () => {
      if (!tokenPromise) {
        return
      }
      
      try {
        const {token} = await tokenPromise
        tokenExpired = isTokenExpired(token)
        authenticatedStatus = tokenExpired ? "unauthenticated" : "authenticated"
      } catch (error) {
        tokenPromise = null
        authenticatedStatus = "unauthenticated"
      } finally {
        onStateUpdate()
      }
    }

    checkToken()
    const appKey = await getAppKey()

    if (!tokenPromise || forceRefresh || tokenExpired) {
      try {
        tokenPromise = WsManager.send({
          type: 'publish',
          action: 'getAiApiToken',
          sender: `vscode/${appKey}`,
          channel: `studio-use`,
          parameters: {},
          timeoutMs,
          onStateUpdate,
      })
        authenticatedStatus = "authenticating"
        onStateUpdate()
        await tokenPromise
      } catch (error) {
        authenticatedStatus = "unauthenticated"
        onStateUpdate()
        return Promise.reject(error)
      }

      checkToken()
    }
    return tokenPromise
  }

  const isAuthenticated = () => {
    return authenticatedStatus
  }
  
  return {
    getToken,
    getJWTPayload,
    isAuthenticated,
  }
}

const auth = createAuthManager()

export { auth }
