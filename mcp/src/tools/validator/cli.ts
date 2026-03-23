#!/usr/bin/env npx tsx

import {validateProjectBuild} from './validate-build'
import {validateComponents} from './validate-component'

interface ParsedArgs {
  flags: {
    help: boolean
  }
  positional: string[]
}

function printUsage() {
  console.log(`
Usage: cli [options] <project-root-path> [component-filepath]

Options:
  -h, --help     Show this help message

Arguments:
  project-root-path      Path to the project root directory
  component-filepath     (Optional) Path to component file for ECS validation

Examples:
  cli /path/to/project                    # Build validation
  cli /path/to/project src/component.ts   # ECS component validation only. No build validation.
`)
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2)
  const flags = {
    help: false,
  }
  const positional: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '-h' || arg === '--help') {
      flags.help = true
    } else if (!arg.startsWith('-')) {
      positional.push(arg)
    } else {
      console.warn(`Unknown option: ${arg}`)
      process.exit(1)
    }
  }

  return {flags, positional}
}

async function main() {
  const {flags, positional} = parseArgs()

  if (flags.help) {
    printUsage()
    process.exit(0)
  }

  if (positional.length < 1 || positional.length > 2) {
    console.error(
      'Please provide a project root path and optionally a component filepath',
    )
    console.error('Usage: cli <project-root-path> [component-filepath]')
    process.exit(1)
  }

  const [projectRootPath, componentFilepath] = positional

  const result = componentFilepath
    ? await validateComponents(projectRootPath, componentFilepath)
    : await validateProjectBuild(projectRootPath)

  console.log(`${result.message}: ${result.buildOutput}`)
  process.exit(result.success ? 0 : 1)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: any) => {
    console.error(error.message)
    process.exit(1)
  })
}
