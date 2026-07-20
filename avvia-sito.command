#!/bin/bash
# Avvio locale Confesercenti Pavia — doppio click per partire
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "⚠️  Node.js non trovato. Scaricalo da https://nodejs.org (versione LTS), poi riprova."
  read -p "Premi invio per chiudere..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 Prima installazione dipendenze (solo la prima volta)..."
  npm install --no-audit --no-fund || { read -p "Errore npm install. Premi invio..."; exit 1; }
fi

echo ""
echo "✅ Sito in avvio:"
echo "   → Sito:  http://localhost:3000"
echo "   → Admin: http://localhost:3000/admin"
echo ""
echo "   (per fermare: Ctrl+C o chiudi questa finestra)"
echo ""

( sleep 2; open "http://localhost:3000"; sleep 1; open "http://localhost:3000/admin" ) &
npm start
