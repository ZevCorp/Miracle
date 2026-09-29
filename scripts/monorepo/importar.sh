#!/usr/bin/env bash
# Trae Graph, Android y el portal clínico al monorepo, cada uno en su carpeta y con su historia entera.
#
# Así entraron el 2026-09-28, y sirve de nuevo mientras los repos de origen sigan recibiendo pushes:
# git filter-repo es DETERMINISTA —misma entrada, mismas opciones, mismos hashes—, así que lo que ya
# se importó sale idéntico y un segundo pase solo trae los commits nuevos. Se comprobó dos veces
# antes de usarlo: 79 refs, todas iguales entre pases.
#
# Por eso las opciones de filter-repo de abajo NO se tocan: cambiar una sola reescribe la historia
# entera con otros hashes, y el siguiente merge dejaría de ser una sincronización para ser un
# segundo import duplicado.
#
# Uso (desde la raíz del repo):
#     bash scripts/monorepo/importar.sh
#     git switch -c jose/sincroniza-graph origin/main
#     git merge importado/graph/main            # y PR, como todo
#
# Las ramas de origen quedan en importado/<carpeta>/<rama>, que son refs locales: no se empujan.

set -euo pipefail

REPOS=(
  "graph    joseph1356k/Graph"
  "android  ZevCorp/Android"
  "web      joseph1356k/Pagina-web-clientes-final"
)

if ! git filter-repo --version > /dev/null 2>&1; then
  echo "falta git-filter-repo:  pip install --user git-filter-repo"
  echo "(en Windows, además, su carpeta Scripts tiene que estar en el PATH)"
  exit 1
fi

raiz="$(git rev-parse --show-toplevel)"
trabajo="$(mktemp -d "${TMPDIR:-/tmp}/u-importar.XXXXXX")"
trap 'rm -rf "$trabajo"' EXIT

for linea in "${REPOS[@]}"; do
  read -r dir repo <<< "$linea"
  echo "── $repo → $dir/"
  git clone --quiet --bare "https://github.com/$repo.git" "$trabajo/$dir.git"

  # Tres cosas, y solo tres:
  #  · todo a $dir/, con las etiquetas prefijadas ($dir-...) para que no choquen entre repos;
  #  · «:» en un nombre de archivo pasa a «_». Windows no puede escribirlo y git se niega a
  #    importarlo; hubo uno en Graph (LLMProvider.js,toolAction:…), del 6 al 13 de mayo, y ya se
  #    había borrado precisamente por romper los clones en Windows;
  #  · «#N» en un mensaje pasa a «$repo#N». Aquí #N sería el PR N de ESTE repo, que es otro, y
  #    GitHub llenaría esos PRs de referencias falsas. No toca colores (#2F8CFF) ni «#8hex».
  git -C "$trabajo/$dir.git" filter-repo --quiet --force \
    --to-subdirectory-filter "$dir" \
    --tag-rename ":$dir-" \
    --filename-callback 'return filename.replace(b":", b"_")' \
    --message-callback "import re
return re.sub(rb'(?<![\w/#&])#(\d+)\b', rb'$repo#\1', message)"

  git -C "$raiz" fetch --quiet --no-tags "$trabajo/$dir.git" "+refs/heads/*:refs/remotes/importado/$dir/*"
  git -C "$raiz" fetch --quiet "$trabajo/$dir.git" "+refs/tags/*:refs/tags/*"

  nuevos="$(git -C "$raiz" rev-list --count "HEAD..importado/$dir/main")"
  echo "   main de $repo: $(git -C "$raiz" rev-parse --short "importado/$dir/main") · $nuevos commit(s) que HEAD no tiene"
done
