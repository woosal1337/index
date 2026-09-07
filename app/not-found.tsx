import Shell from "./_components/Shell";
import { PLink } from "./_components/primitives";

export default function NotFound() {
  return (
    <Shell title="Not found">
      <section className="pb-6 pt-2">
        <p className="label mb-4">404</p>
        <h1 className="title">
          Nothing at this address.
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] text-fg-3">
          The record may have moved, or the slug changed when the taxonomy did.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <PLink href="/">Browse the index</PLink>
          <PLink href="/categories">Categories</PLink>
        </div>
      </section>
    </Shell>
  );
}
