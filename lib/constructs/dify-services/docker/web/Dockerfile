# Reuse the official 1.13.3 application without a Dify/DB migration.
# Both sources are pinned to the linux/amd64 manifests used by WebService.
FROM langgenius/dify-web:1.13.3@sha256:9a1ef685559559416b45e41bb07faee1740535de307e3a2c0534c225eb43b985 AS application
FROM node:22.23.4-alpine3.23@sha256:9fee3a1d85a49993660c8ffc774ceafadc0b52eda69b4c981f6b6a1cfabcfe98

LABEL org.opencontainers.image.source="https://github.com/kodato-dev/kodato-dify-self-hosted-on-aws" \
      org.opencontainers.image.version="1.13.3-node22.23.4" \
      org.opencontainers.image.description="Dify 1.13.3 Web with the October 2026 Node.js security fixes"

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_PUBLIC_BASE_PATH="" \
    NODE_ENV=production \
    EDITION=SELF_HOSTED \
    DEPLOY_ENV=PRODUCTION \
    CONSOLE_API_URL=http://127.0.0.1:5001 \
    APP_API_URL=http://127.0.0.1:5001 \
    MARKETPLACE_API_URL=https://marketplace.dify.ai \
    MARKETPLACE_URL=https://marketplace.dify.ai \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=UTC \
    COMMIT_SHA=59639ca9b2ba2ba4b32b5feff5149cfc1ad0ba74

RUN apk add --no-cache tzdata \
    && ln -snf /usr/share/zoneinfo/UTC /etc/localtime \
    && echo UTC > /etc/timezone \
    && addgroup -S -g 1001 dify \
    && adduser -S -u 1001 -G dify -s /bin/ash -h /home/dify dify \
    && mkdir /app \
    && chown dify:dify /app

COPY --from=application --chown=dify:dify /app/web /app/web
COPY --chmod=755 runtime-entrypoint.sh /usr/local/bin/dify-web-runtime

USER dify
WORKDIR /app/web
RUN node -e 'if (process.version !== "v22.23.4") process.exit(1)'
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/dify-web-runtime"]
