import {z} from 'zod'
import {Tool} from '../../factory/tool-factory'
import {objectIdsSchema} from '../../schema/common'
import {
  objectIdSchema,
  sceneGraphSchema,
  spaceSchema,
} from '../../schema/ecs/scene-graph'
import {
  applyComponentsRequestSchema,
  createObjectsRequestSchema,
  getAvailableComponentsRequestSchema,
  getObjectsPropertyRequestSchema,
  removeComponentsRequestSchema,
  setObjectsPropertyRequestSchema,
  updateComponentsRequestSchema,
  upsertActionMapsRequestSchema,
} from '../../schema/studio-use'

// TODO(kyle): Adding descriptions to parameters will improve our LLM's understanding.
const SCENE_GETTERS = [
  Tool.create(
    'getCurrentScene',
    'Get the complete representation of the current 3D scene as a JSON object. This includes all objects, their properties (position, rotation, scale, materials), hierarchical relationships, lighting, cameras, and scene settings. Use this to analyze the entire scene state, understand what objects exist, their properties, and how they relate to each other. This is useful when you need a comprehensive view of the scene before making changes or when you need to understand the scene structure.',
    z.object({}),
  ),

  Tool.create(
    'getAvailableComponents',
    'List all available components that can be added to objects in the scene.',
    getAvailableComponentsRequestSchema,
  ),

  Tool.create(
    'getObjectsProperty',
    'Get the property values of objects in the scene. You can specify a list of object IDs to get properties for specific objects, or leave an empty array to get properties of all objects in the scene. Use this to understand the properties of objects in your scene, such as their position, rotation, scale, or material. This is useful when you need to analyze the state of objects or when you need to understand the properties of objects in your scene.',
    getObjectsPropertyRequestSchema,
  ),

  Tool.create(
    'getRandomColor',
    'Generate a random color in hexadecimal format (e.g., #FF00FF). This creates a completely random color across the full RGB spectrum. Use this tool to:\n\n- Create visually diverse objects with random appearances\n- Generate color schemes for procedural content\n- Create visual variety in repeated elements\n- Add randomized visual effects\n- Implement color-based gameplay mechanics\n\nThe function requires no parameters and returns a string in the format "#RRGGBB" where RR, GG, and BB are hexadecimal values (00-FF) representing the red, green, and blue components of the color.',
    z.object({}),
  ),

  Tool.create(
    'getAssets',
    'Gets a list of filepaths to assets in the project. This includes images, 3D models, audio files, video files, splats (.spz), and font files that have been uploaded the project. Use this to:\n- Browse available assets for use in the scene\n- Select specific assets to apply to objects (e.g., setting a texture or model)\n- Ensure required assets are present before attempting to add certain assets to the scene.\n\nThe function requires no parameters and returns an array of strings, each representing the filepath to an asset in the project.',
    z.object({}),
  ),

  Tool.create(
    'getImageTargets',
    'Gets a list of image targets in the project. Image targets are images that can be used for augmented reality tracking. Use this to:\n- Browse available and loadable image targets for use in the scene\n- Select specific image targets to apply to objects or for tracking purposes\n- Ensure required image targets are present before making scene modifications\n\nThe function requires no parameters and returns an array of image target data, each representing an image target in the project.',
    z.object({}),
  ),

  Tool.create(
    'getActiveRoot',
    'Gets the active root of the project right now. The active root is either the current space in Studio or the current prefab being edited. Use this to:\n- Determine the context for adding or modifying objects\n- Ensure operations are performed in the correct space or prefab\n- Understand where new objects will be created or existing ones modified\n\nThe function requires no parameters and returns an object with the following structure:\n{\n  "id": string,               // The unique identifier of the active space or prefab\n  "space": Space,               // The current active space, which is null if the active root is a prefab\n  "prefab": BaseGraphObject,               // The current prefab selected, which is null if the active root is a space\n\nThis information helps ensure that any scene manipulations are contextually appropriate.',
    z.object({}),
  ),
]

const SCENE_SETTERS = [
  Tool.create(
    'createObjects',
    'Create a new 3D object in the scene. This tool allows you to add primitive shapes (like cubes, spheres, planes) or more complex objects to your scene. The created object will have default properties (position at origin, scale of 1, etc.) which you can modify with other tools.',
    createObjectsRequestSchema,
  ),

  Tool.create(
    'setObjectsProperty',
    'Set the property values of objects in the scene. You can specify a list of object IDs and the properties to modify. Use this to change the properties of objects in your scene, such as their position, rotation, scale, or material. This is useful when you need to modify the state of objects or when you need to change the properties of objects in your scene.',
    setObjectsPropertyRequestSchema,
  ),

  Tool.create(
    'setObjectParent',
    'Set a parent-child relationship between two objects in the scene. When an object becomes a child of another:\n\n1. Its position, rotation, and scale become relative to the parent\n2. Moving, rotating, or scaling the parent affects the child\n3. The hierarchy is reflected in the scene graph\n\nThis tool takes a child object and a parent object as parameters. Use this to:\n- Create complex objects from simpler parts\n- Group related objects together\n- Create mechanical relationships (like wheels on a car)\n- Simplify positioning of related objects.',
    z.object({objectId: objectIdSchema, newParentId: objectIdSchema}),
  ),

  Tool.create(
    'deleteObjects',
    'Remove one or more 3D objects from the scene permanently using their object IDs. Takes an array of object IDs - use a single-element array to delete just one object. When objects are deleted:\n\n1. They are completely removed from the scene graph\n2. Any children of the deleted objects will also be removed unless they are reassigned to another parent\n3. References to the deleted objects will no longer be valid\n\nThis tool takes:\n- objectIds: An array of object IDs to delete.\n\nUse this to:\n- Clean up temporary objects that are no longer needed\n- Remove objects that should disappear during gameplay (like collected items)\n- Replace objects with different ones\n- Optimize scene performance by removing unnecessary objects\n\nBe careful when deleting objects as the operation cannot be undone without recreating the objects.',
    z.object({objectIds: objectIdsSchema}),
  ),

  Tool.create(
    'duplicateObjects',
    'Create an exact copy of a 3D objects in the scene. The duplicate will have the same geometry, material, and other properties as the original, but will be a separate object with its own unique ID.\n\nThis tool takes:\n- objectIds: An array of object IDs to duplicate.\n\nUse this to:\n- Create multiple identical objects quickly\n- Make variations of an object by duplicating and then modifying\n- Save time when creating complex scenes with repeating elements\n\nThe function returns a reference to the newly created duplicate object.',
    z.object({objectIds: objectIdsSchema}),
  ),

  Tool.create(
    'applyComponents',
    'Apply/add a registered component to an object in the scene. Components are reusable pieces of functionality or behavior that can be attached to objects to give them specific capabilities.\nUse this to:\n- Add interactivity or behavior to objects (e.g., make an object clickable)\n- Reuse common functionality across multiple objects\n- Customize objects with different configurations of the same component\n\nThis function returns the ID of the newly applied component. There is no need to call getAvailableComponents before this tool.',
    applyComponentsRequestSchema,
  ),

  Tool.create(
    'updateComponents',
    'Update the parameters of an existing component on an object in the scene. This allows you to modify the behavior or configuration of a component without needing to remove and reapply it.\nUse this to:\n- Change the behavior of a component dynamically\n- Adjust settings or properties of a component based on user interaction or other events\n- Fine-tune the functionality of components without disrupting the object they are attached to\n\nIf a parameter is an entity reference, be sure to use entitySchemaReference, not a string ID. This function returns the updated component details. There is no need to call getAvailableComponents before this tool.',
    updateComponentsRequestSchema,
  ),

  Tool.create(
    'removeComponents',
    'Remove a component from an object in the scene using the component ID. This will detach the component and its functionality from the object, but will not delete the component entirely - it can be reapplied later if needed.\nUse this to:\n- Disable specific functionality or behavior on an object\n- Clean up components that are no longer needed\n- Modify the behavior of an object by removing certain components\n\nBe careful when removing components as it may affect the behavior of the object they are attached to. There is no need to call getAvailableComponents before this tool.',
    removeComponentsRequestSchema,
  ),

  Tool.create(
    'makePrefabs',
    'Create a prefab from an existing object in the scene. A prefab is a reusable template that can be instantiated multiple times, allowing for efficient scene management and organization.\nUse this to:\n- Create reusable object templates for common elements\n- Simplify scene management by grouping related objects\n- Enable easy instantiation of complex objects with predefined properties\n\nThis function returns the ID of the newly created prefab.',
    z.object({objectIds: objectIdsSchema}),
  ),

  Tool.create(
    'unlinkPrefabInstances',
    'Unlink one or more prefab instances from their source prefab. This breaks the connection between the instance and the prefab, allowing the instance to be modified independently without affecting the original prefab or other instances. Use this to:\n- Customize specific instances of a prefab without changing the original\n- Make unique modifications to an instance while keeping the prefab intact\n- Experiment with variations of a prefab instance\n\nThis function takes an array of object IDs representing the prefab instances to unlink. After unlinking, the instances will retain their current properties but will no longer receive updates from the source prefab.',
    z.object({instanceIds: objectIdsSchema}),
  ),

  Tool.create(
    'deletePrefabs',
    'Delete one or more prefab (sources) in the project. When a prefab is deleted, all instances of that prefab in the scene can be either deleted or unlinked (to retain them as independent objects). By default, instances will be unlinked unless the user explicitly requests to delete all instances.',
    z.object({
      prefabIds: objectIdsSchema,
      deleteInstances: z.boolean().optional().default(false),
    }),
  ),

  Tool.create(
    'setSpaceProperties',
    'Modify properties of spaces in the scene graph, like name, sky, activeCamera, includedSpaces, reflections, and fog. This allows you to customize the overall environment and settings of different spaces within your scene. Use this to:\n- Change the visual appearance of a space (e.g., skybox, fog settings)\n- Set which camera is active in a space\n- Manage relationships between multiple spaces using includedSpaces\n- Adjust environmental effects like reflections and lighting\n\nThis function takes an array of space modifications, each specifying the space ID and the properties to change ("id", however, is immutable). You should only include a property in the array element if the user has explicitly requested to update this property. Do not include properties that the user has not requested to change or that are the same as their current value.',
    z.object({
      spaces: z.array(
        spaceSchema.describe(
          'The ID is immutable and should always be provided as the space "id" to modify, but all other properties are mutable if provided. "includedSpaces" should always be an array of space IDs not including this space\'s ID.',
        ),
      ),
    }),
  ),

  Tool.create(
    'addSpaces',
    'Adds new spaces to the project. Adding a new space allows you to create a separate environment or scene within your project. Each space can have its own unique settings, objects, and configurations, enabling you to organize your project into distinct areas or levels.\n\nUse this to:\n- Create multiple scenes or levels within a single project\n- Organize different environments or themes\n- Experiment with different layouts or designs without affecting the main scene\n\nThis function requires an array of names for the spaces and returns the updated list of spaces keyed by their IDs.',
    z.object({names: z.array(z.string())}),
  ),

  Tool.create(
    'deleteSpaces',
    'Delete one or more spaces in the project. Deleting a space will remove all objects, settings, and configurations associated with that space.\n\nUse this to:\n- Delete one or more spaces within a scene upon user request. This function requires an array of space IDs to delete and returns a confirmation of the updated list of remaining spaces keyed by ID and a list of space IDs it failed to delete (i.e. failed to find in the scene).',
    z.object({spaceIds: z.array(z.string())}),
  ),

  Tool.create(
    'duplicateSpaces',
    'Duplicate one or more spaces in the project. Duplicating a space creates an exact copy of the selected space, including all objects, settings, and configurations. The duplicated space will have a new unique ID and can be modified independently of the original space.\n\nUse this to:\n- Create variations of an existing space without starting from scratch\n- Quickly create multiple similar spaces for different purposes\n\nThis function requires an array of space IDs to duplicate and returns an updated list of spaces keyed by their IDs along with a list of space IDs it failed to duplicate (i.e. failed to find in the scene).',
    z.object({spaceIds: z.array(z.string())}),
  ),

  Tool.create(
    'setExpanseProperties',
    'Modify writable properties of the scene graph, such as the entry space ID and the active action map being used. This function takes in a properties object that can include any of the fields of the scene graph--however, activeCamera, sky, and reflections are excluded because these are now deprecated at the scene level and objects, spaces, and inputs should be set using their respective tools.',
    z.object({
      properties: sceneGraphSchema.pick({
        entrySpaceId: true,
        activeMap: true,
      }),
    }),
  ),

  Tool.create(
    'upsertActionMaps',
    "Add new or update existing action maps in the scene's inputs. Action maps define how user inputs (like keyboard, mouse, or gamepad actions) are mapped to in-game actions or events. By adding action maps, you can customize the control scheme for your project, allowing for a more tailored user experience.\n\nUse this to:\n- Create custom control schemes for different gameplay styles\n- Support multiple input devices with specific mappings\n- Enhance user interaction by defining intuitive controls\n\nThis function requires a record of action maps (containing actions the user wants in the map) to add/update keyed by their names. If an action map is being updated, provide the updated final actions. For example, if adding strafing actions to an existing WASD action map, then include the pre-existing WASD actions, as well. If deleting an action from an existing map, then provide the existing list of actions for that action map and exclude the action to delete. This function returns the updated list of action maps keyed by their names along with any errors that occurred.",
    upsertActionMapsRequestSchema,
  ),

  Tool.create(
    'deleteActionMaps',
    "Delete one or more action maps from the scene's inputs. Action maps define how user inputs (like keyboard, mouse, or gamepad actions) are mapped to in-game actions or events. By deleting action maps, you can remove specific control schemes from your project.\n\nUse this to:\n- Remove outdated or unused control schemes\n- Simplify the input configuration by eliminating unnecessary action maps\n- Ensure that only relevant input mappings are active in the project\n\nThis function requires an array of action map names to delete and returns a confirmation of the updated list of remaining action maps keyed by name and a list of action map names it failed to delete (i.e., not found in the scene).",
    z.object({actionMapNames: z.array(z.string())}),
  ),
]

const getSceneTools = (readonly: boolean) =>
  readonly ? SCENE_GETTERS : [...SCENE_GETTERS, ...SCENE_SETTERS]

export {getSceneTools}
