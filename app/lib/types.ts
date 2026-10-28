export type Tier = "S" | "A" | "B" | "C";

export interface Template {
  name: string;
  url: string;
  purpose?: string;
  shot?: string;
  w?: number | null;
  h?: number | null;
  visual?: VisualTags;
}

export interface VisualTags {
  pageType: string | null;
  sections: string[];
  style: string[];
  density: string | null;
  imagery: string[];
}

export interface VisualCss {
  colorMode: "light" | "dark";
  background: string | null;
  text: string | null;
  accent: string | null;
  headingFont: string | null;
  bodyFont: string | null;
  buttonRadius: string | null;
}

export interface Article {
  author: string;
  authorName: string;
  title: string;
  takeaways: string[];
  topics: string[];
  metrics: { likes: number; retweets: number; views: number; bookmarks: number };
  postedAt: string | null;
  kind: string | null;
}

export interface Resource {
  id: string;
  slug: string;
  url: string;
  domain: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  subcategory: string;
  kinds: string[];
  facets: Record<string, string[] | string>;
  components: string[];
  componentCount: number | null;
  surfaces: string[];
  templates: Template[];
  templateCount: number | null;
  install: string | null;
  pkg: string | null;
  docsUrl: string | null;
  repoUrl: string | null;
  registryUrl: string | null;
  machineUrls: { kind: string; url: string }[];
  sameAs: string | null;
  partOf: string | null;
  summary: string | null;
  aliases: string[];
  useCases: string[];
  notFor: string[];
  exampleQueries: string[];
  profile: Record<string, unknown>;
  scope: string | null;
  builtOn: string[];
  visual: (Partial<VisualTags> & Partial<VisualCss>) | null;
  signals: {
    stars: number | null;
    weeklyDownloads: number | null;
    lastRelease: string | null;
    pushedAt: string | null;
    archived: boolean;
    deprecated: boolean;
    checked: string | null;
  };
  github: { stars?: number | null; license?: string | null; last_activity?: string | null };
  pricingDetail: string | null;
  counts: Record<string, number | null>;
  agentGuidance: string;
  whyItMatters: string;
  tier: Tier;
  notableFor: string[];
  httpStatus: number | null;
  verifiedAt: string | null;
  evidence: string;
  imageKey: string;
  hasImage: boolean;
  ogImage: string | null;
  favicon: string | null;
  savedAt: string | null;
  source: "bookmark" | "depo" | "canon";
  article?: Article;
  instagram?: {
    author: string;
    type: string;
    takeaways: string[];
    topics: string[];
    metrics: { likes: number; comments: number };
    postedAt: string | null;
  };
}

export interface BoardImage {
  id: string;
  thumb: string;
  full: string;
  isVideo: boolean;

  video?: string | null;
  w?: number | null;
  h?: number | null;
  fromQuoted?: boolean;
}

export interface Board {
  id: string;
  slug: string;
  author: string | null;
  authorName: string | null;
  text: string;
  topic: string;
  tweetUrl: string | null;
  postedAt: string | null;
  savedAt: string;
  metrics: { likes: number; retweets: number; views: number; bookmarks: number };
  images: BoardImage[];
  imageCount: number;
  fetched: boolean;
}

export interface Indexes {
  byComponent: Record<string, string[]>;
  bySurface: Record<string, string[]>;
  facetCounts: Record<string, Record<string, number>>;
  categoryCounts: Record<string, number>;
}

export interface Stats {
  resources: number;
  fromCollection: number;
  added: number;
  canon: number;
  templates: number;
  showcaseSites?: number;
  showcaseShots?: number;
  showcaseTypefaces?: number;
  componentsTagged: number;
  surfacesTagged: number;
  categories: number;
  vocabComponents: number;
  vocabSurfaces: number;
  items?: number;
  itemsInstallable?: number;
  generatedAt: string;
}

export interface Category {
  slug: string;
  name: string;
  description: string;
  agent_hint: string;
  icon_hint?: string;
  estimated_count?: number;
  subcategories: { slug: string; name: string; description: string }[];
}
