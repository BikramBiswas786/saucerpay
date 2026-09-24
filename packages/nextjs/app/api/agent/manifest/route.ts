import { NextResponse } from "next/server";

const ESCROW = "0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3";

export async function GET() {
  return NextResponse.json({
    name: "SaucerPay",
    version: "1.0.0",
    chainId: 296,
    network: "hedera-testnet",
    rpc: "https://testnet.hashio.io/api",
    explorer: "https://hashscan.io/testnet",
    contract: {
      name: "InvoiceEscrow",
      address: ESCROW,
      hashscan: `https://hashscan.io/testnet/contract/${ESCROW}`,
      functions: ["createInvoice", "payInvoice", "withdraw", "cancelInvoice", "nextInvoiceId", "invoices"],
    },
    tools: [
      { name: "quoteHbarUsd", method: "GET", path: "/api/quote" },
      { name: "lookupHtsToken", method: "GET", path: "/api/hedera/token?id=0.0.x" },
      { name: "resolveHederaAccount", method: "GET", path: "/api/hedera/account?evm=0x" },
      { name: "stampHcsReceipt", method: "POST", path: "/api/hedera/receipt" },
    ],
    constraints: {
      exactAmount: true,
      hbarJsonRpcDecimals: 18,
      htsRequiresAllowance: true,
      walletMustBeHederaAccount: true,
    },
  });
}
