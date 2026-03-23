interface ValidationResult {
  success: boolean
  message: string
  buildOutput: string
}

interface ComponentValidationResult {
  filePath: string
  errors: string[]
}

export type {ValidationResult, ComponentValidationResult}
