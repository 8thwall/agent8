import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync, existsSync, unlinkSync, symlinkSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const WINDOWS_PLATFORMS = ["win-x64"]
const MAC_PLATFORMS = ["darwin-arm64", "darwin-x64"]
const NODE_PLATFORMS = ["node"]
const PLATFORMS = [
  ...WINDOWS_PLATFORMS,
  ...MAC_PLATFORMS,
  ...NODE_PLATFORMS
]
const TARGET_DIR = '../src/services/mcp/external'

const getFileName = (platform: typeof PLATFORMS[number]) => {
  if (WINDOWS_PLATFORMS.includes(platform)) {
    return `mcp8-${platform}-bin.exe`
  } else if (MAC_PLATFORMS.includes(platform)) {
    return `mcp8-${platform}-bin`
  } else if (NODE_PLATFORMS.includes(platform)) {
    return `8w-mcp.cjs`
  } else {
    throw new Error(`Unsupported platform: ${platform}`)
  }
}

try {
  const args = process.argv.slice(2)
  const debug = args.includes('--debug')
  const platforms = debug ? NODE_PLATFORMS : PLATFORMS
  const legacyMcpRepoPath = process.env.MCP_REPO_PATH || resolve(__dirname, '../../8w-mcp')
  const newMcpRepoPath = process.env.MCP_REPO_PATH || resolve(__dirname, '../../mcp8')

  if (!existsSync(newMcpRepoPath) && !existsSync(legacyMcpRepoPath)) {
    throw new Error(`MCP repository not found at: ${newMcpRepoPath} or ${legacyMcpRepoPath} ... Please ensure the mcp8 repository is cloned as a sibling of this repo, or that it's path is set in the MCP_REPO_PATH environment variable.`)
  }

  const mcpRepoPath = existsSync(newMcpRepoPath) ? newMcpRepoPath : legacyMcpRepoPath

  console.log('Building MCP executables...')

  const buildCmd = debug ? 'pnpm bundle' : 'pnpm sea'
  execSync(buildCmd, { 
    cwd: mcpRepoPath, 
    stdio: 'inherit'
  })

  console.log('MCP executables built successfully')

  mkdirSync(resolve(__dirname, TARGET_DIR), { recursive: true })

  platforms.forEach(platform => {
    const filename = getFileName(platform)
    const sourceFile = resolve(mcpRepoPath, `dist/${filename}`)
    const targetFile = resolve(__dirname, `${TARGET_DIR}/${filename}`)

    if (existsSync(targetFile)) {
      unlinkSync(targetFile)
    }

    symlinkSync(sourceFile, targetFile)

    console.log(`Symlink successful: ${sourceFile} -> ${targetFile}`)
  })

} catch (error: any) {
  console.error('ERROR: link-mcp (prebuild) failed:', error.message)
  process.exit(1)
}
