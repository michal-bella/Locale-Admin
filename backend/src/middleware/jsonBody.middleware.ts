import express, { type Request, type RequestHandler } from 'express'

/** Import routes carry a whole file (`IMPORT_FILE_MAX_BYTES` of content plus JSON escaping); everything else stays at 100 kB. */
export const IMPORT_JSON_LIMIT = '12mb'

const IMPORT_PATH_PATTERN = /^\/api\/projects\/[^/]+\/imports(?:\/|$)/i

/** `originalUrl` because routers rewrite `req.url` and `req.path` while they run. */
export const isImportRequest = (req: Request): boolean => IMPORT_PATH_PATTERN.test(req.originalUrl.split('?')[0] ?? '')

/** The default JSON parser. It skips import routes, which parse with `importJsonBody` after the auth and project access checks. */
export const createJsonBodyMiddleware = (): RequestHandler => {
	const json = express.json()
	return (req, res, next) => {
		if (isImportRequest(req)) {
			next()
			return
		}
		json(req, res, next)
	}
}

export const importJsonBody: RequestHandler = express.json({ limit: IMPORT_JSON_LIMIT })
