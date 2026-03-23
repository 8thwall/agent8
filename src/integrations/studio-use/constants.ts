import { Package } from "../../shared/package"

const DEBUG_MODE = process.env.VSCODE_DEBUG_MODE ?? Package.version?.endsWith("qa")

const AI_API_BASE_URL =
  DEBUG_MODE
    ? 'https://ai.qa.8thwall.com'
    : 'https://ai.8thwall.com'

export {DEBUG_MODE, AI_API_BASE_URL}
