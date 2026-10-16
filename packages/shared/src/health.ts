import { z } from 'zod'

export enum HEALTH_STATUS {
	OK = 'ok',
	ERROR = 'error',
}

export const healthResponseSchema = z.object({
	status: z.enum(HEALTH_STATUS),
	version: z.string(),
	db: z.object({ status: z.enum(HEALTH_STATUS), latencyMs: z.number().nullable() }),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
