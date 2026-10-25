#!/usr/bin/env bash
set -euo pipefail

APP_DIRECTORY="${1:?Kullanım: install-backup-cron.sh /opt/kocluk}"
BACKUP_DIRECTORY="${2:-$APP_DIRECTORY/backups}"
CRON_FILE="${3:-$APP_DIRECTORY/.backup-env}"

mkdir -p "$BACKUP_DIRECTORY"
if [[ ! -f "$CRON_FILE" ]]; then
  echo "PGHOST=localhost" > "$CRON_FILE"
  echo "PGPORT=5432" >> "$CRON_FILE"
  echo "PGDATABASE=kocluk" >> "$CRON_FILE"
  echo "PGUSER=kocluk" >> "$CRON_FILE"
  echo "PGPASSWORD=change-this" >> "$CRON_FILE"
  chmod 600 "$CRON_FILE"
  echo "Önce $CRON_FILE dosyasını güvenli parolayla doldurun." >&2
  exit 1
fi
chmod 600 "$CRON_FILE"
(crontab -l 2>/dev/null | grep -v "backup-postgres.sh" || true; echo "15 2 * * * cd $APP_DIRECTORY && set -a && . $CRON_FILE && set +a && ./scripts/backup-postgres.sh $BACKUP_DIRECTORY 30 >> $BACKUP_DIRECTORY/backup.log 2>&1") | crontab -
echo "Günlük PostgreSQL backup cron görevi kuruldu."
