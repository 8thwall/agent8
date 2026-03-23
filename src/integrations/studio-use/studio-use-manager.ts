import type { ClineProvider } from "../../core/webview/ClineProvider"
import { StudioUsePayload } from "../../shared/WebviewMessage"
import { auth } from "./auth"
import * as vscode from "vscode"
import { WsManager } from "./websocket-manager-factory"
import { getAppKey } from "./app-key"
import { exec, execSync } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

const is8thWallRunning = async (): Promise<boolean> => {
    try {
        const isWindows = process.platform === 'win32'
        
        if (isWindows) {
            const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq *8thwall*" /FO CSV`)
            return stdout.includes('8thwall') || stdout.includes('8th wall')
        } else {
            const { stdout } = await execAsync(`pgrep -x "8th Wall"`)
            return stdout.trim().length > 0
        }
    } catch (error) {
        return false
    }
}

const is8thWallInstalled = async (): Promise<boolean> => {
    try {
        const isWindows = process.platform === 'win32'
        
        if (isWindows) {
            const programFileCheck = execSync('if exist "%PROGRAMFILES%\\8th Wall\\8th Wall.exe" echo found').toString()
            if (programFileCheck.includes('found')) {
                return true
            }
            const appDataCheck = execSync('if exist "%LOCALAPPDATA%\\Programs\\8th Wall\\8th Wall.exe" echo found').toString()
            if (appDataCheck.includes('found')) {
                return true
            }
            return false
        } else {
            const { stderr } = await execAsync('open -Ra "8th Wall"', { timeout: 5000 })
            return !stderr.includes('does not exist')
        }
    } catch (error) {
        return false
    }
}

export class StudioUseManager {
	private providerRef: WeakRef<ClineProvider>
    private accountData: { workspace: string, givenName: string, familyName: string, email: string } | null = null

    constructor(clineProvider: ClineProvider) {
		this.providerRef = new WeakRef(clineProvider)
        this.init()
    }

    private updateWebview = () => this.providerRef?.deref()?.postStateToWebview()

    private handleAuthRefresh = async () => {
        const response = await auth.getToken({forceRefresh: true, onStateUpdate: this.updateWebview})
        const {accountName, givenName, familyName, email} = await auth.getJWTPayload()
        this.accountData = { workspace: accountName, givenName, familyName, email }
        this.updateWebview()
        return response
    }

    public async init() {
        WsManager.onAction('projectStart', this.handleAuthRefresh)
    }

    public async sendWebsocketMessage(studioUsePayload: StudioUsePayload) {
        try {
            let response: Awaited<ReturnType<typeof WsManager.send>>
            switch(studioUsePayload.action) {
                case 'requestAiApiToken':
                    response = await this.handleAuthRefresh()
                    break
                default:
                    throw new Error(`Unknown action: ${studioUsePayload.action}`)
            }

            return response
        } catch (error) {
            console.log(`Error sending websocket message: ${error}`)
            throw error
        }
    }

    public async openStudioApp() {
        const [isRunning, appKey] = await Promise.all([
            is8thWallRunning(),
            getAppKey()
        ])
        
        const path = `/studio/${appKey}`
        const url = `com.the8thwall.desktop://${path}`

        if(!isRunning)
        {
            vscode.env.openExternal(vscode.Uri.parse(url))
            await new Promise(resolve => setTimeout(resolve, 1000))
        }

        vscode.env.openExternal(vscode.Uri.parse(url))
    }

    public getAccountData() {
        return this.accountData
    }

    public async getIs8thWallInstalled() {
        return is8thWallInstalled()
    }

    async dispose(): Promise<void> {
        WsManager.offAction('projectStart', this.handleAuthRefresh)
        
        const appKey = await getAppKey()
        WsManager.send({
            type: 'unsubscribe',
            channel: `vscode/${appKey}`,
            onStateUpdate: this.updateWebview,
        })
    }
}

export type { StudioUsePayload }
