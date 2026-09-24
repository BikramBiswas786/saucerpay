import { NextResponse } from "next/server";
import { listInvoices, serializeInvoice } from "~~/utils/publicEscrow";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const merchant = url.searchParams.get("merchant")?.toLowerCase();
  const status = url.searchParams.get("status");
  const origin = `${url.protocol}//${url.host}`;
  const { nextInvoiceId, invoices } = await listInvoices(40);
  let items = invoices.map(({ id, row }) => serializeInvoice(id, row, origin));
  if (merchant) items = items.filter(i => i.merchant.toLowerCase() === merchant);
  if (status) items = items.filter(i => i.statusLabel.toLowerCase() === status.toLowerCase());
  return NextResponse.json(
    { network: "hedera-testnet", chainId: 296, nextInvoiceId, count: items.length, invoices: items },
    { headers: cors },
  );
}
