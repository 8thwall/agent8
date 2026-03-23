import {z} from 'zod'

import {type ObjectIds, objectIdsSchema} from '../common'
import {
  geometryTypeSchema,
  lightTypeSchema,
  objectIdSchema,
} from '../ecs/scene-graph'

const createObjectsRequestSchema = z
  .object({
    objects: z.array(
      z
        .object({
          type: geometryTypeSchema
            .or(lightTypeSchema)
            .or(z.literal('empty'))
            .describe('Type of the object.'),
          name: z.string().describe('Name of the object.'),
          parentId: objectIdSchema.describe(
            'The ID of the parent object/space to attach the new object to. This field is required. To get the correct ID:\n\n1. If the user requests a specific object, prefab, or space to attach the new object to, call getCurrentScene() and try searching for the object in "objects" or the space in "spaces" and use its "id" field.\n2. If the user either made no explicit request to attach the object to a parent object or space OR if they requested to add the object to the current space or the current prefab being edited OR if the given parentId could not be found from getCurrentScene, call getActiveRoot() and use the returned "id" field\n\nINVALID: Invalid parentIDs include names like "space:default", "root", "space:spaceName"\n\nVALID: Only "id"s returned from either getActiveRoot or getCurrentScene',
          ),
        })
        .describe('Type and name of the object to create.'),
    ),
  })
  .describe('Array of objects to create.')

type CreateObjectsRequest = z.infer<typeof createObjectsRequestSchema>
type CreateObjectsResponse = {createdObjectIds: ObjectIds}

const setObjectParentSchema = z.object({
  childObjectId: z.string().describe('The ID of the object to reparent.'),
  newParentId: z.string().describe('The ID of the new parent object.'),
})

const deleteObjectsSchema = z
  .object({objectIds: objectIdsSchema})
  .describe('Array of object IDs to delete.')

const duplicateObjectsSchema = z
  .object({objectIds: objectIdsSchema})
  .describe('Array of object IDs to duplicate.')

export {
  createObjectsRequestSchema,
  setObjectParentSchema,
  deleteObjectsSchema,
  duplicateObjectsSchema,
}

export type {CreateObjectsRequest, CreateObjectsResponse}
