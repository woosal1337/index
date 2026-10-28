import Link from "next/link";
import Shell from "../_components/Shell";
import RankedSection from "../_components/RankedSection";
import { PortfolioIcon } from "../_components/icons";
import { getCategories, getCategoryNames, getResources } from "../lib/data";
import { rankedGroups } from "../lib/ranked";
import { pageMetadata } from "../lib/site";

export const metadata = pageMetadata("/portfolios", "Portfolios",
  "Personal sites of individual designers, ranked by quality tier, as references for case studies, interaction work, and visual voice.");

export default function PortfoliosPage() {
  return (
    <Shell>
      <RankedSection
        title="Portfolios"
        icon={<PortfolioIcon />}
        unit={{ one: "portfolio", many: "portfolios" }}
        groups={rankedGroups(getResources(), getCategories(), "portfolios")}
        categoryNames={getCategoryNames()}
        intro={
          <>
            Personal sites of individual designers, kept as references for case studies, interaction work, and visual
            voice. The best portfolios come first. Studios and agencies are in <Link href="/studios" className="link">Studios</Link>.
          </>
        }
      />
    </Shell>
  );
}
