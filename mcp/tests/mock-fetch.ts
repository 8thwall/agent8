import {ReadableStream} from 'node:stream/web'
import {vi} from 'vitest'

const createMockReadableStream = (chunks: string[]) => {
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(new TextEncoder().encode(chunks[index]))
      index++
    },
  })
}

interface MockFetchOptions {
  status?: number
  ok?: boolean
  chunks?: string[]
}

const createMockFetch = (options: MockFetchOptions = {}) => {
  const {
    status = 200,
    ok = true,
    chunks = ['{"message": "test chunk"}'],
  } = options

  return vi.fn().mockResolvedValue({
    ok,
    status,
    body: ok ? createMockReadableStream(chunks) : null,
    headers: new Headers(),
    statusText: ok ? 'OK' : 'Internal Server Error',
    url: 'http://test.example.com',
    redirected: false,
  })
}

const createMockFetchWithSse = (
  events: Array<{data: object; event?: string}>,
) => {
  const chunks = events.map((e) => {
    const eventLine = e.event ? `event: ${e.event}\n` : ''
    return `${eventLine}data: ${JSON.stringify(e.data)}\n\n`
  })
  return createMockFetch({chunks})
}

// Helper function to create mock fetch with error response
const createMockFetchWithError = (status = 500) => {
  return createMockFetch({status, ok: false, chunks: []})
}

export {createMockFetch, createMockFetchWithSse, createMockFetchWithError}
