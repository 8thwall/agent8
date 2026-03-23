import { HTMLAttributes } from "react"

import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"

type SettingsFooterProps = HTMLAttributes<HTMLDivElement> & {
	version: string
}

export const SettingsFooter = ({ version, className, ...props }: SettingsFooterProps) => (
	<div className={cn("text-vscode-descriptionForeground p-5", className)} {...props}>
		<p style={{ wordWrap: "break-word", margin: 0, padding: 0 }}>
			If you have any questions or feedback, feel free to create a topic at{" "}
			<VSCodeLink href="https://8th.io/agentforum" style={{ display: "inline" }}>
				8th.io/agentforum
			</VSCodeLink>{" "}
			or join{" "}
			<VSCodeLink href="https://8th.io/discord" style={{ display: "inline" }}>
				8th.io/discord
			</VSCodeLink>
			.
		</p>
		<p style={{ wordWrap: "break-word", margin: 0, padding: 0 }}>
			Regarding financial questions, please contact Customer Service at{" "}
			<VSCodeLink href="mail:support@8thwall.com" style={{ display: "inline" }}>
				support@8thwall.com
			</VSCodeLink>{" "}
		</p>
		<p className="italic">8th Wall Agent v{version}</p>
		<div className="flex justify-between items-center gap-3">
			<p>Reset all global state and secret storage in the extension.</p>
			<VSCodeButton
				onClick={() => vscode.postMessage({ type: "resetState" })}
				appearance="secondary"
				className="shrink-0">
				<span className="codicon codicon-warning text-vscode-errorForeground mr-1" />
				Reset
			</VSCodeButton>
		</div>
	</div>
)
