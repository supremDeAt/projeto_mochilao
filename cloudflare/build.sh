#!/usr/bin/env bash
# =====================================================
# O MOCHILÃO — build do site para o Cloudflare Pages
#
# O site não precisa de compilação: este script só COPIA para a pasta
# "dist" os ficheiros que o público deve ver. Ficam de fora os ficheiros
# de trabalho (scripts de configuração, notas, regras, servidor de
# pagamentos, documentos e ficheiros do sistema).
#
# Cloudflare Pages → Settings → Build:
#   Build command:          bash cloudflare/build.sh
#   Build output directory: dist
# =====================================================
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=dist
rm -rf "$OUT"
mkdir -p "$OUT"

# Páginas, estilos e scripts do site
cp index.html "$OUT/"
cp -R PAGES STYLES "$OUT/"
mkdir -p "$OUT/SCRIPT"
for f in SCRIPT/*.js; do
  case "$(basename "$f")" in
    # Scripts só de configuração ou que já não são usados
    init-firestore.js|custom-trip.js|site-apparence.js|*" ("*")"*.js) ;;
    *) cp "$f" "$OUT/SCRIPT/" ;;
  esac
done

# Imagens e tipos de letra: só ficheiros de imagem / vídeo / fonte
copy_media() {
  local dir="$1"
  [ -d "$dir" ] || return 0
  find "$dir" -type f \( \
      -iname '*.webp' -o -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o \
      -iname '*.gif' -o -iname '*.svg' -o -iname '*.ico' -o -iname '*.avif' -o \
      -iname '*.mp4' -o -iname '*.webm' -o \
      -iname '*.woff' -o -iname '*.woff2' -o -iname '*.ttf' -o -iname '*.otf' \
    \) -print0 | while IFS= read -r -d '' f; do
      mkdir -p "$OUT/$(dirname "$f")"
      cp "$f" "$OUT/$f"
    done
}
copy_media imagens
copy_media fonts

# Configuração do Cloudflare Pages (cabeçalhos de segurança, página 404)
cp cloudflare/_headers "$OUT/_headers"
cp cloudflare/404.html "$OUT/404.html"

echo "✓ Site pronto em $OUT/ ($(find "$OUT" -type f | wc -l) ficheiros)"
