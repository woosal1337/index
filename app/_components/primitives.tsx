import Link from "next/link";
import type { CSSProperties } from "react";
import type { Tier } from "../lib/types";
import { tierLabel } from "../lib/text";

export function PLink({
  href,
  children,
  external,
  strong,
  onClick,
}: {
  href?: string;
  children: string;
  external?: boolean;
  strong?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      (
      <span className="win">
        <span>{children}</span>
        <span aria-hidden>{children}</span>
      </span>
      )
    </>
  );
  const cls = `plink${strong ? " strong" : ""}`;
  if (!href) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

export function Btn({
  children,
  active,
  onClick,
  dot,
  n,
  title,
  href,
  external,
  solid,
  sm,
  disabled,
  className = "",
  ariaExpanded,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  dot?: string;
  n?: number | string;
  title?: string;
  href?: string;
  external?: boolean;
  solid?: boolean;
  sm?: boolean;
  disabled?: boolean;
  className?: string;
  ariaExpanded?: boolean;
}) {
  const cls = `btn${active ? " is-active" : ""}${solid ? " solid" : ""}${sm ? " sm" : ""} ${className}`;
  const style = dot ? ({ "--dot": `var(--cat-${dot}, var(--fg))` } as CSSProperties) : undefined;
  const inner = (
    <>
      {dot && <span className="dot" aria-hidden />}
      <span>{children}</span>
      {n != null && <span className="n">{typeof n === "number" ? n.toLocaleString() : n}</span>}
      {active && (
        <>
          <span className="corner tl" aria-hidden />
          <span className="corner tr" aria-hidden />
          <span className="corner br" aria-hidden />
          <span className="corner bl" aria-hidden />
        </>
      )}
    </>
  );
  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={cls} style={style} title={title}>
        {inner}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls} style={style} title={title}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cls}
      style={style}
      title={title}
      aria-pressed={active}
      aria-expanded={ariaExpanded}
      disabled={disabled}
    >
      {inner}
    </button>
  );
}

export function Tag({
  children,
  href,
  title,
  n,
}: {
  children: React.ReactNode;
  href?: string;
  title?: string;
  n?: number;
}) {
  return (
    <Btn href={href} sm title={title} n={n}>
      {children}
    </Btn>
  );
}

export function TierMark({ tier, className = "" }: { tier: Tier; className?: string }) {
  const bright = tier === "S" || tier === "A";
  return (
    <span
      title={`Quality tier ${tier}: ${tierLabel(tier)}`}
      className={`font-mono text-[12px] font-medium tabular-nums ${bright ? "text-fg-2" : "text-fg-4"} ${className}`}
    >
      {tier}
    </span>
  );
}

export function SectionHead({
  label,
  meta,
  id,
}: {
  label: React.ReactNode;
  meta?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="section-head">
      <h2 id={id} className="label text-fg-3">
        {label}
      </h2>
      {meta != null && <span className="label">{meta}</span>}
    </div>
  );
}

export function PageHead({
  title,
  intro,
  meta,
  children,
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-9">
      <h1 className="title">{title}</h1>
      {intro && <p className="prose mt-3 text-[15px] text-fg-3">{intro}</p>}
      {meta && <p className="label mt-3">{meta}</p>}
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

export function Breadcrumb({ trail, current }: { trail: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="mb-5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-fg-4" aria-label="Breadcrumb">
      {trail.map((t) => (
        <span key={t.href} className="flex items-center gap-1.5">
          <Link href={t.href} className="transition-colors hover:text-fg">
            {t.label}
          </Link>
          <span aria-hidden>/</span>
        </span>
      ))}
      <span className="text-fg-3">{current}</span>
    </nav>
  );
}

export function ExternalIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={`h-3 w-3 ${className}`}>
      <path
        d="M6 3h7v7M13 3 4 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="py-8 text-[15px] text-fg-3">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
