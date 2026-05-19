#!/usr/bin/env bash
# Ensure host TCP connections to maintenance_postgres accept DATABASE_URL password.
# Docker maps 5433→5432; external clients use scram-sha-256 (not container-local trust).
set -euo pipefail

CONTAINER="${MAINTENANCE_POSTGRES_CONTAINER:-maintenance_postgres}"
PGPORT="${MAINTENANCE_PGPORT:-5433}"
PGUSER="${MAINTENANCE_PGUSER:-postgres}"
PGPASSWORD="${MAINTENANCE_PGPASSWORD:-password}"
PGDATABASE="${MAINTENANCE_PGDATABASE:-maintenance_db}"

if ! docker ps --format '{{.Names}}' | grep -qx "${CONTAINER}"; then
  echo "ensure-postgres-password: container ${CONTAINER} is not running" >&2
  exit 1
fi

if docker run --rm --network host -e PGPASSWORD="${PGPASSWORD}" postgres:16-alpine \
  psql -h 127.0.0.1 -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c 'SELECT 1' >/dev/null 2>&1; then
  exit 0
fi

echo "ensure-postgres-password: syncing postgres role password in ${CONTAINER}..."
docker exec "${CONTAINER}" psql -U "${PGUSER}" -c "ALTER USER ${PGUSER} WITH PASSWORD '${PGPASSWORD}';"
