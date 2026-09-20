# Procedencia y modificaciones

Este proyecto es una distribución comunitaria y no oficial del
[Validador OAW](https://github.com/ctt-gob-es/validador-oaw), publicado por el
Centro de Transferencia de Tecnología del Gobierno de España.

El WAR distribuido en las versiones de este repositorio se genera a partir del
commit `820c8430cacbd13b4b6aad6b1264c347af97635f` del proyecto original.

Modificaciones realizadas en septiembre de 2026 por José María Fernández
(`jmfdz`):

- empaquetado de Tomcat, Java, proxy, renderer y Chromium en un único contenedor;
- actualización de las imágenes y dependencias base para ARM64 y AMD64;
- configuración interna del proxy y del renderer sin nginx;
- incorporación de un cliente web local para realizar validaciones y exportar resultados;
- ajustes de compatibilidad para páginas protegidas y tiempos de renderizado.

No se ha modificado el código Java contenido en el WAR. Los nombres OAW,
Observatorio de Accesibilidad Web y Gobierno de España se utilizan únicamente
para identificar la procedencia del software. Este proyecto no está afiliado ni
respaldado oficialmente por sus autores originales.

El software original y esta distribución se proporcionan bajo la EUPL 1.2. Las
dependencias de terceros conservan sus respectivas licencias y avisos.

