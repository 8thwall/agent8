import { useMemo } from "react"
import CreditsIcon from "../kilocode/common/Credits"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { convertBipsToCredits } from "@roo/cost"

export const CreditsTracker = () => {
  const {creditsData} = useExtensionState()

	const parsedCredits = useMemo(() => {
		if (!creditsData) return undefined
		const { activeCreditGrants } = creditsData
			const creditAmount = activeCreditGrants.reduce((
				acc,
				e
			) => (acc + convertBipsToCredits(e.remainingQuantity)), 0)
			return { creditAmount }
		}, [creditsData])

	return parsedCredits && (
		<div className="flex items-center pt-2">
			<CreditsIcon className="mr-1" />
			<span>{parsedCredits.creditAmount.toFixed(1)}</span>
		</div>
	)
}
