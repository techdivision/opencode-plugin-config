/**
 * Interface for the ConfigMerger service.
 *
 * Provides generic deep-merge with local-precedence semantics.
 */
export interface IConfigMerger {
  /**
   * Deep-merge base and override configs. Override values take precedence.
   * Arrays in override replace arrays in base completely (no concatenation).
   */
  merge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown>

  /**
   * Deep-merge with protected field handling.
   * Removes protected fields from base before merging, so override's protected fields are preserved.
   */
  mergeWithProtectedFields(
    base: Record<string, unknown>,
    override: Record<string, unknown>,
    protectedFields: readonly string[]
  ): Record<string, unknown>
}
