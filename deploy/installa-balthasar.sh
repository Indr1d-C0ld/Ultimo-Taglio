#!/usr/bin/env bash
# =============================================================================
# Balthasar — ospitalita' di ULTIMO TAGLIO, landing e bot (da root).
#
#   sudo bash ~/Claude/balthasar-ultimotaglio/installa.sh           # tutto
#   sudo bash ~/Claude/balthasar-ultimotaglio/installa.sh --solo-sito
#
# 1. Crea /var/www/html/ultimo-taglio di randolph:www-data e installa la configurazione
#    di Apache con autoprova; se la prova fallisce torna indietro.
# 2. Reinstalla la landing (card, interruttore, mappa del sito).
# 3. Aggiorna il bot Telegram (comando /ultimotaglio).
# =============================================================================
set -euo pipefail
[[ $EUID -eq 0 ]] || exec sudo bash "$0" "$@"
SRC="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
WEB=/var/www/html/ultimo-taglio
CONF=/etc/apache2/conf-available/ultimo-taglio.conf

echo "== cartella del sito =="
install -d -o randolph -g www-data -m 2775 "$WEB"
ls -ld "$WEB" | awk '{print "   " $1, $3":"$4, $NF}'

echo "== configurazione di Apache =="
PRIMA=""
[[ -f $CONF ]] && { PRIMA=$(mktemp); cp "$CONF" "$PRIMA"; }
install -o root -g root -m 0644 "$SRC/apache-ultimo-taglio.conf" "$CONF"
a2enconf -q ultimo-taglio
if apache2ctl configtest 2>&1 | grep -q "Syntax OK"; then
  systemctl reload apache2
  echo "   ultimo-taglio.conf attiva, Apache ricaricato"
else
  apache2ctl configtest || true
  if [[ -n $PRIMA ]]; then cp "$PRIMA" "$CONF"; else a2disconf -q ultimo-taglio; rm -f "$CONF"; fi
  echo "!! prova di Apache fallita: configurazione ritirata, niente ricaricato" >&2
  exit 1
fi
[[ ${1:-} == --solo-sito ]] && exit 0

echo "== landing (card, interruttore, mappa del sito) =="
bash /home/randolph/Claude/balthasar-landingpage/repo/installa.sh

echo "== bot Telegram (/ultimotaglio) =="
bash /home/randolph/Claude/balthasar-telegrambot/aggiorna-bot.sh
