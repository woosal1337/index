FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN npm ci --prefix server --omit=dev --no-audit --no-fund
COPY . .
RUN node scripts/webp-dims.mjs && node scripts/build-data.mjs && mkdir -p /data && chown node:node /data
ENV NODE_ENV=production PORT=8787 INDEX_DATA=/data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server/index.mjs"]
