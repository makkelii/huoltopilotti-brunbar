#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
db_test_name="huoltopilotti-db-${RANDOM}"
docker run --name "$db_test_name" --network none -e POSTGRES_HOST_AUTH_METHOD=trust -d postgres:16-alpine >/dev/null
trap 'docker rm -f "$db_test_name" >/dev/null' EXIT
for attempt in $(seq 1 30); do
  if docker exec "$db_test_name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/bootstrap.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610190001_core.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/tenant_isolation.sql
for migration in supabase/migrations/*private.sql; do
  docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < "$migration"
done
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610200003_history_tenancy.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610200004_tools_without_stock.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610200005_tool_stock_guard.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/upgrade_history_setup.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610200006_free_completion_usage.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/upgrade_history_assert.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/production_lines_upgrade_setup.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610200007_production_lines.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/production_lines_upgrade_assert.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610200008_planned_requirements.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/planned_requirements.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610200009_equipment_lifecycle.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/lifecycle.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/private.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/history.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/tool_stock_guard.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/free_usage.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/production_lines.sql
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/concurrency-setup.sql
mkdir -p work/db-tests
(docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/concurrency-owner.sql > work/db-tests/owner.log 2>&1) &
owner_process=$!
(docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/concurrency-tech.sql > work/db-tests/tech.log 2>&1) &
tech_process=$!
owner_result=0; tech_result=0
wait "$owner_process" || owner_result=$?
wait "$tech_process" || tech_result=$?
if { [ "$owner_result" -eq 0 ] && [ "$tech_result" -eq 0 ]; } || { [ "$owner_result" -ne 0 ] && [ "$tech_result" -ne 0 ]; }; then
  cat work/db-tests/owner.log work/db-tests/tech.log
  echo "Expected exactly one concurrent completion to succeed"; exit 1
fi
grep -q 'stale revision' work/db-tests/*.log
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/concurrency-assert.sql
echo "PostgreSQL tenant, invitation, shared-data and concurrent inventory tests passed"

# A manager assigning equipment races a line archive; the revision lock must select one winner.
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/line-concurrency-setup.sql
(docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/line-concurrency-archive.sql > work/db-tests/line-archive.log 2>&1) &
archive_process=$!
(docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/line-concurrency-assign.sql > work/db-tests/line-assign.log 2>&1) &
assign_process=$!
archive_result=0; assign_result=0
wait "$archive_process" || archive_result=$?
wait "$assign_process" || assign_result=$?
if { [ "$archive_result" -eq 0 ] && [ "$assign_result" -eq 0 ]; } || { [ "$archive_result" -ne 0 ] && [ "$assign_result" -ne 0 ]; }; then
  cat work/db-tests/line-archive.log work/db-tests/line-assign.log
  echo "Expected exactly one line archive/assignment to succeed"; exit 1
fi
grep -q 'stale revision' work/db-tests/line-*.log
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/line-concurrency-assert.sql
echo "PostgreSQL production-line isolation, upgrade and concurrent assignment tests passed"

# New job creation and archiving the same device must share the organization lock.
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/lifecycle-concurrency-setup.sql
(docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/lifecycle-concurrency-archive.sql > work/db-tests/lifecycle-archive.log 2>&1) &
lifecycle_archive_process=$!
(docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/lifecycle-concurrency-job.sql > work/db-tests/lifecycle-job.log 2>&1) &
lifecycle_job_process=$!
lifecycle_archive_result=0; lifecycle_job_result=0
wait "$lifecycle_archive_process" || lifecycle_archive_result=$?
wait "$lifecycle_job_process" || lifecycle_job_result=$?
if { [ "$lifecycle_archive_result" -eq 0 ] && [ "$lifecycle_job_result" -eq 0 ]; } || { [ "$lifecycle_archive_result" -ne 0 ] && [ "$lifecycle_job_result" -ne 0 ]; }; then
  cat work/db-tests/lifecycle-archive.log work/db-tests/lifecycle-job.log
  echo "Expected exactly one concurrent archive/job to succeed"; exit 1
fi
grep -q 'stale revision' work/db-tests/lifecycle-*.log
docker exec -i "$db_test_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/lifecycle-concurrency-assert.sql
echo "PostgreSQL lifecycle, role, dependency and concurrent archive/job tests passed"
