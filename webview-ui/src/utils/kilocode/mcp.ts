// kilocode_change: imported from Cline
import { McpErrorEntry, McpServer } from "@roo/mcp"
import { McpMarketplaceCatalog } from "../../../../src/shared/kilocode/mcp"

/**
 * Attempts to convert an MCP server name to its display name using the marketplace catalog
 * @param serverName The server name/ID to look up
 * @param mcpMarketplaceCatalog The marketplace catalog containing server metadata
 * @returns The display name if found in catalog, otherwise returns the original server name
 */
export function getMcpServerDisplayName(serverName: string, mcpMarketplaceCatalog: McpMarketplaceCatalog): string {
	// Find matching item in marketplace catalog
	const catalogItem = mcpMarketplaceCatalog.items.find((item) => item.mcpId === serverName)

	// Return display name if found, otherwise return original server name
	return catalogItem?.name || serverName
}

const SUPPRESSED_ERRORS = [
	" Warning: ",
	" ExperimentalWarning: ",
]

/**
 * Returns a filtered list of visible MCP errors for a given server.
 * @param server The MCP server to retrieve errors from
 * @returns An array of visible MCP error entries, or undefined if no errors are present
 */
export function getVisibleMcpErrors(server: McpServer, debugMode?: boolean): McpErrorEntry[] | undefined {
	if (server.source !== "builtin" || debugMode) {
		return server.errorHistory
	}
	return server.errorHistory?.filter((error) => !SUPPRESSED_ERRORS.some((msg) => error.message.includes(msg)))
}
