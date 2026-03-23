const REALTIME_HOST =
  process.env.NODE_ENV === 'development'
    ? 'rt.qa.8thwall.com'
    : 'rt.8thwall.com'

// TODO(Harika): Update dev knowledge base URL to agent-qa URL instead of harika-agent URL
// TODO(Harika): Add prod knowledge base URL
const AI_API_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? 'https://ai.qa.8thwall.com'
    : 'https://ai.8thwall.com'

export {AI_API_BASE_URL, REALTIME_HOST}
