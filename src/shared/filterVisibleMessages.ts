import { ClineAsk, ClineMessage } from "@roo-code/types"

export function filterVisibleMessages(messages: ClineMessage[], everVisible: (ts: number) => boolean = () => true): ClineMessage[] {
  const currentMessageCount = messages.length
  const startIndex = Math.max(0, currentMessageCount - 500)
  const recentMessages = messages.slice(startIndex)

  const visibleMessages = recentMessages.filter((message: ClineMessage) => {
    if (everVisible(message.ts)) {
      const alwaysHiddenOnceProcessedAsk: ClineAsk[] = [
        "api_req_failed",
        "resume_task",
        "resume_completed_task",
      ]
      const alwaysHiddenOnceProcessedSay = [
        "api_req_finished",
        "api_req_retried",
        "api_req_deleted",
        "mcp_server_request_started",
      ]
      if (message.ask && alwaysHiddenOnceProcessedAsk.includes(message.ask)) return false
      if (message.say && alwaysHiddenOnceProcessedSay.includes(message.say)) return false
      if (message.say === "text" && (message.text ?? "") === "" && (message.images?.length ?? 0) === 0) {
        return false
      }
      return true
    }

    switch (message.ask) {
      case "completion_result":
        if (message.text === "") return false
        break
      case "api_req_failed":
      case "resume_task":
      case "resume_completed_task":
        return false
    }
    switch (message.say) {
      case "api_req_finished":
      case "api_req_retried":
      case "api_req_deleted":
        return false
      case "api_req_retry_delayed": {
        const last1 = messages.at(-1)
        const last2 = messages.at(-2)
        if (last1?.ask === "resume_task" && last2 === message) {
          return true
        } else if (message !== last1) {
          return false
        }
        break
      }
      case "text":
        if ((message.text ?? "") === "" && (message.images?.length ?? 0) === 0) return false
        break
      case "mcp_server_request_started":
        return false
    }
    return true
  })

  return visibleMessages
}
