# packages/shared (`@locale/shared`)

The contract between frontend and backend. Owners: `frontend-developer` and `backend-developer` (contract changes are planned by the orchestrator first).

## Holds

- zod schemas for request bodies and responses, and their inferred types (`z.infer`)
- `ERROR_CODE` and `VALIDATION_CODE` enums and the zod issue → validation code mapping
- shared constants (`PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`)
- small pure helpers used by both sides (e.g. email normalization)

## Rules

- No runtime dependencies except `zod`. No Node-only or browser-only APIs.
- Every exported schema has a matching exported type.
- Changing an existing schema or code is a contract change: update FE, BE and `docs/api/` in the same step.
- Adding an `ERROR_CODE` or `VALIDATION_CODE` requires translations in `frontend/src/locales/sk.json` and `en.json` (a unit test enforces this).
