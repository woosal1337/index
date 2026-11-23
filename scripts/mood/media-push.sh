#!/usr/bin/env bash
# Pushes public/media to the MinIO bucket behind media.chele.bi.
#
#     npm run media:push
#
# The bucket lives on igris, in the Coolify project `media`. The S3 port
# answers on the tailnet only, so you must be on the tailnet to run this.
#
# Needs rclone and three variables. Keep them out of this repo — read them from
# your secret store and export them for the one command:
#
#     S3_ENDPOINT  S3_ACCESS_KEY_ID  S3_SECRET_ACCESS_KEY
#
# The copy is incremental, so re-running after adding a few images moves only
# those images.
set -euo pipefail

: "${S3_ENDPOINT:?set S3_ENDPOINT}"
: "${S3_ACCESS_KEY_ID:?set S3_ACCESS_KEY_ID}"
: "${S3_SECRET_ACCESS_KEY:?set S3_SECRET_ACCESS_KEY}"
BUCKET="${S3_BUCKET:-moodboard-media}"

cd "$(dirname "$0")/.."

export RCLONE_CONFIG_MEDIA_TYPE=s3
export RCLONE_CONFIG_MEDIA_PROVIDER=Minio
export RCLONE_CONFIG_MEDIA_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
export RCLONE_CONFIG_MEDIA_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"
export RCLONE_CONFIG_MEDIA_ENDPOINT="$S3_ENDPOINT"
export RCLONE_CONFIG_MEDIA_REGION=us-east-1
export RCLONE_CONFIG_MEDIA_FORCE_PATH_STYLE=true

echo "▸ pushing public/media → media:${BUCKET}/media"
rclone copy public/media "media:${BUCKET}/media" \
  --transfers 48 --checkers 48 --s3-chunk-size 16M \
  --stats 20s --stats-one-line

echo "▸ verifying"
rclone check public/media "media:${BUCKET}/media" --size-only --one-way 2>&1 | tail -2
