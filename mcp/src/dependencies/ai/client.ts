import type {ConverseStreamCommandInput} from '@aws-sdk/client-bedrock-runtime'
import {auth} from '../../auth'
import {AI_API_BASE_URL} from '../../common/constants'
import {createEventSource} from './es-client'

const numberReviver = (key: string, value: any) => {
  return typeof value === 'string' &&
    /^\d+$/.test(value) &&
    key.includes('Bips')
    ? Number(value)
    : value
}

const createAiApiClient = (baseUrl: string) => {
  const stream = async function* (
    generationType: 'code' | 'scene',
    command: ConverseStreamCommandInput & {runtimeVersionTarget?: string},
  ) {
    const {token} = await auth.getToken()

    const es = createEventSource({
      url: `${baseUrl}/v1/stream/${generationType}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(command),
    })

    try {
      for await (const {data, event} of es) {
        // Note (sai): Although the credit data on the DB is stored as bigint, we convert it to number
        // to save work effort on downstream agent8 usage where all cost related values are represented as numbers.
        // IMPACT: Instead of being able to represent the richest country's GDP as Bips,
        // we can now represent the richest person's net worth as a single activeCreditBips (which should be fine) :P
        const parsedData = JSON.parse(data, numberReviver)
        if (event === 'error') {
          throw new Error(parsedData.message)
        }
        yield parsedData
      }
    } finally {
      es.close()
    }
  }

  return {stream}
}

const aiApi = createAiApiClient(AI_API_BASE_URL)

export {aiApi}
