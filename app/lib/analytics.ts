export const OA_COLLECTOR_URL = "https://oa-c.chele.bi";
export const OA_TRACKING_KEY = "oa_pk_5XQe5h09WDDejRLrlDSGElS-L-Fcp96l";

export const OA_EVENTS = {
  resourceOpen: "resource_open",
  outbound: "outbound_click",
  apiOpen: "api_open",
  windowOpen: "window_open",
  searchOpen: "search_open",
  searchSelect: "search_select",
  promptCopy: "prompt_copy",
  viewSwitch: "view_switch",
  filterChange: "filter_change",
  themeToggle: "theme_toggle",
} as const;

type EventName = (typeof OA_EVENTS)[keyof typeof OA_EVENTS];
type Properties = Record<string, string | number | boolean>;
type Tracker = {
  track: (name: EventName, properties?: Properties) => void;
  flush: () => void;
};

export function analyticsEnabled(hostname: string, environment: string | undefined): boolean {
  return environment === "production" && hostname === "index.chele.bi";
}

export function linkEvent(href: string, origin: string): { name: EventName; properties: Properties } | null {
  try {
    const url = new URL(href, origin);
    if (!["https:", "http:"].includes(url.protocol)) return null;
    if (url.origin !== origin) {
      return { name: OA_EVENTS.outbound, properties: { host: url.hostname.replace(/^www\./, "") } };
    }
    const resource = url.pathname.match(/^\/r\/([a-z0-9-]+)\/?$/);
    if (resource) return { name: OA_EVENTS.resourceOpen, properties: { resource: resource[1] } };
    if (/^\/api\/[a-z-]+\.json$/.test(url.pathname) || url.pathname === "/llms.txt") {
      return { name: OA_EVENTS.apiOpen, properties: { path: url.pathname } };
    }
  } catch {

  }
  return null;
}

export function track(name: EventName, properties?: Properties): void {
  if (typeof window === "undefined" || !analyticsEnabled(window.location.hostname, process.env.NODE_ENV)) return;
  try {
    const tracker = (window as unknown as { oa?: Partial<Tracker> }).oa;
    if (typeof tracker?.track !== "function") return;
    tracker.track(name, properties);
    if ((name === OA_EVENTS.outbound || name === OA_EVENTS.apiOpen) && typeof tracker.flush === "function") {
      tracker.flush();
    }
  } catch {

  }
}
