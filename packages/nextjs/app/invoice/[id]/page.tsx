"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keccak256, toBytes, zeroAddress } from "viem";
import { useAccount, useChainId } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";
import { humanizeHederaError } from "~~/utils/scaffold-hbar/humanizeHederaError";

type Payload = {
  invoice?: {
    id: string;
    merchant: string;
    tokenLabel: string;
    amountHbar: string | null;
    amount: string;
    statusLabel: string;
    status: number;
  };
  pay?: { valueWei: string };
  error?: string;
};

export default function PublicInvoicePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const [data, setData] = useState<Payload | null>(null);
  const [msg, setMsg] = useState("");
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "InvoiceEscrow" });

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ error: "Failed to load invoice" }));
  }, [id]);

  const inv = data?.invoice;

  const pay = async () => {
    if (!inv || !data?.pay) return;
    if (!isConnected || chainId !== 296) {
      setMsg("Connect a funded Hedera testnet wallet (chain 296).");
      return;
    }
    if (inv.status !== 0) {
      setMsg(`Invoice is ${inv.statusLabel}.`);
      return;
    }
    try {
      setMsg("Confirm exact payment in the wallet…");
      const hash = await writeContractAsync({
        functionName: "payInvoice",
        args: [BigInt(id), keccak256(toBytes(`receipt-${id}`))],
        value: inv.tokenLabel === "HBAR" ? BigInt(data.pay.valueWei) : 0n,
      });
      setMsg(hash ? `Paid. ${hash}` : "Submitted.");
    } catch (e) {
      setMsg(humanizeHederaError(e));
    }
  };

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Public invoice</p>
      <h1 className="mt-2 text-3xl font-bold">Invoice #{id}</h1>
      <p className="mt-2 text-sm text-base-content/60">Anyone with this link can pay. No login — wallet only.</p>

      {!data && <p className="mt-8">Loading from Hedera…</p>}
      {data?.error && <p className="mt-8 text-error">{data.error}</p>}
      {inv && (
        <div className="mt-8 rounded-3xl border border-base-300 bg-base-100 p-6 shadow-sm">
          <p className="text-sm text-base-content/50">Amount due</p>
          <p className="mt-1 font-mono text-3xl font-semibold">
            {inv.amountHbar ? `${inv.amountHbar} ℏ` : inv.amount} {inv.tokenLabel}
          </p>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-base-content/50">Status</dt>
              <dd>{inv.statusLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-base-content/50">Merchant</dt>
              <dd className="break-all font-mono text-xs">{inv.merchant}</dd>
            </div>
          </dl>
          <button className="btn btn-primary mt-6 w-full" type="button" disabled={isMining || inv.status !== 0} onClick={pay}>
            {isMining ? "Confirming…" : inv.status === 0 ? "Pay exact amount" : inv.statusLabel}
          </button>
          {msg && <p className="mt-3 break-words text-sm">{msg}</p>}
        </div>
      )}
      <p className="mt-8 text-center text-sm">
        <Link href="/" className="link">
          All public invoices
        </Link>
      </p>
    </main>
  );
}
