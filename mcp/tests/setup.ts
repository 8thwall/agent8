import {beforeEach, vi} from 'vitest'

/**
 * Vitest setup file for unit tests
 * This file runs before each test suite
 */

// Global test configuration
process.env.NODE_ENV = 'test'

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks()
})
