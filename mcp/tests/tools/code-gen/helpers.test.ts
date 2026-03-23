import * as fs from 'node:fs'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {getRuntimeVersion} from '../../../src/tools/code-gen/helpers'

const readFileSpy = vi.spyOn(fs.promises, 'readFile')

describe('getRuntimeVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('handles errors gracefully', async () => {
    // Mock readFile to throw an error (file not found)
    readFileSpy.mockRejectedValue(new Error('File not found'))

    const result = await getRuntimeVersion('/invalid/path/to/repo')
    expect(result).toBe('1.0.0')
    expect(readFileSpy).toHaveBeenCalledWith(
      '/invalid/path/to/repo/src/expanse.json',
      'utf-8',
    )
  })

  it('returns correct version when expanse.json exists with valid runtimeVersion', async () => {
    const mockExpanseJson = {
      runtimeVersion: {
        major: 2,
        minor: 1,
        patch: 3,
      },
    }

    readFileSpy.mockResolvedValue(JSON.stringify(mockExpanseJson))

    const result = await getRuntimeVersion('/valid/path/to/repo')
    expect(result).toBe('2.1.3')
    expect(readFileSpy).toHaveBeenCalledWith(
      '/valid/path/to/repo/src/expanse.json',
      'utf-8',
    )
  })

  it('returns default version when expanse.json has incomplete runtimeVersion', async () => {
    const mockExpanseJson = {
      runtimeVersion: {
        major: 3,
        // missing minor and patch
      },
    }

    readFileSpy.mockResolvedValue(JSON.stringify(mockExpanseJson))

    const result = await getRuntimeVersion('/valid/path/to/repo')
    expect(result).toBe('3.0.0')
  })

  it('returns 1.0.0 version when expanse.json has invalid JSON', async () => {
    readFileSpy.mockResolvedValue('invalid json content')

    const result = await getRuntimeVersion('/invalid/json/repo')
    expect(result).toBe('1.0.0')
  })

  it('returns 1.0.0 version when expanse.json has no runtimeVersion property', async () => {
    const mockExpanseJson = {
      someOtherProperty: 'value',
    }

    readFileSpy.mockResolvedValue(JSON.stringify(mockExpanseJson))

    const result = await getRuntimeVersion('/no/runtime/version/repo')
    expect(result).toBe('1.0.0')
  })
})
