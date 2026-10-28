const FRAMEWORK_DEPS = [
  ["next", "next"], ["react", "react"], ["react-dom", "react"], ["vue", "vue"], ["nuxt", "nuxt"],
  ["svelte", "svelte"], ["@sveltejs/kit", "sveltekit"], ["solid-js", "solid"], ["preact", "preact"],
  ["@angular/core", "angular"], ["astro", "astro"], ["@builder.io/qwik", "qwik"], ["react-native", "react-native"],
];
const BUILT_ON = [
  [/^(@radix-ui\/|radix-ui$)/, "radix"], [/^@base-ui(-components)?\/react$/, "base-ui"],
  [/^(react-aria|react-aria-components|@react-aria\/)/, "react-aria"], [/^@ark-ui\//, "ark-ui"],
  [/^@headlessui\//, "headless-ui"], [/^(motion|framer-motion)$/, "motion"], [/^gsap$/, "gsap"],
  [/^(three|@react-three\/fiber)$/, "three"], [/^lottie-(web|react)$|^@lottiefiles\//, "lottie"],
];
const LICENSES = [
  [/^mit$/i, "mit"], [/^apache-2\.0$/i, "apache-2.0"], [/^isc$/i, "isc"], [/^bsd/i, "bsd"], [/^mpl-2\.0$/i, "mpl-2.0"],
  [/^agpl/i, "agpl"], [/^(l?gpl)/i, "gpl"], [/^cc0/i, "cc0"], [/^cc-by-nc/i, "cc-by-nc"], [/^cc-by-sa/i, "cc-by-sa"],
  [/^cc-by/i, "cc-by"], [/^ofl/i, "ofl"], [/^unlicensed$/i, "proprietary"],
];

export function licenseSlug(spdx) {
  if (!spdx || spdx === "NOASSERTION" || spdx === "NONE") return null;
  return LICENSES.find(([re]) => re.test(spdx))?.[1] ?? null;
}

export function fromPackage(doc) {
  const latest = doc["dist-tags"]?.latest;
  const v = (latest && doc.versions?.[latest]) || {};
  const deps = { ...v.dependencies, ...v.peerDependencies };
  const names = Object.keys(deps);
  const framework = [...new Set(FRAMEWORK_DEPS.filter(([d]) => d in deps).map(([, f]) => f))];
  const tw = deps.tailwindcss;
  const twMajor = tw && (String(tw).match(/(\d+)/) || [])[1];
  const styling = tw ? [twMajor === "4" ? "tailwind-v4" : twMajor === "3" ? "tailwind-v3" : "tailwind-any"] : [];
  const builtOn = [...new Set(names.flatMap((n) => BUILT_ON.filter(([re]) => re.test(n)).map(([, b]) => b)))];
  const license = typeof v.license === "string" ? v.license : v.license?.type ?? (typeof doc.license === "string" ? doc.license : null);
  return {
    version: latest ?? null,
    license,
    licenseSlug: licenseSlug(license),
    framework,
    styling,
    builtOn,
    lastRelease: (latest && doc.time?.[latest]?.slice(0, 10)) || null,
    deprecated: Boolean(v.deprecated),
    repository: typeof v.repository === "string" ? v.repository : v.repository?.url ?? null,
  };
}

export function packageNames(record) {
  const out = new Set();
  if (record.package) for (const p of String(record.package).split(/[\s,]+/)) if (p) out.add(p);
  const cmd = String(record.install || "");
  for (const m of cmd.matchAll(/\b(?:npm (?:i|install)|pnpm (?:add|i)|yarn add|bun (?:add|i))\s+((?:-{1,2}[\w-]+\s+)*)([@\w][^\s&|;]*)/g)) {
    const name = m[2].replace(/(.)@[^/]*$/, "$1");
    if (/^(@[\w.-]+\/)?[\w.-]+$/.test(name)) out.add(name);
  }
  return [...out].filter((p) => /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/.test(p));
}

export function githubRepo(url) {
  const m = String(url || "").match(/^https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/#?]|$)/i);
  return m ? `${m[1]}/${m[2]}`.toLowerCase() : null;
}

export function itemUrl(registryUrl, name) {
  return registryUrl.replace(/[^/]+\.json(\?.*)?$/, `${name}.json`);
}

export function htmlText(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] ?? "";
  const description = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i) || [])[1] ?? "";
  const text = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const clean = (s) => s.replace(/\s+/g, " ").trim();
  return { title: clean(title), description: clean(description), text };
}
