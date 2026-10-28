import Link from "next/link";
import Shell from "../_components/Shell";
import RankedSection from "../_components/RankedSection";
import { StudioIcon } from "../_components/icons";
import { getCategories, getCategoryNames, getResources } from "../lib/data";
import { rankedGroups } from "../lib/ranked";
import { pageMetadata } from "../lib/site";

export const metadata = pageMetadata("/studios", "Studios",
  "Design studios and agencies, grouped by discipline and ranked by quality tier, as benchmarks for craft and positioning.");

export default function StudiosPage() {
  return (
    <Shell>
      <RankedSection
        title="Studios"
        icon={<StudioIcon />}
        unit={{ one: "studio", many: "studios" }}
        groups={rankedGroups(getResources(), getCategories(), "studios")}
        categoryNames={getCategoryNames()}
        intro={
          <>
            Design studios and agencies to benchmark craft, process, and positioning. Each discipline lists the best
            studios first. Personal designer sites are in <Link href="/portfolios" className="link">Portfolios</Link>.
          </>
        }
      />
    </Shell>
  );
}
