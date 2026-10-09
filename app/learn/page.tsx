import LearningCollection from "../_components/LearningCollection";
import Shell from "../_components/Shell";
import { PageHead } from "../_components/primitives";
import { BookIcon } from "../_components/icons";
import { getResources } from "../lib/data";
import { learningTracks } from "../lib/learning";
import { pageMetadata } from "../lib/site";

export const metadata = pageMetadata(
  "/learn",
  "Learn",
  "Curated reading paths for design practice, with source links, key lessons, and guidance for applying each resource.",
);

export default function LearnPage() {
  const resources = new Map(getResources().map((resource) => [resource.slug, resource]));
  const readings = learningTracks.reduce((total, track) => total + track.items.length, 0);

  return (
    <Shell>
      <PageHead
        icon={<BookIcon />}
        title="Learn"
        meta={`${learningTracks.length} learning ${learningTracks.length === 1 ? "path" : "paths"} · ${readings} readings`}
        intro="Practical reading for designers who build with AI. Each path explains what to read, why it matters, and what to apply."
      />

      <div className="grid gap-6">
        {learningTracks.map((track) => (
          <LearningCollection key={track.id} track={track} resources={resources} />
        ))}
      </div>
    </Shell>
  );
}
