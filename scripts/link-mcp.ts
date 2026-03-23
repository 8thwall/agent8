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
  const mcpPath = process.env.MCP_REPO_PATH || resolve(__dirname, '../mcp')

  if (!existsSync(mcpPath)) {
    throw new Error(`MCP repository not found at: ${mcpPath}...`)
  }

  console.log('Building MCP executables...')

  const buildCmd = debug ? 'pnpm bundle' : 'pnpm sea'
  execSync(buildCmd, { 
    cwd: mcpPath, 
    stdio: 'inherit'
  })

  console.log('MCP executables built successfully')

  mkdirSync(resolve(__dirname, TARGET_DIR), { recursive: true })

  platforms.forEach(platform => {
    const filename = getFileName(platform)
    const sourceFile = resolve(mcpPath, `dist/${filename}`)
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
