import axios from 'axios'

const METHODS_WITH_BODY = new Set(['post', 'put', 'patch', 'delete'])

const http = axios.create({
	baseURL: '/api',
	withCredentials: true,
})

// CSRF protection on the BE requires X-Requested-With on every request and Content-Type: application/json on every mutation,
// so a mutation without a body sends `{}` (axios sets the JSON content type only when there is data).
http.interceptors.request.use((config) => {
	config.headers.set('X-Requested-With', 'XMLHttpRequest')
	if (METHODS_WITH_BODY.has(config.method?.toLowerCase() ?? '') && config.data === undefined) {
		config.data = {}
	}
	return config
})

export default http
