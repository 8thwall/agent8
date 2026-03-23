import * as fs from 'node:fs'
import * as path from 'node:path'
import {track} from 'opik'
import {logger} from '../../common/logger'
import type {File} from '../../types'

const listFilesInDir = (directoryPaths: string[]): string[] => {
  const fileList: string[] = []
  const scanDirectory = (directory: string) => {
    try {
      const files = fs.readdirSync(directory)

      for (const file of files) {
        const filePath = path.join(directory, file)
        const stat = fs.statSync(filePath)

        if (stat.isDirectory()) {
          scanDirectory(filePath) // Recursively call for subdirectories
        } else {
          fileList.push(filePath)
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${directory}:`, err)
    }
  }

  for (const dirPath of directoryPaths) {
    scanDirectory(dirPath)
  }

  return fileList
}

const readFiles = async (filePaths: string[]): Promise<File[]> => {
  const fileContents: File[] = []

  for (const path of filePaths) {
    try {
      let content = ''
      // Only read .ts, .js, .json and .md files
      if (
        path.endsWith('.ts') ||
        path.endsWith('.js') ||
        path.endsWith('.json') ||
        path.endsWith('.md')
      ) {
        content = await fs.promises.readFile(path, 'utf-8')
      }
      fileContents.push({path, content})
    } catch (error) {
      console.error(`Error reading file ${path}:`, error)
    }
  }

  return fileContents
}

const getFilesInPromptFormat = async (rootPath: string): Promise<string> => {
  const filePaths = await listFilesInDir([`${rootPath}/src`]) // Only read files within the `src` directory
  const fileContents = await readFiles(filePaths)

  track({name: 'getFilesInPromptFormat', type: 'general'}, () => ({
    rootPath: rootPath,
    listFilesInDirResponse: filePaths,
    readFilesResponse: fileContents,
    totalFilesFound: filePaths.length,
  }))()

  let prompt = `<repo>${rootPath}\n`
  for (const file of fileContents) {
    prompt += `<file>${file.path}\n${file.content}\n</file>\n`
  }
  prompt += `</repo>`
  return prompt
}

const getRuntimeVersion = async (rootPath: string): Promise<string> => {
  const expanseJsonPath = path.join(rootPath, 'src/expanse.json')
  try {
    const content = await fs.promises.readFile(expanseJsonPath, 'utf-8')
    const json = JSON.parse(content)
    const runtimeVersion = json.runtimeVersion
    const major = runtimeVersion.major || 1
    const minor = runtimeVersion.minor || 0
    const patch = runtimeVersion.patch || 0
    return `${major}.${minor}.${patch}`
  } catch (error) {
    logger.error(`Error reading ${expanseJsonPath}: ${error}`)
    logger.info('Defaulting to runtime version 1.0.0')
    return '1.0.0'
  }
}

export {listFilesInDir, readFiles, getFilesInPromptFormat, getRuntimeVersion}
