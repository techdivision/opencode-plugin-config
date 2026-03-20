/**
 * Result of validating a single config section against its JSON schema.
 *
 * @remarks
 * Returned by {@link SchemaValidatorInterface.validateSection} after
 * Ajv-based validation of a section's data against its plugin schema.
 *
 * When validation succeeds, `valid` is `true` and `errors` is `undefined`.
 * When validation fails, `valid` is `false` and `errors` contains all
 * Ajv error messages (configured with `allErrors: true`).
 *
 * @see SchemaValidatorInterface.validateSection - Method that produces this result
 */
export interface SectionValidationResult {
  /** Whether the section data conforms to the schema. */
  readonly valid: boolean

  /** Ajv error messages when validation fails, `undefined` on success. */
  readonly errors?: string[]
}
