/**
 * Information gain — the shared, dependency-free library.
 *
 * One import site for both workspaces: the CMS imports it directly, the
 * pipeline through `pipeline/src/informationGain/lib.ts`. Everything under this
 * directory must stay free of `next`, `react`, `payload` runtime imports, `@/`
 * aliases, `process.env`, and `node:*` imports.
 */

export * from './types'
export * from './policy'
export * from './scoring'
export * from './exactness'
export * from './coverage'
export * from './queryCluster'
export * from './sourceQuality'
export * from './text'
