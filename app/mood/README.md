<p align="center">
  <img src="public/apple-touch-icon.png" width="96" alt="mood">
</p>

# mood

Design reference on one infinite plane, live at [mood.chele.bi](https://mood.chele.bi). Built by [Ege Chelebi](https://www.chele.bi) ([@woosal1337](https://x.com/woosal1337)).

Images and video from designers, studios and galleries, laid out on a plane that pans in every direction and never reaches an edge. There is no header, no sidebar and no grid to scroll. You graze it, and open what stops you.

## Highlights

- Infinite in all four directions. One block of justified rows addressed with modular arithmetic, each wrapping on its own width and phase, so no repeat ever lines up into a seam.
- Two views on one plane, switched with `v`. Infinity is a justified mosaic. Grid is equal squares, neatly aligned.
- Three resolutions per image (192px, 480px, 1440px) that stack rather than swap, so a zoom never blanks a tile.
- One `requestAnimationFrame` loop owns the transform. Input never touches the DOM, so a pan costs one composited layer move.
- The viewer grows out of the tile you clicked, and `object-fit` never changes during the move.
- Search dims the plane instead of filtering it, because removing the misses would move the thing you were looking at.
- A collapsible rail of reference sites in liquid glass, and a nav bar that leaves on the first pan and returns at the top edge.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, static export
- Tailwind CSS 4 with a zero-chroma token layer in `app/globals.css`
- The system font stack for the sans (real SF on a Mac), JetBrains Mono self-hosted for the numbers
- Media on MinIO, self-hosted on igris, served from `media.chele.bi`
- Deployed on Vercel

No server, no database, no client-side dependency beyond React.

## Local setup

```bash
npm install
npm run dev
```

Media is not in this repository. Point at the bucket, or put your own files in `public/media/`:

```bash
NEXT_PUBLIC_MEDIA_BASE=https://media.chele.bi npm run dev
```

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run data` — rebuild the payload from `data/boards.json`
- `npm run ingest` — add files dropped in `media/incoming/`
- `npm run tool <url>` — add a site to the rail
- `npm run sheets` — contact sheets of everything, for review
- `npm run media:push` — sync `public/media/` to the media bucket

## How it is put together

`app/lib/plane.ts` holds the layout, the wrap and the visibility query, and is pure — no React, no DOM. `app/Canvas.tsx` owns the camera and the mounted tiles. `data/boards.json` is the one file to edit by hand. Everything under `public/data/` is generated.

[DESIGN.md](DESIGN.md) records why the interface refuses what it refuses. Read it before changing anything anyone sees.

## Credits

Every image belongs to the person who made it. Each record keeps its author and a link back to the source, and the viewer shows both. Work is gathered from X, [posts.design](https://posts.design), [seesaw.website](https://www.seesaw.website), [arc.cc](https://arc.cc) and Instagram.

If your work is here and you would rather it were not, open an issue and it comes down.

## License

Code is MIT. The archived images and videos are **not** covered by it. They belong to their original creators and are collected here as reference. See [LICENSE](LICENSE).
