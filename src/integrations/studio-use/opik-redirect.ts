import {auth} from './auth'
import {AI_API_BASE_URL} from './constants'

const nativeFetch = global.fetch
const OPIK_URLS = [
  'http://localhost:5173/api/v1/private/spans',
  'http://localhost:5173/api/v1/private/traces',
]

/**
 * Redirects Opik observability data through genai backend before sending to Opik cloud.
 * This allows us to manage Opik credentials on the backend without exposing them on the client.
 */
const setupOpikRedirect = (): void => {
  global.fetch = new Proxy(nativeFetch, {
    apply: async (target, thisArg, argumentsList) => {
      const [input, init] = argumentsList as [RequestInfo | URL, RequestInit?]
      const url = input.toString()

      const isOpikRequest =
        OPIK_URLS.some((opikUrl) => url.includes(opikUrl)) && init?.body

      if (isOpikRequest) {
        const endpoint = extractEndpointFromUrl(url)
        return sendTraces(init.body as string, endpoint)
      }

      return Reflect.apply(target, thisArg, argumentsList)
    },
  })
}

const extractEndpointFromUrl = (url: string): string => {
  const urlObj = new URL(url)
  const pathname = urlObj.pathname
  return `https://www.comet.com/opik${pathname}`
}

const sendTraces = async (
  opikBody: string,
  endpoint: string,
): Promise<Response> => {
  const {token} = await auth.getToken()
  const traceData = JSON.parse(opikBody)

  return nativeFetch(`${AI_API_BASE_URL}/v1/sync/flush-trace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      endpoint,
      traceData,
    }),
  })
}

export {setupOpikRedirect}
