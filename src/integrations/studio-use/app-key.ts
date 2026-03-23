
import * as vscode from "vscode"
import path from "path"
import fs from "fs/promises"
import { fileExistsAtPath } from "../../utils/fs"

const getAppKey = async (): Promise<string | null> => {
    try {
        let workspacePath = ''
        const folders = vscode.workspace.workspaceFolders
        if (folders && folders.length > 0) {
            workspacePath = folders[0].uri.fsPath
        }

        if (!workspacePath) {
            return null
        }
        
        const indexPath = path.join(workspacePath, '.gen', 'index.html')

        const fileExists = await fileExistsAtPath(indexPath)
        if (!fileExists) {
            return null
        }

        const htmlContent = await fs.readFile(indexPath, 'utf8')

        const appKeyMatch = htmlContent.match(/appKey=([^&"']+)/)

        if (appKeyMatch && appKeyMatch[1]) {
            return appKeyMatch[1]
        }

        return null
    } catch (error) {
        console.error(`Failed to read app key from index.html: ${error}`)
        return null
    }
}

export { getAppKey }