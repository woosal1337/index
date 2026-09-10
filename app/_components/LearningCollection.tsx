import Link from "next/link";
import type { LearningTrack } from "../lib/learning";
import type { Resource } from "../lib/types";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default function LearningCollection({
  track,
  resources,
}: {
  track: LearningTrack;
  resources: Map<string, Resource>;
}) {
  return (
    <section className="learning-track" aria-labelledby={`${track.id}-title`}>
      <header className="learning-track-head">
        <div>
          <h2 id={`${track.id}-title`} className="heading-24">
            {track.title}
          </h2>
          <p className="learning-track-description">{track.description}</p>
        </div>
        <p className="learning-outcome">
          <span>After this path</span>
          {track.outcome}
        </p>
      </header>

      <ol className="learning-list">
        {track.items.map((item, index) => {
          const resource = resources.get(item.slug);
          if (!resource) throw new Error(`Learning resource not found: ${item.slug}`);

          return (
            <li key={item.slug} className="learning-item">
              <div className="learning-step">
                <span aria-hidden>{String(index + 1).padStart(2, "0")}</span>
                <span>{item.step}</span>
              </div>

              <div className="learning-copy">
                <h3>{resource.name}</h3>
                <p className="learning-summary">{resource.tagline}</p>

                <p className="learning-use">{item.useWhen}</p>

                <h4>Take with you</h4>
                <ul className="learning-takeaways">
                  {item.takeaways.map((takeaway) => (
                    <li key={takeaway}>{takeaway}</li>
                  ))}
                </ul>

                <div className="learning-actions">
                  <a href={resource.url} target="_blank" rel="noreferrer noopener">
                    {item.sourceLinkLabel}
                  </a>
                  <Link href={`/r/${resource.slug}`}>View the catalog record</Link>
                </div>
              </div>

              <dl className="learning-meta">
                <div>
                  <dt>Author</dt>
                  <dd>{item.author}</dd>
                </div>
                <div>
                  <dt>Published</dt>
                  <dd>
                    <time dateTime={item.publishedAt}>{dateFormatter.format(new Date(`${item.publishedAt}T00:00:00Z`))}</time>
                  </dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{item.publication}</dd>
                </div>
              </dl>

              <details className="learning-details">
                <summary>
                  <span className="learning-details-label">{item.details.label}</span>
                  <span className="learning-details-count">{item.details.countLabel}</span>
                </summary>

                <div className="learning-details-body">
                  <p className="learning-details-intro">{item.details.description}</p>

                  {item.details.groups.map((group, groupIndex) => {
                    const groupId = `${item.slug}-detail-${groupIndex}`;

                    return (
                      <section key={group.title} className="learning-detail-group" aria-labelledby={groupId}>
                        <header>
                          <h4 id={groupId}>{group.title}</h4>
                          <p>{group.description}</p>
                        </header>

                        <ol className="learning-detail-grid">
                          {group.points.map((point, pointIndex) => (
                            <li key={point.title} className="learning-detail-card">
                              <span className="learning-detail-index">
                                {point.index ?? String(pointIndex + 1).padStart(2, "0")}
                              </span>
                              <div>
                                <h5>{point.title}</h5>
                                <p>{point.explanation}</p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </section>
                    );
                  })}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
