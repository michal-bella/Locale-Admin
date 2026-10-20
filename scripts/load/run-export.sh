#!/usr/bin/env bash
# Load tests of the CSV export against a separate stack (scripts/load/docker-compose.yml, http://127.0.0.1:8090).
# Usage: scripts/load/run-export.sh up | seed | run <baseline|realistic|spike|big|soak|abort> | all | down
# FORMAT=XLSX runs the scenarios against the XLSX export (default CSV).
# `run` samples `docker stats` of the backend replicas every ~2 s and prints memory and the `Export finished` log lines.
source "$(dirname "$0")/../lib.sh"

K6_IMAGE=grafana/k6:1.3.0
LOAD_DIR=scripts/load
RESULTS="$LOAD_DIR/results"
COMPOSE=(docker compose -f "$LOAD_DIR/docker-compose.yml")
SCENARIOS=(baseline realistic spike big soak abort)

sample_memory() {
	while true; do
		docker stats --no-stream --format '{{.Name}},{{.MemUsage}}' $("${COMPOSE[@]}" ps -q backend) | sed "s/^/$(date +%s),/"
	done
}

summarize() {
	python3 - "$1" "$2" <<'EOF'
import collections, json, re, sys

def mib(text):
    value, unit = re.match(r'([\d.]+)\s*([KMG]i?B)', text).groups()
    return float(value) * {'KiB': 1 / 1024, 'MiB': 1, 'GiB': 1024, 'KB': 1 / 1024, 'MB': 1, 'GB': 1024}[unit]

samples = collections.defaultdict(list)
for line in open(sys.argv[1]):
    _, name, usage = line.strip().split(',', 2)
    samples[name].append(mib(usage.split('/')[0]))
print('memory (MiB)        start    max    end')
for name, values in sorted(samples.items()):
    print(f'{name:<18} {values[0]:6.0f} {max(values):6.0f} {values[-1]:6.0f}')

heaps = collections.defaultdict(list)
for line in open(sys.argv[2]):
    name, _, payload = line.partition('|')
    try:
        entry = json.loads(payload)
    except ValueError:
        continue
    if entry.get('msg') == 'Export finished':
        heaps[name.strip()].append((entry['heapUsedMb'], entry['durationMs'], entry['keys'], entry['aborted']))
for name, entries in sorted(heaps.items()):
    print(f'{name}: {len(entries)} exports, aborted {sum(e[3] for e in entries)}, heapUsed MiB min {min(e[0] for e in entries)} max {max(e[0] for e in entries)} last {entries[-1][0]}, duration ms max {max(e[1] for e in entries)}')
EOF
}

run_scenario() {
	local scenario=$1 stamp
	stamp="$(date +%Y%m%d-%H%M%S)-$scenario-${FORMAT:-CSV}"
	mkdir -p "$RESULTS"
	local since
	since="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
	sample_memory >"$RESULTS/$stamp-memory.csv" 2>/dev/null &
	local sampler=$!
	sleep 3
	local status=0
	docker run --rm --network locale-load_default -v "$REPO_ROOT/$LOAD_DIR:/scripts:ro" -v "$REPO_ROOT/$RESULTS:/results" \
		-e SCENARIO="$scenario" -e FORMAT="${FORMAT:-CSV}" -e LOAD_ADMIN_PASSWORD="${LOAD_ADMIN_PASSWORD:-load-test-admin}" \
		"$K6_IMAGE" run --quiet --summary-export "/results/$stamp-summary.json" /scripts/export.k6.js >"$RESULTS/$stamp-k6.txt" 2>&1 || status=$?
	# Idle after the load, so the end of the memory samples shows what the replicas keep.
	sleep 20
	kill "$sampler" && wait "$sampler" 2>/dev/null || true
	"${COMPOSE[@]}" logs --no-color --since "$since" backend >"$RESULTS/$stamp-backend.log"
	echo "=== $scenario ${FORMAT:-CSV} (k6 exit $status) ==="
	sed -n '/THRESHOLDS/,$p' "$RESULTS/$stamp-k6.txt" | grep -E '✓|✗|export|http_req_duration|http_reqs|checks|iteration_duration' || true
	summarize "$RESULTS/$stamp-memory.csv" "$RESULTS/$stamp-backend.log"
	return "$status"
}

case "${1:-}" in
	up) "${COMPOSE[@]}" up -d --build --wait ;;
	seed) "${COMPOSE[@]}" exec -T db psql -q -U locale -d locale <"$LOAD_DIR/seed-export.sql" ;;
	run)
		[[ " ${SCENARIOS[*]} " == *" ${2:-} "* ]] || {
			echo "Usage: $0 run <${SCENARIOS[*]}>" >&2
			exit 2
		}
		run_scenario "$2"
		;;
	all)
		failed=0
		for scenario in "${SCENARIOS[@]}"; do
			run_scenario "$scenario" || failed=1
		done
		exit "$failed"
		;;
	down) "${COMPOSE[@]}" down -v ;;
	*)
		echo "Usage: $0 up|seed|run <${SCENARIOS[*]}>|all|down" >&2
		exit 2
		;;
esac
