#!/bin/sh
set -e

echo "Iniciando nginx para servir dist/"
exec nginx -g "daemon off;"
