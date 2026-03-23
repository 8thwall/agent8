import {execSync} from 'node:child_process'
import * as fs from 'node:fs'
import {track} from 'opik'

import type {ValidationResult} from './validator-types'

const validateProjectBuild = track(
  {name: 'validateProjectBuild', type: 'tool'},
  async (projectRootPath: string): Promise<ValidationResult> => {
    const result: ValidationResult = {
      success: false,
      buildOutput: '',
      message: '',
    }

    //log('debug', `Validating project build: ${projectRootPath}`)

    try {
      if (!fs.existsSync(projectRootPath)) {
        throw new Error(`Project root not found: ${projectRootPath}`)
      }

      const originalCwd = process.cwd()
      process.chdir(projectRootPath)

      try {
        //log('info', 'Running: npx 8w-build')

        let buildResult: string
        try {
          buildResult = execSync('npx 8w-build', {
            stdio: 'pipe',
            encoding: 'utf8',
          })
        } catch (error: any) {
          const errorOutput = error.stdout || error.stderr || ''
          result.buildOutput = errorOutput
          throw new Error(
            `Build command failed: ${error.message}${errorOutput ? `\nBuild output: ${errorOutput}` : ''}`,
          )
        }

        result.buildOutput = buildResult
        result.success = true
        result.message = 'Build completed successfully'

        //log('info', 'SUCCESS: Build completed successfully')

        const lines = buildResult.split('\n').filter((line) => line.trim())
        const _lastLines = lines.slice(-3)
        //log('debug', `Build output preview:`, lastLines)

        return result
      } finally {
        process.chdir(originalCwd)
      }
    } catch (error: any) {
      result.message = `Build validation failed: ${error.message}`
      if (error.stdout) result.buildOutput = error.stdout

      //log('error', 'Build validation failed')
      if (error.stdout) {
        //log('error', `Build stdout: ${error.stdout}`)
      }
      if (error.stderr) {
        //log('error', `Build stderr: ${error.stderr}`)
      }
      return result
    }
  },
)

export {validateProjectBuild}
