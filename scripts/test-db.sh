#!/usr/bin/env bash
# Runs the Supabase migrations, seed and RLS tests on a throwaway local Postgres.
# Needs: brew install postgresql@17. Creates and deletes a temp database cluster; touches nothing else.
set -euo pipefail
export LC_ALL=en_US.UTF-8 # Postgres refuses to start on macOS without a valid locale

PG=${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
PORT=${PG_TEST_PORT:-54399}
cleanup() { "$PG/pg_ctl" -D "$DATA" stop -m fast >/dev/null 2>&1 || true; rm -rf "$DATA"; }
trap cleanup EXIT

"$PG/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PG/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA -c listen_addresses=''" -l "$DATA/log" start -w >/dev/null

psql() { "$PG/psql" -h "$DATA" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

psql -f "$ROOT/supabase/tests/auth_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migration: $(basename "$f")"; psql -f "$f"; done
# Supabase grants table access to these roles by default; RLS then decides which rows they see.
psql -c "grant usage on schema public to anon, authenticated, service_role;
         grant all on all tables in schema public to anon, authenticated, service_role;
         grant execute on all functions in schema public to anon, authenticated, service_role;"
echo "seed: seed.sql"; psql -f "$ROOT/supabase/seed.sql"
psql -t -A -f "$ROOT/supabase/tests/rls_test.sql" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  /  /' -e '/^$/d' -e '/^BEGIN$\|^ROLLBACK$/d'
