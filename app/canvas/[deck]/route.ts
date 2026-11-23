import { buildDeck, DECKS, type DeckName } from "../../lib/canvas";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return DECKS.map((name) => ({ deck: `${name}.json` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ deck: string }> }) {
  const name = (await params).deck.replace(/\.json$/, "") as DeckName;
  return Response.json(buildDeck(name));
}
