# Validador OAW local

Distribución no oficial y simplificada del
[Validador OAW](https://github.com/ctt-gob-es/validador-oaw) para ejecutarlo
localmente mediante un único contenedor Docker.

Incluye Tomcat 9 con Java 8, Node.js 20, Chromium, un renderer JavaScript, el
proxy interno y un cliente web. Solo publica el puerto `7014`.

## Compatibilidad

- macOS Apple Silicon y macOS Intel.
- Linux ARM64 y AMD64.
- Windows ARM64 y AMD64 mediante Docker Desktop con contenedores Linux.

No hacen falta Dockerfiles diferentes: Docker selecciona automáticamente la
arquitectura adecuada.

## Puesta en marcha

Descarga el WAR publicado con la versión:

```bash
./descargar-war.sh
```

En PowerShell:

```powershell
Invoke-WebRequest `
  -Uri "https://github.com/jmfdz/validador-oaw-local/releases/download/v1.0.0/validador_oaw.war" `
  -OutFile "validador_oaw.war"
```

Construye la imagen:

```bash
docker build -t oaw-validator:local .
```

Arranca el contenedor:

```bash
docker run -d \
  --name oaw-validator \
  --shm-size=1g \
  -p 7014:7014 \
  oaw-validator:local
```

Espera a que esté saludable:

```bash
docker inspect --format '{{.State.Health.Status}}' oaw-validator
```

## Cliente web

Abre:

```text
http://localhost:7014/cliente/
```

El cliente admite varias URL, una por línea, y permite descargar los resultados
conjuntos en JSON y HTML. Es independiente del WAR y no modifica el código Java
del validador.

## API

Estado del servicio:

```bash
curl --fail http://localhost:7014/api/validation-request/status
```

Validación de prueba:

```bash
curl --location \
  'http://localhost:7014/api/validation-request/json' \
  --header 'Content-Type: application/json' \
  --data '{"content":"https://www.ua.es/"}'
```

## Operaciones habituales

```bash
docker logs -f oaw-validator
docker stop oaw-validator
docker start oaw-validator
docker rm -f oaw-validator
```

## Arquitectura

```text
Tomcat / Validador OAW (:7014)
             │
             ▼
      Proxy Node (:7015)
             │
             ▼
 Renderer Chromium (:3000)
```

Los puertos `7015` y `3000` solo son internos. `supervisord` inicia y vigila los
tres procesos. No se utiliza nginx y hay un único renderer.

## Actualizar el WAR

Para generar otro WAR, compila el repositorio oficial y copia el resultado:

```bash
git clone https://github.com/ctt-gob-es/validador-oaw.git
cd validador-oaw
./compile.sh
cp target/validador_oaw-*.war ../validador-oaw-local/validador_oaw.war
```

Después, vuelve a construir la imagen.

## Diferencias respecto al despliegue oficial

- Un único contenedor y un único renderer.
- Imágenes actuales disponibles para ARM64 y AMD64.
- Sin nginx ni puertos internos expuestos.
- Cliente web incluido.
- `User-Agent` de navegador para evitar falsos formatos no soportados.
- Tiempo del renderer adaptado al límite de lectura del WAR.

## Procedencia y licencia

Este proyecto no es oficial ni está afiliado al Observatorio de Accesibilidad
Web. Consulta [NOTICE.md](NOTICE.md) para conocer su procedencia y modificaciones.

Se distribuye bajo la [Licencia Pública de la Unión Europea 1.2](LICENSE.md). Las
dependencias incluidas conservan sus respectivas licencias.

