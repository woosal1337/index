import Shell from "./_components/Shell";
import { Btn } from "./_components/primitives";

export default function NotFound() {
  return (
    <Shell>
      <section className="mx-auto max-w-[48ch] py-20 text-center">
        <p className="mono text-[12px] text-fg-3">404</p>
        <h1 className="page-title mt-2">Nothing at this address.</h1>
        <p className="page-sub mx-auto">The record may have moved, or the slug changed when the taxonomy did.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Btn href="/" solid>
            Browse the index
          </Btn>
          <Btn href="/categories">Categories</Btn>
        </div>
      </section>
    </Shell>
  );
}
