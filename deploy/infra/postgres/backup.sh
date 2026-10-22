#!/bin/sh
# Dumps every non-template database once a day into /backups/<date>/, then prunes.
set -eu
while true; do
  stamp=$(date +%Y-%m-%d)
  mkdir -p "/backups/$stamp"
  for db in $(psql -Atc "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres'"); do
    pg_dump -Fc "$db" > "/backups/$stamp/$db.dump.tmp" && mv "/backups/$stamp/$db.dump.tmp" "/backups/$stamp/$db.dump"
  done
  pg_dumpall --globals-only > "/backups/$stamp/globals.sql"
  echo "backup $stamp done"
  find /backups -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} +
  sleep 86400
done
