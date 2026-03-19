/**
 * Interface for the ConfigMerger service.
 *
 * @remarks
 * Provides generic deep-merge with local-precedence semantics.
 * Used by ConfigLoader for the local cascade (Global+Project) and
 * by the entry point for the final merge (Remote+Local).
 *
 * @see ConfigMerger - Implementation
 * @see {@link https://github.com/TehShrike/deepmerge | deepmerge} - Underlying merge library
 */
export interface ConfigMergerInterface {
  /**
   * Deep-merge base and override configs.
   *
   * @param base - The base config (lower precedence)
   * @param override - The override config (higher precedence, wins on conflict)
   * @returns The merged config with override values taking precedence at all nesting levels.
   *          Arrays in override replace arrays in base completely (no concatenation).
   *
   * @example
   * ```typescript
   * const merger = new ConfigMerger()
   * const result = merger.merge(
   *   { a: 1, b: { x: 10 } },
   *   { b: { y: 20 }, c: 3 }
   * )
   * // result: { a: 1, b: { x: 10, y: 20 }, c: 3 }
   * ```
   */
  merge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown>

  /**
   * Deep-merge with protected field handling.
   *
   * @remarks
   * Removes protected fields from base before merging, so override's
   * protected fields are preserved unchanged. Used for the final merge
   * where `$schema` and `version` from local config must not be overwritten.
   *
   * @param base - The base config (protected fields will be removed before merge)
   * @param override - The override config (protected fields are preserved)
   * @param protectedFields - Field names to remove from base before merging
   * @returns The merged config with protected fields only from override
   *
   * @example
   * ```typescript
   * const result = merger.mergeWithProtectedFields(
   *   { $schema: "remote.json", version: "2.0", data: "remote" },
   *   { $schema: "local.json", version: "1.0", data: "local" },
   *   ['$schema', 'version']
   * )
   * // result: { $schema: "local.json", version: "1.0", data: "local" }
   * ```
   */
  mergeWithProtectedFields(
    base: Record<string, unknown>,
    override: Record<string, unknown>,
    protectedFields: readonly string[]
  ): Record<string, unknown>
}
