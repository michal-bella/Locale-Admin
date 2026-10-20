// k6 load test of GET /api/projects/:projectId/export. Run through scripts/load/run-export.sh <scenario>,
// which also samples the memory of the backend replicas. Data: scripts/load/seed-export.sql (load-m, load-l).
import { check, sleep } from 'k6'
import crypto from 'k6/crypto'
import http from 'k6/http'
import { Counter } from 'k6/metrics'

const BASE = __ENV.BASE_URL || 'http://nginx/api'
const SCENARIO = __ENV.SCENARIO || 'baseline'

const busy = new Counter('export_busy')
const serverErrors = new Counter('export_server_errors')
const otherErrors = new Counter('export_other_errors')
const slotsFreed = new Counter('export_slots_freed')

const BUSY_ALLOWED = http.expectedStatuses(200, 429)

// One wave of 100 users clicking Export at the same moment on load-m.
const spikeWave = (startTime) => ({ executor: 'per-vu-iterations', vus: 100, iterations: 1, startTime, maxDuration: '60s', exec: 'spike' })

const SCENARIOS = {
	baseline: {
		scenarios: { baseline: { executor: 'per-vu-iterations', vus: 1, iterations: 20, exec: 'baseline' } },
		thresholds: { 'http_req_duration{name:export}': ['p(95)<1000'], checks: ['rate==1'] },
	},
	realistic: {
		scenarios: { realistic: { executor: 'constant-vus', vus: 3, duration: '2m', exec: 'realistic' } },
		thresholds: { 'http_req_duration{name:export}': ['p(95)<2000'], 'http_req_failed{name:export}': ['rate==0'], checks: ['rate==1'] },
	},
	spike: {
		scenarios: { spike: spikeWave('0s') },
		thresholds: { export_server_errors: ['count==0'], export_other_errors: ['count==0'], checks: ['rate==1'] },
	},
	big: {
		scenarios: { big: { executor: 'per-vu-iterations', vus: 10, iterations: 3, maxDuration: '10m', exec: 'big' } },
		thresholds: { export_server_errors: ['count==0'], export_other_errors: ['count==0'], checks: ['rate==1'] },
	},
	soak: {
		scenarios: { wave1: spikeWave('0s'), wave2: spikeWave('90s'), wave3: spikeWave('180s') },
		thresholds: { export_server_errors: ['count==0'], export_other_errors: ['count==0'], checks: ['rate==1'] },
	},
	abort: {
		scenarios: { abort: { executor: 'per-vu-iterations', vus: 50, iterations: 1, maxDuration: '60s', exec: 'abort' } },
		thresholds: { export_server_errors: ['count==0'], export_slots_freed: ['count==1'] },
	},
}

export const options = {
	...SCENARIOS[SCENARIO],
	setupTimeout: '60s',
	teardownTimeout: '60s',
	summaryTrendStats: ['min', 'med', 'p(90)', 'p(95)', 'max'],
}

export function setup() {
	const login = http.post(
		`${BASE}/auth/login`,
		JSON.stringify({ email: 'michal.bella@goodrequest.com', password: __ENV.LOAD_ADMIN_PASSWORD || 'load-test-admin' }),
		{ headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } },
	)
	if (login.status !== 200) {
		throw new Error(`Login failed: ${login.status}`)
	}
	const cookie = `locale_session=${login.cookies.locale_session[0].value}`
	const projects = http.get(`${BASE}/projects`, { headers: { Cookie: cookie } }).json('projects')
	const exportUrl = (slug) => {
		const project = projects.find((item) => item.slug === slug)
		if (!project) {
			throw new Error(`Project ${slug} not found, run: scripts/load/run-export.sh seed`)
		}
		const languages = http.get(`${BASE}/projects/${project.id}/languages`, { headers: { Cookie: cookie } }).json()
		return `${BASE}/projects/${project.id}/export?languageIds=${languages.map((language) => language.id).join(',')}`
	}
	return { cookie, m: exportUrl('load-m'), l: exportUrl('load-l') }
}

const get = (data, url, params = {}) => http.get(url, { headers: { Cookie: data.cookie }, tags: { name: 'export' }, ...params })

/** Counts 429 and errors; 200 and (when allowed) 429 pass the check. */
const record = (res, { busyAllowed }) => {
	if (res.status === 429) {
		busy.add(1)
	} else if (res.status >= 500) {
		serverErrors.add(1)
	} else if (res.status !== 200) {
		otherErrors.add(1)
	}
	check(res, { 'status 200 (or 429 when busy is allowed)': (r) => r.status === 200 || (busyAllowed && r.status === 429) })
}

let firstHash

export function baseline(data) {
	const res = get(data, data.m)
	record(res, { busyAllowed: false })
	const hash = crypto.sha256(res.body || '', 'hex')
	firstHash = firstHash || hash
	check(res, { 'same file every run': () => hash === firstHash, 'all keys': (r) => (r.body || '').split('\n').length === 5000 + 4 + 2 })
}

export function realistic(data) {
	record(get(data, data.m, { responseType: 'none' }), { busyAllowed: false })
	sleep(1 + Math.random() * 2)
}

export function spike(data) {
	record(get(data, data.m, { responseType: 'none', responseCallback: BUSY_ALLOWED }), { busyAllowed: true })
}

export function big(data) {
	record(get(data, data.l, { responseType: 'none', responseCallback: BUSY_ALLOWED, timeout: '120s' }), { busyAllowed: true })
}

/** Clients that give up 100 ms into a ~2 s export of load-l; the request times out on the client side (status 0). */
export function abort(data) {
	const res = get(data, data.l, { responseType: 'none', timeout: '100ms', responseCallback: http.expectedStatuses(0) })
	if (res.status >= 500) {
		serverErrors.add(1)
	}
}

/** After the aborted clients, a normal export must get a slot right away: aborts must not keep slots or transactions. */
export function teardown(data) {
	if (SCENARIO !== 'abort') {
		return
	}
	sleep(2)
	const res = get(data, data.m, { responseType: 'none', timeout: '30s' })
	if (res.status === 200 && res.timings.waiting < 5000) {
		slotsFreed.add(1)
	}
}
