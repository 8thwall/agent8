import { ICONS } from "@roo-code/types";

export default function CreditsIcon({className, size = 12}: {className?: string, size?: number}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg">
      <path d={ICONS.credits} />
    </svg>
  )
}
