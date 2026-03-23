import { aiApiClient } from "../../api/providers/ai-api-client"
import { ClineProvider } from "../../core/webview/ClineProvider"
import { CreditGrant, CreditsData } from "../../shared/ExtensionMessage"

const CREDIT_POLLING_INTERVAL_MS = 1000 * 30

export class CreditsManager {
  private providerRef: WeakRef<ClineProvider>
  private pollInterval: NodeJS.Timeout | null = null
  private latestCreditsData: CreditsData | null = null
  
  constructor(clineProvider: ClineProvider) {
    this.providerRef = new WeakRef(clineProvider)
    this.init()
  }

  private updateWebview = () => this.providerRef?.deref()?.postStateToWebview()

  private async fetchCreditsData() {
    try {
      this.latestCreditsData = await aiApiClient.get("/v1/sync/credits/grants", CREDIT_POLLING_INTERVAL_MS)
      this.updateWebview()
    } catch (error) {
      console.error("Error fetching user credits:", error)
    }
  }

  public init() {
    this.fetchCreditsData()
    this.pollInterval = setInterval(() => this.fetchCreditsData(), CREDIT_POLLING_INTERVAL_MS)
  }

  public getCreditsData() {
    return this.latestCreditsData
  }

  public updateCreditsGrants(data: CreditGrant[]) {
    this.latestCreditsData = { ...this.latestCreditsData, activeCreditGrants: data }
    this.updateWebview()
  }

  public dispose() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }
}
