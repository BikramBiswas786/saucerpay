import { NextResponse } from "next/server";
import { readInvoice, serializeInvoice } from "~~/utils/publicEscrow";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

export async function OPTIONS() {
  return new NextResponse(null, { headers: cors });
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: "id must be an integer" }, { status: 400, headers: cors });
  const origin = new URL(req.url).origin;
  try {
    const row = await readInvoice(BigInt(id));
    const invoice = serializeInvoice(BigInt(id), row, origin);
    if (invoice.merchant === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404, headers: cors });
    }
    return NextResponse.json(
      {
        invoice,
        pay: {
          chainId: 296,
          to: "0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3",
          function: "payInvoice",
          valueWei: invoice.tokenLabel === "HBAR" ? invoice.amount : "0",
          args: [id, "receipt"],
        },
      },
      { headers: cors },
    );
  } catch {
    return NextResponse.json({ error: "Read failed" }, { status: 502, headers: cors });
  }
}
