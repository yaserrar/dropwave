#!/bin/sh
# Runs once, on the first start of an empty Postgres volume.
# One login role per app, owning its own database. Apps never use the superuser.
set -eu

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  -v dropwave_pw="$DROPWAVE_DB_PASSWORD" <<'SQL'
CREATE ROLE dropwave LOGIN PASSWORD :'dropwave_pw';
CREATE DATABASE dropwave OWNER dropwave;

-- Nobody but the owner may connect.
REVOKE CONNECT ON DATABASE dropwave FROM PUBLIC;
SQL
