import * as fs from 'node:fs'
import {getTrackContext, track} from 'opik'
import z from 'zod'
import {convertZodToJsonSchema} from '../../common/helpers'
import type {ToolRegistration} from '../../types'
import {validateComponents} from './validate-component'
import {validator} from './validator'
import type {ComponentValidationResult} from './validator-types'

const validateProjectBuildInputSchema = z.object({})

const validateProjectBuildTool: ToolRegistration<
  z.infer<typeof validateProjectBuildInputSchema>
> = {
  name: 'validateProjectBuild',
  title: 'Validate 8thWall Studio Project Build',
  description:
    'Builds and verifies if the 8thWall Studio project is correctly set up. If the build fails, it returns the error trace with line numbers and file paths. Use this tool to validate the whole project after generating all the components.',
  inputSchema: convertZodToJsonSchema(validateProjectBuildInputSchema),
  handler: async () => {
    return await track(
      {name: 'validateProjectBuild', type: 'tool'},
      async () => {
        const buildResult = validator.validateBuild()
        const context = getTrackContext()

        if (context?.span) {
          if (!buildResult.success) {
            context.span.update({
              output: {buildResult},
              errorInfo: {
                exceptionType: 'ValidationError',
                message: 'Project build validation failed',
                traceback: buildResult.buildOutput,
              },
            })
          } else {
            context.span.update({
              output: {buildResult},
            })
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: buildResult.success
                ? 'Project build has passed validation.'
                : `Project build has failed validation.\n\nBuild Output:\n${buildResult.buildOutput}`,
            },
          ],
        }
      },
    )()
  },
  parseArgs: (args) => validateProjectBuildInputSchema.parse(args),
}

const validateEcsInputSchema = z.object({
  componentFilePaths: z.array(
    z
      .string()
      .describe(
        'The absolute path to the component file within the project to validate`.',
      ),
  ),
})
const validateComponentTool: ToolRegistration<
  z.infer<typeof validateEcsInputSchema>
> = {
  name: 'validateComponents',
  title: 'Validate ECS Component Schema',
  description:
    'Validates the schema of ECS components at the absolute `componentFilePaths`. Use this tool to validate ECS component(s) during development.',
  inputSchema: convertZodToJsonSchema(validateEcsInputSchema),
  handler: async (args) => {
    return await track({name: 'validateComponents', type: 'tool'}, async () => {
      const {componentFilePaths} = args
      const fileContents = componentFilePaths.map((componentFilePath) => ({
        filePath: componentFilePath,
        content: fs.readFileSync(componentFilePath, 'utf8'),
      }))
      const results: ComponentValidationResult[] =
        await validateComponents(fileContents)

      const context = getTrackContext()
      const hasErrors = results.some((result) => result.errors.length > 0)

      if (context?.span) {
        if (hasErrors) {
          const errorDetails = results
            .filter((result) => result.errors.length > 0)
            .map((result) => `${result.filePath}:\n${result.errors.join('\n')}`)
            .join('\n\n')

          context.span.update({
            input: {componentFilePaths},
            output: {results},
            errorInfo: {
              exceptionType: 'ComponentValidationError',
              message: 'Component schema validation failed',
              traceback: errorDetails,
            },
          })
        } else {
          context.span.update({
            input: {componentFilePaths},
            output: {results},
          })
        }
      }

      return {
        content: results.map((result) => ({
          type: 'text',
          text: result.errors.length
            ? `Errors for ${result.filePath}: \n\n${result.errors.join('\n')}`
            : `Validation for component at ${result.filePath} successful!`,
        })),
      }
    })()
  },
  parseArgs: (args) => validateEcsInputSchema.parse(args),
}

export {validateProjectBuildTool, validateComponentTool}
