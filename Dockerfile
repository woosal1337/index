FROM node:24-alpine AS build
WORKDIR /app

ARG NEXT_PUBLIC_SITE_URL=""

ARG S3_BUCKET=""

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

RUN --mount=type=secret,id=S3_ENDPOINT,env=S3_ENDPOINT \
    --mount=type=secret,id=S3_BUCKET,env=S3_BUCKET \
    --mount=type=secret,id=S3_ACCESS_KEY_ID,env=S3_ACCESS_KEY_ID \
    --mount=type=secret,id=S3_SECRET_ACCESS_KEY,env=S3_SECRET_ACCESS_KEY \
    set -eu; \
    if [ -n "${S3_ACCESS_KEY_ID:-}${S3_SECRET_ACCESS_KEY:-}${S3_ENDPOINT:-}${S3_BUCKET:-}" ]; then \
      : "${S3_ENDPOINT:?Set the S3 endpoint.}" \
        "${S3_BUCKET:?Set the S3 bucket.}" \
        "${S3_ACCESS_KEY_ID:?Set the S3 access key.}" \
        "${S3_SECRET_ACCESS_KEY:?Set the S3 secret key.}"; \
      apk add --no-cache rclone >/dev/null; \
      export RCLONE_CONFIG_MEDIA_TYPE=s3 \
             RCLONE_CONFIG_MEDIA_PROVIDER=Minio \
             RCLONE_CONFIG_MEDIA_ENDPOINT="$S3_ENDPOINT" \
             RCLONE_CONFIG_MEDIA_REGION=us-east-1 \
             RCLONE_CONFIG_MEDIA_FORCE_PATH_STYLE=true \
             RCLONE_CONFIG_MEDIA_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" \
             RCLONE_CONFIG_MEDIA_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"; \
      for d in og shots tpl; do \
        rclone copy "media:$S3_BUCKET/site/$d" "public/$d" \
          --checksum --transfers 16 --stats-one-line --stats 30s; \
      done; \
      echo "media files fetched: $(find public/og public/shots public/tpl -type f | wc -l)"; \
    else \
      echo "No S3 credentials set. The build uses local media or placeholders."; \
    fi

RUN npm run build

FROM nginx:1.30.4-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/out /usr/share/nginx/html
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
