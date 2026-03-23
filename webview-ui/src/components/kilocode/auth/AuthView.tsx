import React from "react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { Tab, TabContent, TabHeader } from "@src/components/common/Tab"
import { Button } from "@src/components/ui"

interface AuthViewProps {
	onDone: () => void
}

const AuthView: React.FC<AuthViewProps> = ({ onDone }) => {
	const { t } = useAppTranslation()
	return (
		<Tab>
			<TabHeader className="flex justify-between items-center">
				<h3 className="text-vscode-foreground m-0">{t("kilocode:auth.title")}</h3>
				<Button onClick={onDone}>{t("settings:common.done")}</Button>
			</TabHeader>
			<TabContent>
				<div className="h-full flex flex-col">
					<div className="flex-1">
                        <div className="flex flex-col items-center pr-3">
                        </div>
					</div>
				</div>
			</TabContent>
		</Tab>
	)
}

export default AuthView
