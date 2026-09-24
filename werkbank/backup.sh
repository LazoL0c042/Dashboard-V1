#!/usr/bin/env bash
# Konsistente Sicherung der Datenbank (auch während der Server läuft).
# Täglich per cron: 0 3 * * * /pfad/zu/werkbank/backup.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
sqlite3 data/brain.db ".backup backups/brain-$(date +%F).db"
ls -1t backups/brain-*.db | tail -n +31 | xargs -r rm   # 30 Tage behalten
