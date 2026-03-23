import { ICONS } from "@roo-code/types";

export default function Logo({ width = 100, height = 100 }: { width?: number; height?: number }) {
	return (
		<svg
			id="Kilo_Code_Branding"
			xmlns="http://www.w3.org/2000/svg"
			version="1.1"
			viewBox="0 0 45 83"
			className="mb-4 mt-4"
			width={width}
			height={height}>
			<path
				fill="var(--vscode-foreground)"
				d={ICONS.infin8}
			/>
		</svg>
	)
}
