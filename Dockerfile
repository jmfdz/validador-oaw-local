FROM tomcat:9.0-jre8-temurin-jammy AS tomcat-runtime

FROM node:20-bookworm-slim

LABEL org.opencontainers.image.title="Validador OAW local" \
      org.opencontainers.image.description="Distribución no oficial y simplificada del Validador OAW" \
      org.opencontainers.image.source="https://github.com/jmfdz/validador-oaw-local" \
      org.opencontainers.image.licenses="EUPL-1.2"

ENV JAVA_HOME=/opt/java/openjdk \
    CATALINA_HOME=/usr/local/tomcat \
    PATH=/opt/java/openjdk/bin:/usr/local/tomcat/bin:${PATH}

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        chromium \
        curl \
        fonts-liberation \
        openssl \
        supervisor \
    && rm -rf /var/lib/apt/lists/*

COPY --from=tomcat-runtime /opt/java/openjdk /opt/java/openjdk
COPY --from=tomcat-runtime /usr/local/tomcat /usr/local/tomcat

RUN rm -rf /usr/local/tomcat/webapps/* \
    && sed -i 's/port="8080" protocol="HTTP\/1.1"/port="7014" protocol="HTTP\/1.1"/' /usr/local/tomcat/conf/server.xml \
    && mkdir -p /opt/oaw/config /opt/oaw/proxy /opt/oaw/renderer /opt/oaw/tls /var/log/supervisor \
    && openssl req -x509 -newkey rsa:2048 -nodes \
        -keyout /opt/oaw/tls/proxy.key \
        -out /opt/oaw/tls/proxy.crt \
        -days 3650 \
        -subj '/CN=localhost' \
    && chown -R node:node /opt/oaw/renderer

COPY renderer/package.json /opt/oaw/renderer/package.json
RUN cd /opt/oaw/renderer \
    && npm install --omit=dev --no-audit --no-fund \
    && npm cache clean --force \
    && chown -R node:node /opt/oaw/renderer

COPY --chown=node:node renderer/server.js /opt/oaw/renderer/server.js
COPY proxy/index.js /opt/oaw/proxy/index.js
COPY config/external.properties /opt/oaw/config/external.properties
COPY config/oaw-validadorTrust.jks /opt/oaw/config/oaw-validadorTrust.jks
COPY validador_oaw.war /usr/local/tomcat/webapps/ROOT.war
COPY client/ /usr/local/tomcat/webapps/cliente/
COPY supervisord.conf /etc/supervisor/conf.d/oaw-validator.conf

RUN sed -i 's/^proxy\.renderer\.host\s*=.*/proxy.renderer.host = 127.0.0.1/' /opt/oaw/config/external.properties \
    && sed -i 's#^server\.ssl\.key\s*=.*#server.ssl.key = /opt/oaw/config/oaw-validadorTrust.jks#' /opt/oaw/config/external.properties

EXPOSE 7014

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
    CMD curl --fail --silent http://127.0.0.1:7014/api/validation-request/status >/dev/null \
        && supervisorctl status renderer | grep -q RUNNING \
        && supervisorctl status proxy | grep -q RUNNING \
        && supervisorctl status tomcat | grep -q RUNNING \
        || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
