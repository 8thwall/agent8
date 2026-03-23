import {beforeEach, describe, expect, it, vi} from 'vitest'
import {auth} from '../../../src/auth'
import {createEventSource} from '../../../src/dependencies/ai/es-client'
import {createMockFetchWithSse} from '../../mock-fetch'

describe('createEventSource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(auth, 'getToken').mockResolvedValue({token: 'test-token'})
  })

  it('should stream data from the provided URL', async () => {
    const mockFetch = createMockFetchWithSse([
      {data: {message: 'chunk1'}, event: 'message'},
      {data: {message: 'chunk2'}, event: 'message'},
      {data: {message: 'done'}, event: 'end'},
    ])
    const es = createEventSource({
      url: 'https://example.com/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-token`,
      },
      body: JSON.stringify({input: 'test'}),
      fetch: mockFetch,
    })

    const receivedData = []
    for await (const {data, event} of es) {
      receivedData.push({data: JSON.parse(data), event})
      if (event === 'end') {
        es.close()
      }
    }
    expect(receivedData).toEqual([
      {data: {message: 'chunk1'}, event: 'message'},
      {data: {message: 'chunk2'}, event: 'message'},
      {data: {message: 'done'}, event: 'end'},
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should raise an emit error event on non-2xx HTTP response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      body: null,
      redirected: false,
      url: 'https://example.com/stream',
    })
    const es = createEventSource({
      url: 'https://example.com/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-token`,
      },
      body: JSON.stringify({input: 'test'}),
      fetch: mockFetch,
    })

    const receivedEvents = []
    for await (const {data, event} of es) {
      receivedEvents.push({data: JSON.parse(data), event})
      if (event === 'error') {
        es.close()
      }
    }
    expect(receivedEvents).toEqual([
      {
        event: 'error',
        data: {
          message: 'Stream error: 500 - Internal Server Error',
        },
      },
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should raise an emit error event when there are any exceptions within fetch call', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Invalid URL'))
    const es = createEventSource({
      url: 'https://dummy-url.com/stream',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-token`,
      },
      body: JSON.stringify({input: 'test'}),
      fetch: mockFetch,
    })

    const receivedEvents = []
    for await (const {data, event} of es) {
      receivedEvents.push({data: JSON.parse(data), event})
      if (event === 'error') {
        es.close()
      }
    }
    expect(receivedEvents).toEqual([
      {
        event: 'error',
        data: {
          message: 'Failed to connect to stream',
        },
      },
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
