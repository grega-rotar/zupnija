import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {presentationTool} from 'sanity/presentation'
import {visionTool} from '@sanity/vision'
import {schemaTypes, SINGLETON_TYPES} from './schemaTypes'
import {structure} from './structure'
import {resolve} from './presentation/resolve'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID || 'hnwav9pa'
const dataset = process.env.SANITY_STUDIO_DATASET || 'production'
const previewOrigin = process.env.SANITY_STUDIO_PREVIEW_ORIGIN || 'http://localhost:3000'

const singletonTypes = new Set<string>(SINGLETON_TYPES)

/** Actions that must not be available on singleton documents. */
const singletonBlockedActions = new Set(['unpublish', 'delete', 'duplicate'])

export default defineConfig({
  name: 'default',
  title: 'Župnija Pirniče',

  projectId,
  dataset,

  plugins: [
    structureTool({structure, title: 'Vsebina'}),
    presentationTool({
      title: 'Predogled',
      resolve,
      previewUrl: {
        origin: previewOrigin,
        previewMode: {
          enable: '/api/draft-mode/enable',
          disable: '/api/draft-mode/disable',
        },
      },
    }),
    // GROQ playground — useful for developers, harmless for editors.
    visionTool({title: 'Poizvedbe (razvijalci)'}),
  ],

  schema: {
    types: schemaTypes,
    // Singletons are created through the structure, never from "New document".
    templates: (templates) => templates.filter((t) => !singletonTypes.has(t.schemaType)),
  },

  document: {
    actions: (actions, context) =>
      singletonTypes.has(context.schemaType)
        ? actions.filter(({action}) => !action || !singletonBlockedActions.has(action))
        : actions,
  },
})
