#!/bin/sh
set -eu

version=${1:-v1.0.0}
repository=${OAW_LOCAL_REPOSITORY:-jmfdz/validador-oaw-local}
url="https://github.com/${repository}/releases/download/${version}/validador_oaw.war"

echo "Descargando validador_oaw.war (${version})..."
curl --fail --location --output validador_oaw.war "$url"
echo "WAR descargado. Ya puedes construir la imagen Docker."

