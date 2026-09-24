import { createPublicClient, formatEther, http, zeroAddress, type Address } from "viem";

export const ESCROW = "0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3" as const;
export const HASHIO = "https://testnet.hashio.io/api";
export const STATUS = ["Open", "Paid", "Cancelled"] as const;

export const escrowAbi = [
  {
    type: "function",
    name: "nextInvoiceId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "invoices",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "merchant", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "paidAmount", type: "uint256" },
      { name: "dueAt", type: "uint64" },
      { name: "status", type: "uint8" },
      { name: "metadataHash", type: "bytes32" },
    ],
  },
] as const;

export function hederaPublicClient() {
  return createPublicClient({
    chain: {
      id: 296,
      name: "Hedera Testnet",
      nativeCurrency: { name: "HBAR", symbol: "HBAR", decimals: 18 },
      rpcUrls: { default: { http: [HASHIO] }, public: { http: [HASHIO] } },
    },
    transport: http(HASHIO),
  });
}

export type PublicInvoice = {
  id: string;
  merchant: Address;
  token: Address;
  tokenLabel: string;
  amount: string;
  amountHbar: string | null;
  paidAmount: string;
  dueAt: string;
  status: number;
  statusLabel: string;
  metadataHash: `0x${string}`;
  payUrl: string;
};

export function serializeInvoice(id: bigint, row: readonly unknown[], origin = ""): PublicInvoice {
  const merchant = row[0] as Address;
  const token = row[1] as Address;
  const amount = row[2] as bigint;
  const paidAmount = row[3] as bigint;
  const dueAt = row[4] as bigint;
  const status = Number(row[5]);
  const metadataHash = row[6] as `0x${string}`;
  const isHbar = token.toLowerCase() === zeroAddress;
  return {
    id: id.toString(),
    merchant,
    token,
    tokenLabel: isHbar ? "HBAR" : token,
    amount: amount.toString(),
    amountHbar: isHbar ? formatEther(amount) : null,
    paidAmount: paidAmount.toString(),
    dueAt: dueAt.toString(),
    status,
    statusLabel: STATUS[status] ?? String(status),
    metadataHash,
    payUrl: `${origin}/invoice/${id.toString()}`,
  };
}

export async function readInvoice(id: bigint) {
  const client = hederaPublicClient();
  return client.readContract({
    address: ESCROW,
    abi: escrowAbi,
    functionName: "invoices",
    args: [id],
  });
}

export async function listInvoices(limit = 25) {
  const client = hederaPublicClient();
  const next = await client.readContract({ address: ESCROW, abi: escrowAbi, functionName: "nextInvoiceId" });
  const count = Number(next);
  const take = Math.min(limit, count);
  const ids = Array.from({ length: take }, (_, i) => BigInt(count - 1 - i));
  const rows = await Promise.all(ids.map(id => readInvoice(id)));
  return { nextInvoiceId: count, invoices: ids.map((id, i) => ({ id, row: rows[i] })) };
}
