import { useCallback } from "react"

import { useClipboard } from "@/components/ui/hooks"
import { Button, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { cn } from "@/lib/utils"

type CopyButtonProps = {
	taskId: string
}

export const IdButton = ({ taskId }: CopyButtonProps) => {
	const { isCopied, copy } = useClipboard()
	const { t } = useAppTranslation()

	const onCopy = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation()

			if (!isCopied) {
				copy(taskId)
			}
		},
		[isCopied, copy, taskId],
	)

	return (
		<StandardTooltip content={isCopied ? t("history:copiedId") : t("history:taskId", { id: taskId })}>
			<Button
				variant="ghost"
				size="icon"
				onClick={onCopy}
				className="group-hover:opacity-100 opacity-50 transition-opacity"
				data-testid="task-prompt-button">
				<span className={cn("codicon scale-80", { "codicon-check": isCopied, "codicon-info": !isCopied })} />
			</Button>
		</StandardTooltip>
	)
}
