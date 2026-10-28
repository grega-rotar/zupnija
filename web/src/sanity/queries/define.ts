/**
 * `defineQuery` without next-sanity: the GROQ strings stay as the reference
 * for the projections in src/lib/content/read.ts, for the TypeGen result types
 * (types.generated.ts) and for the fixtures (scripts/capture-groq-results.ts).
 */
export const defineQuery = <const Q extends string>(query: Q): Q => query;
