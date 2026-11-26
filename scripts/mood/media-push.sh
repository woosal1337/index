#!/usr/bin/env bash
set -euo pipefail

: "${S3_ENDPOINT:?set S3_ENDPOINT}"
: "${S3_ACCESS_KEY_ID:?set S3_ACCESS_KEY_ID}"
: "${S3_SECRET_ACCESS_KEY:?set S3_SECRET_ACCESS_KEY}"
BUCKET="${S3_BUCKET:-mood-media}"

cd "$(dirname "$0")/../.."

export RCLONE_CONFIG_MEDIA_TYPE=s3
export RCLONE_CONFIG_MEDIA_PROVIDER=Cloudflare
export RCLONE_CONFIG_MEDIA_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_MEDIA_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_MEDIA_ENDPOINT="$S3_ENDPOINT"
export RCLONE_CONFIG_MEDIA_REGION=auto
export RCLONE_CONFIG_MEDIA_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_MEDIA_FORCE_PATH_STYLE=true

echo "▸ pushing public/media → media:${BUCKET}/media"
rclone copy public/media "media:${BUCKET}/media" \
  --transfers 48 --checkers 48 --s3-chunk-size 16M \
  --stats 20s --stats-one-line

# Each file must be 25 MiB or less: Cloudflare static assets refuse larger files.
big=$(find public/media -type f -size +24M)
if [ -n "$big" ]; then echo "Compress these files to 24 MiB or less first:" >&2; echo "$big" >&2; exit 1; fi

echo "▸ verifying"
rclone check public/media "media:${BUCKET}/media" --size-only --one-way 2>&1 | tail -2
