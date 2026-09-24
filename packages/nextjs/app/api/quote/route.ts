import { NextResponse } from "next/server";

const SAUCER_BOOKS = "https://testnet-orderbook-api.saucerswap.finance/books";
const MIRROR_RATE = "https://testnet.mirrornode.hedera.com/api/v1/network/exchangerate";

type Book = {
  id: string;
  baseTokenSymbol: string;
  quoteTokenSymbol: string;
  quotePrice: string;
  status: string;
};

export async function GET() {
  let dex: { bookId: string; hbarUsd: number; status: string } | null = null;
  try {
    const res = await fetch(SAUCER_BOOKS, { next: { revalidate: 20 } });
    if (res.ok) {
      const body = (await res.json()) as { orderbooks?: Book[] };
      const book = body.orderbooks?.find(
        b => b.baseTokenSymbol === "HBAR" && b.quoteTokenSymbol === "USDC" && Number(b.quotePrice) > 0,
      );
      if (book) {
        dex = { bookId: book.id, hbarUsd: Number(book.quotePrice), status: book.status };
      }
    }
  } catch {
    /* use official rate */
  }

  const rateRes = await fetch(MIRROR_RATE, { next: { revalidate: 20 } });
  if (!rateRes.ok) {
    return NextResponse.json({ error: "Could not load Hedera network rate" }, { status: 502 });
  }
  const rate = (await rateRes.json()) as {
    current_rate: { cent_equivalent: number; hbar_equivalent: number };
  };
  const officialHbarUsd = rate.current_rate.cent_equivalent / 100 / rate.current_rate.hbar_equivalent;
  const dexUsable = Boolean(dex && dex.status !== "CLOSED" && dex.hbarUsd > 0 && dex.hbarUsd < 10);
  const hbarUsd = dexUsable && dex ? dex.hbarUsd : officialHbarUsd;

  return NextResponse.json({
    hbarUsd,
    officialHbarUsd,
    settlementSource: dexUsable ? "saucerswap-orderbook" : "hedera-network-exchangerate",
    dex,
    saucerswapDocs: "https://docs.saucerswap.finance/api-reference/orderbook/overview",
  });
}
