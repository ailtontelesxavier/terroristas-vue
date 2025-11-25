#!/bin/sh
set -e

# Garante que o build exista antes de servir
if [ ! -d "dist" ]; then
  echo "dist/ não encontrado. Gerando build..."
  npm run build
else
  echo "dist/ encontrado. Usando build existente."
fi

exec "$@"
