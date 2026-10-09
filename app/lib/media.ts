export const MEDIA_VERSION = "20261009";

export function ogImageUrl(key: string): string {
  return `/og/${key}.webp?v=${MEDIA_VERSION}`;
}
