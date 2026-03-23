import {auth} from '../../auth'
import {AI_API_BASE_URL} from '../../common/constants'

interface Chunk {
  content?: {
    text?: string
    type?: string
  }
}

/**
 * Fetch documentation chunks from Bedrock Knowledge Base via genai backend.
 */
const getChunksFromApi = async (
  topic: string,
  baseUrl = AI_API_BASE_URL,
): Promise<string[]> => {
  const {token} = await auth.getToken()

  const url = new URL(`${baseUrl}/v1/sync/docs`)
  url.searchParams.set('q', topic)

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch documentation for topic "${topic}": ${response.status} ${response.statusText}`,
    )
  }

  const data: {chunks?: Chunk[]} = await response.json()
  const chunks: Chunk[] = data.chunks || []

  return chunks.flatMap((chunk) =>
    chunk.content?.text ? [chunk.content.text] : [],
  )
}

const formatChunks = (chunks: string[], maxChunks: number = 5): string => {
  const limitedChunks = chunks.slice(0, maxChunks)
  return limitedChunks
    .map((chunk, index) => `## Documentation Chunk ${index + 1}\n\n${chunk}`)
    .join('\n\n---\n\n')
}

export {getChunksFromApi, formatChunks}
