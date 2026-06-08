#!/bin/bash
# ──────────────────────────────────────────────
# Skoolar — Database Initialization Script
# Runs on first PostgreSQL container start
# ──────────────────────────────────────────────
set -e

echo ">> Creating extensions..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- UUID generation (used by Prisma for CUIDs is client-side, so no extension needed)
    -- But enable these for any future needs:
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
EOSQL

echo ">> Database initialization complete."
