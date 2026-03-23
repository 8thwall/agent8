// TODO(chloe): Replace with symlinked schemas in code8's studiomcp.
/* eslint-disable max-len */
import {z} from 'zod'

import {entityReferenceSchema, objectIdSchema} from '../ecs/scene-graph'

const getAvailableComponentsRequestSchema = z.object({})
const getAvailableComponentsResponseSchema = z.object({
  availableComponents: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            'Name of the component. Can be used to add the component to an entity in the scene.',
          ),
        schema: z.array(
          z.object({
            name: z.string().describe('Name of the attribute.'),
            type: z.string().describe('Type of the attribute.'),
            default: z
              .any()
              .optional()
              .describe('Default value of the attribute.'),
          }),
        ),
      }),
    )
    .describe('List of available components.'),
})

type GetAvailableComponentsRequest = z.infer<
  typeof getAvailableComponentsRequestSchema
>
type GetAvailableComponentsResponse = z.infer<
  typeof getAvailableComponentsResponseSchema
>

const componentParametersSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), entityReferenceSchema]),
)

const applyComponentsRequestSchema = z.object({
  componentsByObjectId: z
    .record(
      objectIdSchema,
      z
        .array(
          z.object({
            componentName: z
              .string()
              .describe('Name of the component to apply'),
            parameters: componentParametersSchema.describe(
              'Component parameters with their values',
            ),
          }),
        )
        .describe('Array of components to apply to this object'),
    )
    .describe('Map of object IDs to array of components to apply'),
})

const updateComponentsRequestSchema = z.object({
  componentsByObjectId: z
    .record(
      objectIdSchema,
      z
        .array(
          z.object({
            componentId: z.string().describe('ID of the component to apply'),
            parameters: componentParametersSchema.describe(
              'Component parameters with their values',
            ),
          }),
        )
        .describe('Array of components to apply to this object'),
    )
    .describe('Map of object IDs to array of components to update'),
})

const removeComponentsRequestSchema = z.object({
  componentsByObjectId: z
    .record(
      objectIdSchema,
      z.array(z.string().describe('Component ID to remove')),
    )
    .describe('Map of object IDs to array of component IDs'),
})

export {
  getAvailableComponentsRequestSchema,
  applyComponentsRequestSchema,
  updateComponentsRequestSchema,
  removeComponentsRequestSchema,
}
