import { useExtensionState } from "@/context/ExtensionStateContext"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"

export const BottomReasoningToggle = () => {
  const { t } = useAppTranslation()
  const { apiConfiguration, currentApiConfigName } = useExtensionState()
	const enableReasoningEffort = apiConfiguration?.enableReasoningEffort

	const handleToggleReasoning = () => {
		const newApiConfig = {
			...apiConfiguration,
			enableReasoningEffort: !enableReasoningEffort,
		}
		vscode.postMessage({ type: "upsertApiConfiguration", text: currentApiConfigName, apiConfiguration: newApiConfig })
	}

  return (
    <div className="flex flex-row gap-1 cursor-pointer items-center" onClick={handleToggleReasoning}>
      <VSCodeCheckbox
        checked={enableReasoningEffort}
      />
      <span
        style={{
          color: "var(--vscode-foreground)",
          flexShrink: 0,
          userSelect: "none",
        }}>
        {t("common:footer.reasoning")}
      </span>
    </div>
  )
}
