import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

export const CheckpointWarning = () => {
	return (
		<div className="flex items-center p-3 my-3 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder rounded">
			<span className="codicon codicon-loading codicon-modifier-spin mr-2" />
			<span className="text-vscode-foreground">
				<Trans
					i18nKey="chat:checkpoint.initializingWarning"
					components={{
						forumLink: (
							<VSCodeLink // hidden8:checkpoints
								href="https://8th.io/agentforum"
								className="inline px-0.5"
							/>
						),
					}}
				/>
			</span>
		</div>
	)
}
