import { readFileSync } from "node:fs";
import { join } from "node:path";
import Shell from "../_components/Shell";
import { ImageIcon } from "../_components/icons";
import { PageHead } from "../_components/primitives";
import { pageMetadata } from "../lib/site";
import Mood from "./Mood";

export const metadata = pageMetadata(
  "/mood",
  "Mood",
  "An infinite plane of design reference from the designers, studios and galleries worth keeping.",
);

function counts(): { items: number; videos: number } {
  const file = join(process.cwd(), "public/mood/data/mood.json");
  return JSON.parse(readFileSync(file, "utf8")).counts;
}

export default function MoodPage() {
  const { items, videos } = counts();
  return (
    <Shell>
      <PageHead
        icon={<ImageIcon />}
        title="Mood"
        meta={`${items.toLocaleString("en-US")} items · ${videos.toLocaleString("en-US")} videos`}
        intro="Design reference from designers, studios, and galleries on one plane with no edge. Open an image to see its source."
      />
      <Mood rail />
    </Shell>
  );
}
