"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { formatEther, formatUnits, keccak256, parseEther, parseUnits, toBytes, zeroAddress } from "viem";
import { useAccount, useChainId } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";

const ZERO = zeroAddress;
const ESCROW = "0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3" as const;
const HASHSCAN_TX = (hash: string) => `https://hashscan.io/testnet/transaction/${hash}`;
const HASHSCAN_CONTRACT = `https://hashscan.io/testnet/contract/${ESCROW}`;
const HEDERA_TESTNET_ID = 296;

const STATUS_LABEL = ["Open", "Paid", "Cancelled"] as const;

const toBytes32Ref = (value: string) => keccak256(toBytes(value || "saucerpay"));

const shortAddr = (value?: string) => {
  if (!value) return "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
};

const Home: NextPage = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const wrongNetwork = isConnected && chainId !== HEDERA_TESTNET_ID;

  const [token, setToken] = useState("");
  const [amount, setAmount] = useState("0.1");
  const [decimals, setDecimals] = useState("18");
  const [metadata, setMetadata] = useState("order-001");
  const [invoiceId, setInvoiceId] = useState("0");
  const [receiptRef, setReceiptRef] = useState("");
  const [status, setStatus] = useState("");
  const [lastTx, setLastTx] = useState<string | null>(null);

  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "InvoiceEscrow" });

  const { data: nextInvoiceId, refetch: refetchNext } = useScaffoldReadContract({
    contractName: "InvoiceEscrow",
    functionName: "nextInvoiceId",
  });

  const tokenAddress = useMemo(() => {
    if (!token.trim()) return ZERO;
    const raw = token.trim();
    if (raw.startsWith("0x") && raw.length === 42) return raw as `0x${string}`;
    const parts = raw.split(".");
    if (parts.length === 3 && parts[0] === "0" && parts[1] === "0" && /^\d+$/.test(parts[2])) {
      return `0x${BigInt(parts[2]).toString(16).padStart(40, "0")}` as `0x${string}`;
    }
    return undefined;
  }, [token]);

  const isHbar = tokenAddress === ZERO;

  const { data: payInvoiceData, refetch: refetchPayInvoice } = useScaffoldReadContract({
    contractName: "InvoiceEscrow",
    functionName: "invoices",
    args: [invoiceId !== "" ? BigInt(invoiceId) : undefined],
  });

  const invoiceCount = nextInvoiceId !== undefined ? Number(nextInvoiceId) : 0;
  const idsToShow = useMemo(() => {
    const count = Math.min(invoiceCount, 12);
    return Array.from({ length: count }, (_, i) => BigInt(invoiceCount - 1 - i));
  }, [invoiceCount]);

  const createInvoice = async (event: FormEvent) => {
    event.preventDefault();
    if (!isConnected) return setStatus("Connect a funded Hedera testnet wallet first.");
    if (wrongNetwork) return setStatus("Switch wallet network to Hedera Testnet (chain ID 296).");
    if (!tokenAddress) return setStatus("Enter a valid HTS token ID (0.0.x) or EVM address, or leave blank for HBAR.");
    try {
      setStatus("Confirm create invoice in your wallet…");
      setLastTx(null);
      const value = isHbar ? parseEther(amount) : parseUnits(amount, Number(decimals));
      const dueAt = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
      const hash = await writeContractAsync({
        functionName: "createInvoice",
        args: [tokenAddress, value, dueAt, toBytes32Ref(metadata)],
      });
      if (hash) setLastTx(hash);
      setStatus(hash ? `Invoice created.` : "Invoice submitted.");
      await refetchNext();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Create failed.");
    }
  };

  const payInvoice = async () => {
    if (!isConnected) return setStatus("Connect a funded Hedera testnet wallet first.");
    if (wrongNetwork) return setStatus("Switch wallet network to Hedera Testnet (chain ID 296).");
    if (invoiceId === "") return setStatus("Enter an invoice ID.");
    try {
      setStatus("Confirm payment in your wallet…");
      setLastTx(null);
      await refetchPayInvoice();
      const inv = payInvoiceData as
        | readonly [
            `0x${string}`,
            `0x${string}`,
            bigint,
            bigint,
            bigint,
            number,
            `0x${string}`,
          ]
        | undefined;

      const invToken = inv?.[1];
      const invAmount = inv?.[2];
      const invStatus = inv?.[5];

      if (invStatus !== undefined && Number(invStatus) !== 0) {
        return setStatus(`Invoice #${invoiceId} is not Open (status ${STATUS_LABEL[Number(invStatus)] ?? invStatus}).`);
      }

      const payValue =
        invToken && invToken.toLowerCase() !== ZERO.toLowerCase()
          ? undefined
          : invAmount !== undefined
            ? invAmount
            : parseEther(amount);

      const hash = await writeContractAsync({
        functionName: "payInvoice",
        args: [BigInt(invoiceId), toBytes32Ref(receiptRef || `receipt-${invoiceId}`)],
        ...(payValue !== undefined ? { value: payValue } : {}),
      });
      if (hash) setLastTx(hash);
      setStatus(hash ? `Payment submitted.` : "Payment submitted.");
      await refetchNext();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Payment failed.");
    }
  };

  const withdrawInvoice = async (id: bigint) => {
    if (!isConnected || wrongNetwork) return setStatus("Connect on Hedera Testnet (296).");
    try {
      setStatus(`Withdrawing invoice #${id}…`);
      setLastTx(null);
      const hash = await writeContractAsync({
        functionName: "withdraw",
        args: [id],
      });
      if (hash) setLastTx(hash);
      setStatus(`Withdraw submitted for #${id}.`);
      await refetchNext();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Withdraw failed.");
    }
  };

  return (
    <main className="min-h-screen bg-base-200 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {wrongNetwork && (
          <div className="alert alert-warning shadow-sm">
            <span>
              Wallet is on chain <strong>{chainId}</strong>. Switch to <strong>Hedera Testnet (296)</strong> or
              transactions will fail with “Sender account not found.”
            </span>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.85fr] lg:items-stretch">
          <div className="rounded-3xl border border-base-300 bg-base-100 p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">SaucerPay</p>
            <h1 className="mt-3 max-w-xl text-4xl font-bold tracking-tight md:text-5xl">
              Invoice escrow for HBAR &amp; HTS
            </h1>
            <p className="mt-4 max-w-xl text-base text-base-content/70">
              Merchants create exact-amount invoices. Payers settle on Hedera. Settlement is visible on HashScan — not a
              demo form with no chain behind it.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="badge badge-primary">Exact settlement</span>
              <span className="badge badge-ghost">HBAR + HTS</span>
              <span className="badge badge-ghost">HashScan events</span>
              <a className="badge badge-outline" href={HASHSCAN_CONTRACT} target="_blank" rel="noreferrer">
                Live contract ↗
              </a>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl bg-neutral p-7 text-neutral-content shadow-xl">
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-content/50">Wallet</p>
              <p className="mt-2 break-all font-mono text-sm">{address ?? "Not connected"}</p>
              <p className="mt-4 text-sm text-neutral-content/70">
                Use a <strong>funded Hedera testnet</strong> account on chain 296. Random EVM wallets without a Hedera
                account will fail simulation.
              </p>
            </div>
            <div className="mt-6 text-xs text-neutral-content/50">
              Escrow {shortAddr(ESCROW)} · next id {" "}
              <span className="font-mono text-neutral-content">{nextInvoiceId?.toString() ?? "—"}</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={createInvoice} className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div>
                <h2 className="card-title text-xl">Create invoice</h2>
                <p className="text-sm text-base-content/60">Leave token blank for native HBAR (18 decimals on JSON-RPC).</p>
              </div>
              <label className="form-control">
                <span className="label-text">HTS token (0.0.x or 0x…)</span>
                <input
                  className="input input-bordered"
                  placeholder="Blank = HBAR"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <span className="label-text">Amount</span>
                  <input className="input input-bordered" value={amount} onChange={e => setAmount(e.target.value)} />
                </label>
                <label className="form-control">
                  <span className="label-text">Decimals</span>
                  <input
                    className="input input-bordered"
                    value={isHbar ? "18" : decimals}
                    disabled={isHbar}
                    onChange={e => setDecimals(e.target.value)}
                  />
                </label>
              </div>
              <label className="form-control">
                <span className="label-text">Order reference</span>
                <input className="input input-bordered" value={metadata} onChange={e => setMetadata(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={isMining || wrongNetwork}>
                {isMining ? "Confirming…" : "Create invoice"}
              </button>
            </div>
          </form>

          <section className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div>
                <h2 className="card-title text-xl">Pay invoice</h2>
                <p className="text-sm text-base-content/60">
                  HBAR payments send the exact on-chain amount. HTS requires prior approve to the escrow.
                </p>
              </div>
              <label className="form-control">
                <span className="label-text">Invoice ID</span>
                <input
                  className="input input-bordered"
                  value={invoiceId}
                  onChange={e => setInvoiceId(e.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Receipt note (optional)</span>
                <input
                  className="input input-bordered"
                  placeholder="receipt reference"
                  value={receiptRef}
                  onChange={e => setReceiptRef(e.target.value)}
                />
              </label>
              {payInvoiceData && (
                <div className="rounded-xl bg-base-200 px-3 py-2 text-xs font-mono">
                  Status: {STATUS_LABEL[Number((payInvoiceData as any)[5])] ?? "?"} · Amount:{" "}
                  {(payInvoiceData as any)[1]?.toLowerCase() === ZERO
                    ? `${formatEther((payInvoiceData as any)[2])} HBAR`
                    : String((payInvoiceData as any)[2])}
                </div>
              )}
              <button className="btn btn-secondary" type="button" onClick={payInvoice} disabled={isMining || wrongNetwork}>
                {isMining ? "Confirming…" : "Pay exact amount"}
              </button>
            </div>
          </section>
        </div>

        {(status || lastTx) && (
          <div className="alert bg-base-100 border border-base-300 shadow-sm">
            <div className="w-full space-y-1">
              {status && <p className="text-sm break-words">{status}</p>}
              {lastTx && (
                <a className="link link-primary text-sm font-mono" href={HASHSCAN_TX(lastTx)} target="_blank" rel="noreferrer">
                  View on HashScan ↗
                </a>
              )}
            </div>
          </div>
        )}

        <section className="card border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="card-title text-xl">Invoice board</h2>
                <p className="text-sm text-base-content/60">Latest invoices on the live escrow (up to 12).</p>
              </div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => refetchNext()}>
                Refresh
              </button>
            </div>

            {idsToShow.length === 0 ? (
              <p className="py-8 text-center text-sm text-base-content/50">No invoices yet — create one above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Token</th>
                      <th>Merchant</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {idsToShow.map(id => (
                      <InvoiceRow
                        key={id.toString()}
                        id={id}
                        onPay={() => setInvoiceId(id.toString())}
                        onWithdraw={() => withdrawInvoice(id)}
                        connected={address}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

function InvoiceRow({
  id,
  onPay,
  onWithdraw,
  connected,
}: {
  id: bigint;
  onPay: () => void;
  onWithdraw: () => void;
  connected?: string;
}) {
  const { data } = useScaffoldReadContract({
    contractName: "InvoiceEscrow",
    functionName: "invoices",
    args: [id],
  });

  if (!data) {
    return (
      <tr>
        <td className="font-mono">{id.toString()}</td>
        <td colSpan={5} className="text-base-content/40">
          Loading…
        </td>
      </tr>
    );
  }

  const [merchant, token, amount, , , status] = data as unknown as [
    `0x${string}`,
    `0x${string}`,
    bigint,
    bigint,
    bigint,
    number,
    `0x${string}`,
  ];

  const statusNum = Number(status);
  const label = STATUS_LABEL[statusNum] ?? String(statusNum);
  const isHbar = token.toLowerCase() === ZERO.toLowerCase();
  const amountLabel = isHbar ? `${formatEther(amount)} ℏ` : formatUnits(amount, 8);
  const isMerchant = connected && merchant.toLowerCase() === connected.toLowerCase();

  return (
    <tr>
      <td className="font-mono font-semibold">{id.toString()}</td>
      <td>
        <span
          className={`badge badge-sm ${
            statusNum === 0 ? "badge-warning" : statusNum === 1 ? "badge-success" : "badge-ghost"
          }`}
        >
          {label}
        </span>
      </td>
      <td className="font-mono">{amountLabel}</td>
      <td className="font-mono text-xs">{isHbar ? "HBAR" : shortAddr(token)}</td>
      <td className="font-mono text-xs">{shortAddr(merchant)}</td>
      <td className="text-right">
        <div className="flex justify-end gap-1">
          {statusNum === 0 && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={onPay}>
              Pay
            </button>
          )}
          {statusNum === 1 && isMerchant && (
            <button type="button" className="btn btn-ghost btn-xs" onClick={onWithdraw}>
              Withdraw
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default Home;
