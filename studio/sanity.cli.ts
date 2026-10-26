import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: 'hnwav9pa',
    dataset: 'production',
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
  },
  /**
   * TypeGen: the website in ../web gets TypeScript types for every schema
   * type and every GROQ query it defines. Runs on `sanity dev` / `sanity build`
   * and via `npm run typegen`.
   */
  typegen: {
    enabled: true,
    path: '../web/src/**/*.{ts,tsx}',
    schema: 'schema.json',
    generates: '../web/src/sanity/types.generated.ts',
    overloadClientMethods: true,
  },
})
