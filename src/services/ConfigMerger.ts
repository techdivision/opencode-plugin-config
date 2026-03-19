/**
 * ConfigMerger - Central merge service
 *
 * Encapsulates deepmerge library with local-precedence semantics.
 * Used by ConfigLoader for local cascade (Global+Project) and
 * by the entry point for final merge (Remote+Local).
 */
import deepmerge from 'deepmerge'
import type { IConfigMerger } from './interfaces/IConfigMerger.js'

/**
 * Custom array merge strategy: override array replaces base array completely.
 * No concatenation, no deduplication — local array wins.
 */
function overwriteArrays(_target: unknown[], source: unknown[]): unknown[] {
  return source
}

export class ConfigMerger implements IConfigMerger {
  /**
   * Deep-merge base and override configs.
   * Override values take precedence at all nesting levels.
   * Arrays in override replace arrays in base completely.
   */
  public merge(
    base: Record<string, unknown>,
    override: Record<string, unknown>
  ): Record<string, unknown> {
    return deepmerge(base, override, { arrayMerge: overwriteArrays })
  }

  /**
   * Deep-merge with protected field handling.
   * Removes protected fields from base before merging,
   * so override's protected fields are preserved unchanged.
   */
  public mergeWithProtectedFields(
    base: Record<string, unknown>,
    override: Record<string, unknown>,
    protectedFields: readonly string[]
  ): Record<string, unknown> {
    const sanitizedBase = { ...base }
    for (const field of protectedFields) {
      delete sanitizedBase[field]
    }
    return this.merge(sanitizedBase, override)
  }
}
