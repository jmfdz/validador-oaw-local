param(
    [string]$Version = "v1.0.0"
)

$ErrorActionPreference = "Stop"
$Url = "https://github.com/jmfdz/validador-oaw-local/releases/download/$Version/validador_oaw.war"

Write-Host "Descargando validador_oaw.war ($Version)..."
Invoke-WebRequest -Uri $Url -OutFile "validador_oaw.war"
Write-Host "WAR descargado. Ya puedes construir la imagen Docker."

