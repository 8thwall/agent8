import { HTMLAttributes, useEffect, useMemo } from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Trans } from "react-i18next"
import { Info, TriangleAlert, TriangleAlertIcon } from "lucide-react"

import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { Package } from "@roo/package"
import { TelemetrySetting } from "@roo/TelemetrySetting"

import { vscode } from "@/utils/vscode"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui"

import { SectionHeader } from "@/components/settings/SectionHeader"
import { Section } from "@/components/settings/Section"
import { useExtensionState } from "@/context/ExtensionStateContext"
import Logo from "./Logo"

type AgentEightSettingsProps = HTMLAttributes<HTMLDivElement> & {
	telemetrySetting: TelemetrySetting
	setTelemetrySetting: (setting: TelemetrySetting) => void
}

const getProjectName = (workspacePath: string) => {
	const parts = workspacePath.split(/[/\\]/)
	return parts[parts.length - 1] || workspacePath
}

export const AgentEightSettings = ({ telemetrySetting, setTelemetrySetting, className, ...props }: AgentEightSettingsProps) => {
	const { t } = useAppTranslation()
	const { 
		websocketConnected, enableCheckpoints, authenticatedStatus, workspacePath, projectAppKey, accountData, is8thWallInstalled
	} = useExtensionState()

	const validProject = workspacePath && projectAppKey
	const workspaceName = accountData?.workspace || "..."

	const displayName = useMemo(() => {
		if (accountData?.givenName || accountData?.familyName)
			return `${accountData?.givenName} ${accountData?.familyName}`
		else if ((accountData?.email))
			return accountData?.email
		return "..."
	}, [accountData?.givenName, accountData?.familyName, accountData?.email])

	const refreshConnectionButton = (
		<Button 
			variant="secondary"
			onClick={async () => 
				vscode.postMessage({ 
					type: "websocketMessageEvent", 
					studioUsePayload: { 
						action: 'requestAiApiToken',
						webviewId: 'agent-eight-auth',
					}
				})} 
			className="w-fit"
			disabled={authenticatedStatus === "authenticating"}
		>
			{t("settings:connectionStatus.refreshConnection")}
		</Button>
	)

	const openProjectButton = (
		<Button 
			variant="secondary"
			onClick={async () => 
				vscode.postMessage({ 
					type: "openStudioApp",
				})} 
			className="w-fit"
		>
			{t("settings:connectionStatus.openProject", {
				projectName: getProjectName(workspacePath ?? "")
			})}
		</Button>
	)
	
	const getConnectionState = () => {
		if (!websocketConnected) {
			return {
				statusText: t("settings:connectionStatus.disconnected"),
				button: openProjectButton,
				color: "red" as const,
			}
		}

		switch (authenticatedStatus) {
			case "authenticated":
				return {
					statusText: t("settings:connectionStatus.connected"),
					button: refreshConnectionButton,
					color: "green" as const,
				}
			case "unauthenticated":
				return {
					statusText: t("settings:connectionStatus.disconnected"),
					button: openProjectButton,
					color: "red" as const,
				}
			case "authenticating":
				return {
					statusText: t("settings:connectionStatus.authenticating"),
					button: refreshConnectionButton,
					color: "orange" as const,
				}
			default:
				return {
					statusText: t("settings:connectionStatus.disconnected"),
					button: openProjectButton,
					color: "red" as const,
				}
		}
	}

	const { statusText: connectionStatusText, button: connectionButton, color: connectionColor } = getConnectionState()


	useEffect(() => {
        vscode.postMessage({ 
            type: "websocketMessageEvent", 
            studioUsePayload: { 
                action: 'requestAiApiToken',
                webviewId: 'agent-eight-auth',
            }
		})
    }, [])
	
	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader
				description={
					Package.sha
						? `Version: ${Package.version} (${Package.sha.slice(0, 8)})`
						: `Version: ${Package.version}`
				}>
				<div className="flex items-center gap-2">
					<Info className="w-4 min-w-4" />
					<div>{t("settings:sections.about")}</div>
				</div>
			</SectionHeader>
			{!is8thWallInstalled &&
				<Section>
					<div className="flex items-center gap-2 text-amber-400">
						<TriangleAlertIcon className="w-4 min-w-4 stroke-amber-400" />
						{t("settings:install.noInstall")}
					</div>
					<Button 
						variant="secondary"
						onClick={async () => 
							vscode.postMessage({ 
								type: "openExternal",
								url: 'https://www.8thwall.com/download'
							})} 
						className="w-fit"
					>
						<Logo width={4} height={4} />
						{t("settings:install.button")}
					</Button>
				</Section>
			}
			{!validProject && is8thWallInstalled &&
				<div>
					<Section>
						<div className="flex items-center gap-2 text-amber-400">
							<TriangleAlertIcon className="w-4 min-w-4 stroke-amber-400" />
							{t("settings:connectionStatus.noValidProject")}
						</div>
						<Button 
							variant="secondary"
							onClick={async () => 
								vscode.postMessage({ 
									type: "openFolder",
								})} 
							className="w-28"
						>
							{t("settings:connectionStatus.openFolder")}
						</Button>
					</Section>
					<Section>
						<div>
							{t("settings:connectionStatus.currentWorkspacePath", {
								workspacePath
							})}
						</div>
					</Section>
				</div>
			}
			{validProject && is8thWallInstalled && 
				<div>
					<Section>
						<div className="flex items-center gap-2">
							<span
								className="inline-block w-2 h-2 min-w-2 rounded-full"
								style={{ backgroundColor: connectionColor }}
							/>
							<span style={{ color: connectionColor}}>
								{connectionStatusText}
							</span>
						</div>
						{connectionButton}
						<button
							onClick={async () => 
								vscode.postMessage({ 
									type: "openFolder",
								})}
							className="text-xs text-gray-400 hover:text-blue-300 underline cursor-pointer bg-transparent border-none p-0 self-start"
						>
							Switch project folder
						</button>
					</Section>
					<Section>
						<div>
							{t("settings:accountInfo.workspace", {workspaceName})}
						</div>
						<div>
							{t("settings:accountInfo.account", {accountName: displayName})}
						</div>
						<div>
							{t("settings:accountInfo.project", {projectName: getProjectName(workspacePath)})}
						</div>
					</Section>
				</div>
			}

			{!enableCheckpoints && <Section>
				<div className="flex items-center gap-2 text-amber-400">
					<TriangleAlertIcon className="w-4 min-w-4 stroke-amber-400" />
					<div>
						<Trans
							i18nKey="common:errors.git_not_installed"
							components={{
								download: <VSCodeLink href="https://git-scm.com/downloads" />,
							}}
						/>
					</div>
				</div>
			</Section>}

			<Section>
				<div>
					<Trans
						i18nKey="settings:footer.feedback"
						components={{
							forumLink: <VSCodeLink href="https://8th.io/agentforum" />,
							discordLink: <VSCodeLink href="https://8th.io/discord" />,
							docsLink: <VSCodeLink href="https://8th.io/agentdocs" />,
						}}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2 mt-2">
					<Button
						variant="destructive"
						onClick={() => vscode.postMessage({ type: "resetState" })}
						className="w-28">
						<TriangleAlert className="p-0.5" />
						{t("settings:footer.settings.reset")}
					</Button>
				</div>
			</Section>
		</div>
	)
}
