/**
 * Validated configuration extracted from a webhook response.
 *
 * @remarks
 * Represents the `config` section of a {@link SyncResponse} after
 * structural validation by the {@link SchemaValidatorInterface}.
 *
 * This type alias exists to provide semantic clarity: a `ValidatedConfig`
 * has passed structural validation (object with version and config fields),
 * whereas a raw `Record<string, unknown>` has not.
 *
 * @see SchemaValidatorInterface - Service that produces ValidatedConfig
 * @see SyncResponse - The raw webhook response containing the config
 */
export type ValidatedConfig = Record<string, unknown>
