import type { ModelInfo } from "../model.js"

export type AiApiModelId = keyof typeof aiApiModels

export const aiApiDefaultModelId: AiApiModelId = "anthropic.claude-sonnet-4-5-20250929-v1:0"

export const aiApiModels = {
  "anthropic.claude-sonnet-4-20250514-v1:0": {
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
    supportsComputerUse: true,
    supportsPromptCache: true,
    supportsReasoningBudget: true,
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritesPrice: 3.75,
    cacheReadsPrice: 0.3,
    minTokensPerCachePoint: 1024,
    maxCachePoints: 4,
    cachableFields: ["system", "messages", "tools"],
  },
  "anthropic.claude-sonnet-4-5-20250929-v1:0": {
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
    supportsComputerUse: true,
    supportsPromptCache: true,
    supportsReasoningBudget: true,
    inputPrice: 3.0,
    outputPrice: 15.0,
    cacheWritesPrice: 3.75,
    cacheReadsPrice: 0.3,
    minTokensPerCachePoint: 1024,
    maxCachePoints: 4,
    cachableFields: ["system", "messages", "tools"],
  },
} as const satisfies Record<string, ModelInfo>
