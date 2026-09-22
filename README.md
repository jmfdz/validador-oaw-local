# Validador OAW local

Esta es una distribución no oficial y simplificada del
[Validador OAW](https://github.com/ctt-gob-es/validador-oaw). Está pensada para
probar páginas web y documentos PDF en un equipo personal sin tener que desplegar
todos los contenedores del proyecto original.

Todo se ejecuta en un único contenedor Docker y la aplicación solo publica el
puerto `7014`.

## Qué incluye

- La API original del Validador OAW.
- Tomcat 9 y Java 8 para ejecutar el WAR oficial.
- Node.js 20, Chromium y un renderer para analizar contenido generado con JavaScript.
- Un único proxy y un único renderer.
- Un cliente web para validar varias URL o subir un PDF.
- Descarga conjunta de resultados en JSON y HTML.

El cliente está disponible en:

```text
http://localhost:7014
```

La dirección raíz redirige automáticamente a `/cliente/`, por lo que también
puedes abrir directamente `http://localhost:7014/cliente/`.

## Diferencias respecto al proyecto oficial

| Aspecto | Proyecto oficial | Validador OAW local |
| --- | --- | --- |
| Contenedores | Tomcat, proxy, nginx y tres renderers | Un único contenedor |
| Renderers | Tres instancias | Una instancia, suficiente para pruebas locales |
| nginx | Necesario en su composición | No se utiliza |
| Node.js | Imagen antigua con Node.js 9 | Node.js 20 sobre Debian |
| Chromium | Alpine antiguo | Paquete actual de Debian |
| Arquitecturas | Algunas imágenes no funcionan en ARM64 | ARM64 y AMD64 |
| Puertos públicos | Varios componentes en la composición | Solo `7014` |
| Cliente web | No incluido | URL múltiples, PDF y exportación JSON/HTML |

El validador realiza una comprobación inicial del tipo de contenido antes de
analizar una URL. Java utiliza un `User-Agent` de navegador para reducir respuestas
alternativas de servicios como Cloudflare —por ejemplo, un `text/plain` o un
bloqueo dirigido al cliente Java— que podrían confundirse con un formato no
soportado. Esto no evita las protecciones legítimas del sitio: solo hace la petición
inicial más parecida a la de un navegador normal.

No se ha modificado el código Java del Validador OAW.

## Requisitos

Solo necesitas Docker:

- En Windows o macOS, instala y abre [Docker Desktop](https://www.docker.com/products/docker-desktop/).
- En Linux, instala Docker Engine y el complemento Docker Compose.
- En Windows, Docker Desktop debe utilizar contenedores Linux, que es su modo habitual.

Funciona en macOS, Windows y Linux, tanto en equipos ARM64 como AMD64. No hacen
falta dos Dockerfiles: Docker selecciona la arquitectura adecuada.

## Instalación sencilla en macOS o Linux

Abre Terminal y ejecuta:

```bash
git clone https://github.com/jmfdz/validador-oaw-local.git
cd validador-oaw-local
./descargar-war.sh
docker compose up -d --build
```

La primera construcción tarda varios minutos porque Docker descarga Java, Node.js
y Chromium. Las siguientes suelen ser mucho más rápidas.

Cuando termine, abre:

```text
http://localhost:7014
```

## Instalación sencilla en Windows

1. Abre el menú Inicio, escribe `PowerShell` y abre **Windows PowerShell** o
   **Terminal**.
2. Descarga el repositorio con Git:

```powershell
git clone https://github.com/jmfdz/validador-oaw-local.git
cd validador-oaw-local
```

Si no tienes Git, en GitHub puedes usar **Code → Download ZIP**, descomprimir el
archivo y abrir PowerShell dentro de esa carpeta.

3. Descarga el WAR:

```powershell
.\descargar-war.ps1
```

Si Windows no permite ejecutar el script, utiliza este comando equivalente:

```powershell
curl.exe -fL "https://github.com/jmfdz/validador-oaw-local/releases/download/v1.0.0/validador_oaw.war" -o "validador_oaw.war"
```

4. Construye y arranca el contenedor:

```powershell
docker compose up -d --build
```

5. Abre `http://localhost:7014` en el navegador.

## Por qué hay que descargar un WAR

El WAR es la aplicación Java ya compilada. Se genera desde el código fuente del
proyecto oficial del Validador OAW y después se copia dentro de la imagen Docker.

No está guardado directamente en Git porque ocupa unos 141 MB y GitHub no permite
archivos de ese tamaño en un repositorio normal. La versión comprobada se publica
como archivo de la [Release v1.0.0](https://github.com/jmfdz/validador-oaw-local/releases/tag/v1.0.0).

Los scripts `descargar-war.sh` y `descargar-war.ps1` descargan ese mismo archivo y
lo guardan con el nombre que espera el Dockerfile: `validador_oaw.war`.

### Generarlo desde el proyecto oficial

Este paso es opcional y está dirigido a quien quiera compilar el código Java por
su cuenta:

```bash
git clone https://github.com/ctt-gob-es/validador-oaw.git
cd validador-oaw
./compile.sh
cp target/validador_oaw-*.war ../validador-oaw-local/validador_oaw.war
```

Después vuelve a la carpeta `validador-oaw-local` y ejecuta:

```bash
docker compose up -d --build
```

## Uso del cliente web

El formulario permite:

- escribir una o varias URL, una por línea;
- seleccionar un PDF local de hasta 25 MB;
- validar URL y PDF en la misma operación;
- consultar un resumen y navegar hasta el detalle de cada resultado;
- descargar el informe completo en JSON o HTML.

El PDF se codifica en Base64 en el navegador y se envía únicamente a la API que se
está ejecutando en tu propio contenedor. El contenido del PDF no se incluye en los
informes descargados.

Las validaciones se realizan de forma secuencial para no sobrecargar el único
renderer local.

## Comandos habituales

Ver el estado:

```bash
docker compose ps
```

Ver los logs:

```bash
docker compose logs -f
```

Parar el contenedor sin eliminarlo:

```bash
docker compose stop
```

Volver a arrancarlo:

```bash
docker compose start
```

Eliminar el contenedor:

```bash
docker compose down
```

Reconstruirlo después de actualizar los archivos:

```bash
docker compose up -d --build
```

El archivo `compose.yaml` fija automáticamente:

- nombre del contenedor: `validador-oaw-local`;
- nombre de la imagen: `validador-oaw-local:local`;
- puerto público: `7014`;
- memoria compartida para Chromium: 1 GB.

Por eso no es necesario escribir esos parámetros a mano.

## Uso sin Docker Compose

También se puede utilizar Docker directamente:

```bash
docker build -t validador-oaw-local:local .

docker run -d \
  --name validador-oaw-local \
  --shm-size=1g \
  -p 7014:7014 \
  validador-oaw-local:local
```

En este caso, los comandos habituales son:

```bash
docker logs -f validador-oaw-local
docker stop validador-oaw-local
docker start validador-oaw-local
docker rm -f validador-oaw-local
```

## Comprobar la API

Estado del servicio:

```bash
curl --fail http://localhost:7014/api/validation-request/status
```

Validación de una URL:

```bash
curl --location \
  'http://localhost:7014/api/validation-request/json' \
  --header 'Content-Type: application/json' \
  --data '{"content":"https://www.ua.es/"}'
```

En PowerShell puedes usar `curl.exe` con los mismos parámetros.

## Arquitectura simplificada

```text
Navegador / API
       │
       ▼ :7014
Tomcat y Validador OAW
       │
       ▼ :7015 (interno)
Proxy Node.js
       │
       ▼ :3000 (interno)
Renderer Chromium
```

`supervisord` inicia y vigila Tomcat, el proxy y el renderer. Los puertos `7015` y
`3000` no se publican fuera del contenedor.

## Solución de problemas

Si el cliente no abre todavía, comprueba el estado y espera a que aparezca
`healthy`:

```bash
docker inspect --format '{{.State.Health.Status}}' validador-oaw-local
```

Si el puerto `7014` ya está ocupado, detén el programa que lo utiliza antes de
arrancar el validador. Los errores de Tomcat, Chromium y el proxy aparecen juntos
en `docker compose logs -f`.

## Procedencia y licencia

Este proyecto no es oficial ni está afiliado al Observatorio de Accesibilidad Web.
Consulta [NOTICE.md](NOTICE.md) para conocer su procedencia y modificaciones.

Se distribuye bajo la [Licencia Pública de la Unión Europea 1.2](LICENSE.md). Las
dependencias incluidas conservan sus respectivas licencias.
