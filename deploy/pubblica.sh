#!/usr/bin/env bash
# =============================================================================
# ULTIMO TAGLIO — build e pubblicazione su Balthasar, sotto /ultimo-taglio/.
#
#   bash deploy/pubblica.sh            # build + rsync + verifica
#   bash deploy/pubblica.sh --prova    # build e rsync a secco (--dry-run)
#
# Prima volta: cartella e Apache li prepara, su Balthasar,
#   sudo bash ~/Claude/balthasar-ultimotaglio/installa.sh
# Il build ha base relativa: non serve dirgli il percorso.
# =============================================================================
set -euo pipefail
cd "$(dirname "$(readlink -f "$0")")/.."

HOST=${ULTIMO_TAGLIO_HOST:-balthasar}
DEST=${ULTIMO_TAGLIO_DEST:-/var/www/html/ultimo-taglio}
URL=${ULTIMO_TAGLIO_URL:-https://timrouter.dns.army/ultimo-taglio/}
DRY=""; [[ ${1:-} == --prova ]] && DRY="--dry-run"

echo "== build =="
npm run build --silent

VERSION=$(node -p "require('./package.json').version")
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
SPORCO=$([[ -n $(git status --porcelain 2>/dev/null) ]] && echo true || echo false)
cat > dist/version.json <<JSON
{"name":"Ultimo Taglio","version":"$VERSION","commit":"$COMMIT","dirty":$SPORCO,"built":"$(date -Iseconds)"}
JSON
echo "   versione $VERSION ($COMMIT$([[ $SPORCO == true ]] && echo ', modifiche non committate'))"

echo "== rsync verso $HOST:$DEST =="
rsync -rltz --delete --delay-updates $DRY \
  --chmod=D2775,F0664 \
  --exclude '.DS_Store' \
  dist/ "$HOST:$DEST/"

[[ -n $DRY ]] && exit 0
echo "== verifica =="
code=$(curl -s -o /dev/null -w '%{http_code}' "$URL")
ver=$(curl -s "${URL}version.json" | node -pe 'JSON.parse(require("fs").readFileSync(0)).commit' 2>/dev/null || echo "?")
glb=$(curl -s -o /dev/null -w '%{http_code} %{content_type}' "${URL}models/valigetta.glb")
echo "   $URL → HTTP $code, commit pubblicato $ver; modello valigetta: $glb"
[[ $code == 200 && $ver == "$COMMIT" ]]
