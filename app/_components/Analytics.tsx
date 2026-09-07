"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { analyticsEnabled, linkEvent, OA_COLLECTOR_URL, OA_TRACKING_KEY, track } from "../lib/analytics";

export default function Analytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!analyticsEnabled(window.location.hostname, process.env.NODE_ENV)) return;
    setEnabled(true);
    const onClick = (event: MouseEvent) => {
      if (event.type === "click" ? event.button !== 0 : event.button !== 1) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      const action = linkEvent(anchor.getAttribute("href") || "", window.location.origin);
      if (action) track(action.name, action.properties);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("auxclick", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("auxclick", onClick, true);
    };
  }, []);

  if (!enabled) return null;

  return (
    <Script
      id="openanalytics"
      strategy="afterInteractive"
      src={`${OA_COLLECTOR_URL}/oa.js`}
      data-key={OA_TRACKING_KEY}
      data-collector={OA_COLLECTOR_URL}
      data-respect-dnt="true"
      data-respect-gpc="true"
    />
  );
}
