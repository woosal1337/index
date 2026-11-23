
export const OA_EVENTS = {
  imageOpen: "image_open",
  imageStep: "image_step",
  imagePick: "image_pick",
  videoPlay: "video_play",
  boardSource: "board_source",
  searchOpen: "search_open",
  searchRun: "search_run",
  searchGo: "search_go",
  planeHome: "plane_home",
  toolsToggle: "tools_toggle",
  toolOpen: "tool_open",
  themeToggle: "theme_toggle",
  viewSwitch: "view_switch",
} as const;

export function eventProps(
  name: string,
  props?: Record<string, string | number | undefined>,
): Record<string, string> {
  const attrs: Record<string, string> = { "data-oa-event": name };
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value !== undefined && value !== "") {
      attrs[`data-oa-prop-${key.toLowerCase()}`] = String(value);
    }
  }
  return attrs;
}

export function linkHost(href: string): string | undefined {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

type Tracker = {
  track: (name: string, props?: Record<string, string | number | boolean>) => void;
};

export function track(name: string, props?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined") return;
  const oa = (window as unknown as { oa?: Partial<Tracker> }).oa;
  if (typeof oa?.track !== "function") return;
  try {
    oa.track(name, props);
  } catch {
  }
}
