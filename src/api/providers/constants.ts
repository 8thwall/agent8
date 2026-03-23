import { Package } from "../../shared/package"

export const DEFAULT_HEADERS = {
	"HTTP-Referer": "https://8thwall.com",
	"X-Title": "8th Wall Agent",
	"X-8thWallAgent-Version": Package.version,
	"User-Agent": `8th-wall-agent/${Package.version}`,
}
