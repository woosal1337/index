#!/bin/bash

set -euo pipefail

REMOTE="${S3_REMOTE:-media}"
BUCKET="${S3_BUCKET:?Set S3_BUCKET to the media bucket.}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v rclone >/dev/null 2>&1; then
  echo "rclone is not installed. See https://rclone.org/install/" >&2
  exit 1
fi

if ! rclone lsd "$REMOTE:$BUCKET" >/dev/null 2>&1; then
  echo "Cannot read $REMOTE:$BUCKET. Configure the remote first:" >&2
  echo "  rclone config create $REMOTE s3 provider=Minio \\" >&2
  echo "    access_key_id=… secret_access_key=… endpoint=http://<host>:9100 \\" >&2
  echo "    region=us-east-1 force_path_style=true" >&2
  exit 1
fi

for dir in og shots tpl; do
  echo "--> public/$dir"
  rclone copy "$REMOTE:$BUCKET/site/$dir" "$ROOT/public/$dir" \
    --checksum --transfers 16 --stats 10s --stats-one-line
done

echo "Media is ready. Files:"
for dir in og shots tpl; do
  printf '  public/%-6s %s\n' "$dir" "$(find "$ROOT/public/$dir" -type f | wc -l | tr -d ' ')"
done
