#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIRECTORY="${1:-./backups}"
RETENTION_DAYS="${2:-30}"
: "${PGPASSWORD:?PGPASSWORD ortam değişkeni tanımlı değil}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-kocluk}"
PGUSER="${PGUSER:-kocluk}"
export PGHOST PGPORT PGDATABASE PGUSER

mkdir -p "$OUTPUT_DIRECTORY"
stamp="$(date +%Y%m%d-%H%M%S)"
file="$OUTPUT_DIRECTORY/kocluk-$stamp.dump"
pg_dump --format=custom --file="$file"
test -s "$file"
find "$OUTPUT_DIRECTORY" -type f -name 'kocluk-*.dump' -mtime "+$RETENTION_DAYS" -delete
echo "Backup oluşturuldu: $file"
