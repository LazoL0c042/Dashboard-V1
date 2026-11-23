#!/usr/bin/env bash
# Sichert die Datenbank (konsistent, auch während die App läuft). Behält 30 Sicherungen.
# Täglich per cron:  15 3 * * * /home/ubuntu/Dashboard-V1/kompass/backup.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
sqlite3 data/kompass.db ".backup backups/kompass-$(date +%F).db"
ls -1t backups/kompass-*.db | tail -n +31 | xargs -r rm --
echo "Backup: backups/kompass-$(date +%F).db"
