import Link from "next/link";
import type { CSSProperties } from "react";
import type { Tier } from "../lib/types";
import { tierLabel } from "../lib/text";
import { ArrowUpRightIcon } from "./icons";

export function catStyle(slug: string): CSSProperties {
  return { "--dot": `var(--cat-${slug}, var(--muted-fg))` } as CSSProperties;
}

export function PLink({
  href,
  children,
  external,
  strong,
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  external?: boolean;
  strong?: boolean;
  onClick?: () => void;
}) {
  const cls = `link${strong ? " strong" : ""}`;
  if (!href) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>
        {children}
        <ArrowUpRightIcon className="h-3 w-3" />
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
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
  ghost,
  sm,
  disabled,
  className = "",
  ariaExpanded,
  ariaControls,
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
  ghost?: boolean;
  sm?: boolean;
  disabled?: boolean;
  className?: string;
  ariaExpanded?: boolean;
  ariaControls?: string;
}) {
  const cls = `btn${active ? " is-active" : ""}${solid ? " solid" : ""}${ghost ? " is-ghost" : ""}${sm ? " sm" : ""} ${className}`.trim();
  const style = dot ? catStyle(dot) : undefined;
  const inner = (
    <>
      {dot && <span className="dot" aria-hidden />}
      {children}
      {n != null && <span className="n">{typeof n === "number" ? n.toLocaleString() : n}</span>}
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
      aria-controls={ariaControls}
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
  dot,
  muted,
}: {
  children: React.ReactNode;
  href?: string;
  title?: string;
  n?: number;
  dot?: string;
  muted?: boolean;
}) {
  const cls = `tag${muted ? " muted" : ""}`;
  const style = dot ? catStyle(dot) : undefined;
  const inner = (
    <>
      {dot && <span className="dot" aria-hidden />}
      {children}
      {n != null && <span className="n">{n.toLocaleString()}</span>}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls} title={title} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <span className={cls} title={title} style={style}>
      {inner}
    </span>
  );
}

export function TierBadge({ tier, lg, className = "" }: { tier: Tier; lg?: boolean; className?: string }) {
  return (
    <span
      className={`tier${lg ? " lg" : ""} ${className}`.trim()}
      data-tier={tier}
      title={`Quality tier ${tier}: ${tierLabel(tier)}`}
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
      <h2 id={id}>{label}</h2>
      {meta != null && <span className="meta">{meta}</span>}
    </div>
  );
}

export function PageHead({
  title,
  intro,
  meta,
  icon,
  children,
}: {
  title: React.ReactNode;
  intro?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-head">
      {icon && (
        <span className="page-icon" aria-hidden>
          {icon}
        </span>
      )}
      <div className="page-head-text">
        <h1 className="page-title">{title}</h1>
        {meta && <p className="page-count">{meta}</p>}
        {intro && <p className="page-sub">{intro}</p>}
        {children && <div className="page-actions">{children}</div>}
      </div>
    </header>
  );
}

export function Breadcrumb({ trail, current }: { trail: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {trail.map((t) => (
        <span key={t.href} className="flex items-center gap-1.5">
          <Link href={t.href}>{t.label}</Link>
          <span aria-hidden>/</span>
        </span>
      ))}
      <span className="current">{current}</span>
    </nav>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
