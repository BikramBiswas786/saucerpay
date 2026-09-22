"use client";

import { FormEvent, useMemo, useState } from "react";
import type { NextPage } from "next";
import { parseEther, parseUnits } from "viem";
import { useAccount } from "wagmi";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

const toBytes32 = (value: string) => {
  const hex = Array.from(new TextEncoder().encode(value))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}` as `0x${string}`;
};

const Home: NextPage = () => {
  const { address, isConnected } = useAccount();
  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("1");
  const [decimals, setDecimals] = useState("8");
  const [metadata, setMetadata] = useState("invoice-demo");
  const [invoiceId, setInvoiceId] = useState("");
  const [receiptHash, setReceiptHash] = useState("");
  const [status, setStatus] = useState("");
  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "InvoiceEscrow" });

  const tokenAddress = useMemo(() => {
    if (!token.trim()) return ZERO;
    const raw = token.trim();
    if (raw.startsWith("0x")) return raw as `0x${string}`;
    const [shard, realm, num] = raw.split(".");
    if (shard !== "0" || realm !== "0" || !num || !/^\d+$/.test(num)) return undefined;
    return `0x${BigInt(num).toString(16).padStart(40, "0")}` as `0x${string}`;
  }, [token]);

  const createInvoice = async (event: FormEvent) => {
    event.preventDefault();
    if (!isConnected || !tokenAddress) return setStatus("Connect a wallet and enter a valid token ID or EVM address.");
    try {
      setStatus("Waiting for wallet confirmation…");
      const value = tokenAddress === ZERO ? parseEther(amount) : parseUnits(amount, Number(decimals));
      const hash = await writeContractAsync({
        functionName: "createInvoice",
        args: [tokenAddress, value, 0n, toBytes32(metadata)],
      });
      setStatus(`Invoice created. Transaction: ${hash ?? "submitted"}`);
      setInvoiceId("0");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transaction failed.");
    }
  };

  const payInvoice = async () => {
    if (!isConnected || !invoiceId) return setStatus("Connect a wallet and enter an invoice ID.");
    try {
      setStatus("Waiting for payment confirmation…");
      const hash = await writeContractAsync({
        functionName: "payInvoice",
        args: [BigInt(invoiceId), toBytes32(receiptHash || `receipt-${invoiceId}`)],
        ...(tokenAddress === ZERO ? { value: parseEther(amount) } : {}),
      });
      setStatus(`Payment submitted. Transaction: ${hash ?? "submitted"}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed.");
    }
  };

  return (
    <main className="min-h-screen bg-base-200 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <section className="mb-10 grid gap-8 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-primary">
              Scaffold-HBAR template
            </p>
            <h1 className="max-w-3xl text-5xl font-bold leading-tight md:text-7xl">Invoices that settle on Hedera.</h1>
            <p className="mt-6 max-w-2xl text-lg text-base-content/70">
              SaucerPay is a production-shaped starting point for invoices paid in HBAR or any HTS token, with escrow
              settlement, verifiable receipts, and Mirror Node metadata.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm">
              <span className="badge badge-primary badge-lg">HTS-compatible payments</span>
              <span className="badge badge-secondary badge-lg">HCS-ready receipts</span>
              <a className="btn btn-outline btn-sm" href="https://hashscan.io/testnet" target="_blank" rel="noreferrer">
                Open HashScan
              </a>
            </div>
          </div>
          <div className="rounded-3xl bg-neutral p-7 text-neutral-content shadow-xl">
            <p className="text-sm uppercase tracking-widest text-neutral-content/60">Connected wallet</p>
            <p className="mt-3 break-all font-mono text-sm">
              {address ?? "Not connected — use the wallet button above."}
            </p>
            <p className="mt-5 text-sm text-neutral-content/70">
              Deploy the contract, copy its address into the generated registry, then create your first testnet invoice.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={createInvoice} className="card border border-base-300 bg-base-100 shadow-xl">
            <div className="card-body gap-5">
              <div>
                <h2 className="card-title text-2xl">Create an invoice</h2>
                <p className="text-sm text-base-content/60">Use HBAR or provide an HTS token ID such as 0.0.1234.</p>
              </div>
              <label className="form-control">
                <span className="label-text">HTS token ID or EVM address</span>
                <input
                  className="input input-bordered"
                  placeholder="Leave blank for HBAR"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="form-control">
                  <span className="label-text">Amount</span>
                  <input className="input input-bordered" value={amount} onChange={e => setAmount(e.target.value)} />
                </label>
                <label className="form-control">
                  <span className="label-text">Token decimals</span>
                  <input
                    className="input input-bordered"
                    value={decimals}
                    onChange={e => setDecimals(e.target.value)}
                  />
                </label>
              </div>
              <label className="form-control">
                <span className="label-text">Order reference</span>
                <input className="input input-bordered" value={metadata} onChange={e => setMetadata(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={isMining}>
                {isMining ? "Confirming…" : "Create invoice"}
              </button>
            </div>
          </form>

          <section className="card border border-base-300 bg-base-100 shadow-xl">
            <div className="card-body gap-5">
              <div>
                <h2 className="card-title text-2xl">Pay an invoice</h2>
                <p className="text-sm text-base-content/60">
                  The payment emits a receipt event that can be indexed or stamped in HCS.
                </p>
              </div>
              <label className="form-control">
                <span className="label-text">Invoice ID</span>
                <input
                  className="input input-bordered"
                  placeholder="0"
                  value={invoiceId}
                  onChange={e => setInvoiceId(e.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Receipt reference</span>
                <input
                  className="input input-bordered"
                  placeholder="optional"
                  value={receiptHash}
                  onChange={e => setReceiptHash(e.target.value)}
                />
              </label>
              <button className="btn btn-secondary" onClick={payInvoice} disabled={isMining}>
                {isMining ? "Confirming…" : "Pay invoice"}
              </button>
              {status && (
                <div className="alert alert-info text-sm">
                  <span className="break-words">{status}</span>
                </div>
              )}
              <p className="text-xs text-base-content/50">
                For HTS payments, approve the escrow contract for the invoice amount before calling Pay.
              </p>
            </div>
          </section>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-base-100 p-6 shadow">
            <p className="font-bold">1. Create</p>
            <p className="mt-2 text-sm text-base-content/70">
              The merchant creates an invoice with a token address, amount, and metadata hash.
            </p>
          </div>
          <div className="rounded-2xl bg-base-100 p-6 shadow">
            <p className="font-bold">2. Settle</p>
            <p className="mt-2 text-sm text-base-content/70">
              The payer settles in HBAR or an HTS token through the Hedera EVM token facade.
            </p>
          </div>
          <div className="rounded-2xl bg-base-100 p-6 shadow">
            <p className="font-bold">3. Verify</p>
            <p className="mt-2 text-sm text-base-content/70">
              Events are discoverable on HashScan and can be anchored to an HCS topic by the included server route.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Home;
