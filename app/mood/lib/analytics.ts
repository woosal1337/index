/**
 * Self-hosted Open Analytics (getopen.so), running on igris through Coolify.
 *
 * Four hostnames, because the dashboard, the api, the collector and the
 * realtime stream are four services and not four paths. Only the collector
 * appears in the page the visitor loads.
 *
 * `OA_TRACKING_KEY` is public on purpose. It is write-only: it names the site
 * an event belongs to and reads nothing back, so it ships in the HTML the same
 * way a Plausible domain or a GA measurement id does. The collector admits it
 * only from `mood.chele.bi`.
 */
export const OA_COLLECTOR_URL = "https://oa-c.chele.bi";
export const OA_API_URL = "https://oa-api.chele.bi";
export const OA_DASHBOARD_URL = "https://oa.chele.bi";
export const OA_TRACKING_KEY = "oa_pk_lEpejTP_dD3un4YSGX8eR4f83VljUgr9";

/**
 * Event names sent from this site.
 *
 * Written down in one place because the funnels and the reports in the
 * dashboard match on these strings: renaming one here without renaming it
 * there breaks a report quietly, months later.
 *
 * mood is one URL. The plane never navigates, so a pageview count answers
 * "how many people arrived" and nothing else. These events are what answer
 * "what did they do once the plane loaded".
 */
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

/**
 * Attributes that turn any element into a tracked click.
 *
 * The tracker reads `data-oa-event` and every `data-oa-prop-*` beside it on
 * click, walking up from the clicked node with `closest()`, so an event needs
 * no handler of its own.
 *
 * Property names must be lowercase: the HTML parser lowercases attribute names
 * before the tracker ever sees them, so `data-oa-prop-linkHost` would arrive as
 * `linkhost` and quietly disagree with whatever the dashboard was told to
 * expect.
 */
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

/**
 * The host an outbound link points at, or undefined when it is not a URL we
 * can read. The host and not the full URL: a path can carry a token or an
 * email, and the question this answers is "where does my traffic go".
 */
export function linkHost(href: string): string | undefined {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/**
 * Send an event that no click produced.
 *
 * Opening an image, stepping to the next one and toggling the theme all happen
 * through the keyboard as well as the pointer, and a wheel gesture on the plane
 * is not a click at all. `data-oa-event` cannot see any of those, so those call
 * this instead.
 *
 * Silent when the tracker is absent — the script is `async` and a blocker may
 * stop it altogether. An analytics call must never be the reason a button does
 * nothing.
 */
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
    // An analytics failure is never worth an exception in a click handler.
  }
}
