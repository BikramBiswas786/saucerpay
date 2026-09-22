import { NextResponse } from "next/server";

const MIRROR_TESTNET = process.env.HEDERA_MIRROR_TESTNET_URL ?? "https://testnet.mirrornode.hedera.com";

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^0\.0\.\d+$/.test(id)) {
    return NextResponse.json({ error: "Provide a Hedera token ID such as 0.0.1234" }, { status: 400 });
  }
  const response = await fetch(`${MIRROR_TESTNET}/api/v1/tokens/${id}`, { next: { revalidate: 30 } });
  if (!response.ok) return NextResponse.json({ error: "Token not found on Hedera testnet" }, { status: 404 });
  const token = await response.json();
  return NextResponse.json({ id: token.token_id, name: token.name, symbol: token.symbol, decimals: token.decimals, type: token.type, treasury: token.treasury_account_id });
}
