"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { formatEther, formatUnits, keccak256, parseEther, parseUnits, toBytes, zeroAddress } from "viem";
import { useAccount, useChainId } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-hbar";
import { humanizeHederaError } from "~~/utils/scaffold-hbar/humanizeHederaError";

const ZERO = zeroAddress;
const ESCROW = "0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3" as const;
const HASHSCAN_TX = (hash: string) => `https://hashscan.io/testnet/transaction/${hash}`;
const HASHSCAN_CONTRACT = `https://hashscan.io/testnet/contract/${ESCROW}`;
const HEDERA_TESTNET_ID = 296;
const STATUS_LABEL = ["Open", "Paid", "Cancelled"] as const;

type InvoiceTuple = readonly [
  merchant: `0x${string}`,
  token: `0x${string}`,
  amount: bigint,
  paidAmount: bigint,
  dueAt: bigint,
  status: number | bigint,
  metadataHash: `0x${string}`,
];

type Quote = {
  hbarUsd: number;
  officialHbarUsd: number;
  settlementSource: string;
  dex: { bookId: string; hbarUsd: number; status: string } | null;
};

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
  const [usd, setUsd] = useState("");
  const [decimals, setDecimals] = useState("8");
  const [metadata, setMetadata] = useState("order-001");
  const [invoiceId, setInvoiceId] = useState("0");
  const [receiptRef, setReceiptRef] = useState("");
  const [status, setStatus] = useState("");
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [hederaAccount, setHederaAccount] = useState<string | null | undefined>(undefined);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [tokenHint, setTokenHint] = useState("");

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

  useEffect(() => {
    fetch("/api/quote")
      .then(r => r.json())
      .then(setQuote)
      .catch(() => setQuote(null));
  }, []);

  useEffect(() => {
    if (!address || wrongNetwork) {
      setHederaAccount(undefined);
      return;
    }
    let live = true;
    fetch(`/api/hedera/account?evm=${address}&network=testnet`)
      .then(async res => {
        const body = (await res.json()) as { accountId?: string | null };
        if (live) setHederaAccount(body.accountId ?? null);
      })
      .catch(() => {
        if (live) setHederaAccount(null);
      });
    return () => {
      live = false;
    };
  }, [address, wrongNetwork]);

  const unknownHederaAccount = isConnected && !wrongNetwork && hederaAccount === null;
  const writesBlocked = !isConnected || wrongNetwork || unknownHederaAccount || isMining;
  const usdHint =
    isHbar && quote && Number(amount) > 0 ? `≈ $${(Number(amount) * quote.hbarUsd).toFixed(4)} USD` : "";

  const guardWallet = () => {
    if (!isConnected) {
      setStatus("Connect a wallet first.");
      return false;
    }
    if (wrongNetwork) {
      setStatus("Switch the wallet to Hedera Testnet (chain ID 296). RPC: https://testnet.hashio.io/api");
      return false;
    }
    if (unknownHederaAccount) {
      setStatus(`No Hedera account for ${shortAddr(address)}. Import a Portal ECDSA 0.0.x key on chain 296.`);
      return false;
    }
    return true;
  };

  const applyUsd = (value: string) => {
    setUsd(value);
    if (!quote || !value) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0 || !quote.hbarUsd) return;
    setAmount((n / quote.hbarUsd).toFixed(6));
  };

  const lookupToken = async () => {
    const id = token.trim();
    if (!/^0\.0\.\d+$/.test(id)) {
      setTokenHint("Enter a Hedera token id such as 0.0.429274, or leave blank for HBAR.");
      return;
    }
    const res = await fetch(`/api/hedera/token?id=${id}`);
    const body = await res.json();
    if (!res.ok) {
      setTokenHint(body.error ?? "Token not found");
      return;
    }
    setDecimals(String(body.decimals ?? "8"));
    setTokenHint(`${body.name} (${body.symbol}) · ${body.decimals} decimals · treasury ${body.treasury}`);
  };

  const createInvoice = async (event: FormEvent) => {
    event.preventDefault();
    if (!guardWallet()) return;
    if (!tokenAddress) {
      setStatus("Enter a valid HTS token ID (0.0.x) or 0x address, or leave blank for HBAR.");
      return;
    }
    try {
      setStatus("Confirm create invoice in the wallet…");
      setLastTx(null);
      const value = isHbar ? parseEther(amount) : parseUnits(amount, Number(decimals || "8"));
      const dueAt = BigInt(Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
      const hash = await writeContractAsync({
        functionName: "createInvoice",
        args: [tokenAddress, value, dueAt, toBytes32Ref(metadata)],
      });
      if (hash) setLastTx(hash);
      setStatus(hash ? "Invoice created on Hedera testnet." : "Invoice submitted.");
      await refetchNext();
    } catch (error) {
      setStatus(humanizeHederaError(error));
    }
  };

  const payInvoice = async () => {
    if (!guardWallet()) return;
    if (invoiceId === "") {
      setStatus("Enter an invoice ID, or tap Pay on a row in the board.");
      return;
    }
    try {
      setStatus("Loading invoice from the contract…");
      setLastTx(null);
      const fresh = await refetchPayInvoice();
      const inv = (fresh.data ?? payInvoiceData) as InvoiceTuple | undefined;
      if (!inv || inv[0] === ZERO) {
        setStatus(`Invoice #${invoiceId} was not found on the escrow.`);
        return;
      }
      const invToken = inv[1];
      const invAmount = inv[2];
      const invStatus = Number(inv[5]);
      const hbarInvoice = invToken.toLowerCase() === ZERO.toLowerCase();
      if (invStatus !== 0) {
        setStatus(`Invoice #${invoiceId} is ${STATUS_LABEL[invStatus] ?? invStatus} — not payable.`);
        return;
      }
      setStatus(
        hbarInvoice
          ? `Confirm payment of ${formatEther(invAmount)} HBAR (exact on-chain amount)…`
          : "Confirm HTS payment (0 HBAR value; allowance required)…",
      );
      const hash = await writeContractAsync({
        functionName: "payInvoice",
        args: [BigInt(invoiceId), toBytes32Ref(receiptRef || `receipt-${invoiceId}`)],
        ...(hbarInvoice ? { value: invAmount } : { value: 0n }),
      });
      if (hash) setLastTx(hash);
      setStatus(hash ? "Payment submitted." : "Payment submitted.");
      await refetchNext();
    } catch (error) {
      setStatus(humanizeHederaError(error));
    }
  };

  const withdrawInvoice = async (id: bigint) => {
    if (!guardWallet()) return;
    try {
      setStatus(`Withdrawing invoice #${id}…`);
      setLastTx(null);
      const hash = await writeContractAsync({ functionName: "withdraw", args: [id] });
      if (hash) setLastTx(hash);
      setStatus(`Withdraw submitted for #${id}.`);
      await refetchNext();
    } catch (error) {
      setStatus(humanizeHederaError(error));
    }
  };

  const stampHcs = async () => {
    if (!lastTx) return;
    setStatus("Stamping HCS receipt…");
    const res = await fetch("/api/hedera/receipt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ invoiceId, txId: lastTx }),
    });
    const body = await res.json();
    if (!res.ok) {
      setStatus(body.error ?? "HCS stamp unavailable — set HEDERA_* server env.");
      return;
    }
    setStatus(`HCS receipt seq ${body.sequence} on topic ${body.topicId}`);
  };

  const selectToPay = (id: string) => {
    setInvoiceId(id);
    document.getElementById("pay")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const liveInvoice = payInvoiceData as InvoiceTuple | undefined;

  return (
    <main className="min-h-screen bg-base-200 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {wrongNetwork && (
          <div className="alert alert-warning">
            <span>
              Wallet is on chain <strong>{chainId}</strong>. Switch to <strong>Hedera Testnet (296)</strong>.
            </span>
          </div>
        )}
        {unknownHederaAccount && (
          <div className="alert alert-error">
            <span>
              No Hedera account for {shortAddr(address)}. Import a Portal ECDSA key —{" "}
              <a className="link" href="https://portal.hedera.com" target="_blank" rel="noreferrer">
                portal.hedera.com
              </a>
            </span>
          </div>
        )}
        {hederaAccount && (
          <div className="alert alert-success">
            <span>
              Hedera account <span className="font-mono font-semibold">{hederaAccount}</span> is ready.
            </span>
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.4fr_0.85fr]">
          <div className="rounded-3xl border border-base-300 bg-base-100 p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">SaucerPay</p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Invoice escrow on Hedera</h1>
            <p className="mt-4 max-w-xl text-base text-base-content/70">
              Exact HBAR or HTS settlement, priced with SaucerSwap + Hedera rates, verified on HashScan, optional HCS
              receipts for agents and back-office systems.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href="#create" className="badge badge-primary badge-lg cursor-pointer">
                Create
              </a>
              <a href="#pay" className="badge badge-secondary badge-lg cursor-pointer">
                Pay exact
              </a>
              <a href="#board" className="badge badge-ghost badge-lg cursor-pointer">
                Board
              </a>
              <a className="badge badge-outline badge-lg cursor-pointer" href={HASHSCAN_CONTRACT} target="_blank" rel="noreferrer">
                Contract ↗
              </a>
              <a className="badge badge-outline badge-lg cursor-pointer" href="/api/agent/manifest" target="_blank" rel="noreferrer">
                Agent API
              </a>
              <a className="badge badge-outline badge-lg cursor-pointer" href="/llms.txt" target="_blank" rel="noreferrer">
                llms.txt
              </a>
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-3xl bg-neutral p-7 text-neutral-content shadow-xl">
            <div>
              <p className="text-xs uppercase tracking-widest text-neutral-content/50">Wallet</p>
              <p className="mt-2 break-all font-mono text-sm">{address ?? "Not connected"}</p>
              <p className="mt-3 text-sm text-neutral-content/70">
                {hederaAccount ? `Mapped ${hederaAccount}` : "Needs a real 0.0.x account on chain 296."}
              </p>
            </div>
            <div className="mt-6 space-y-1 text-xs text-neutral-content/60">
              <p>
                HBAR ${quote ? quote.hbarUsd.toFixed(4) : "…"} · source {quote?.settlementSource ?? "loading"}
              </p>
              {quote?.dex && (
                <p>
                  SaucerSwap book {quote.dex.bookId} {quote.dex.status} mark ${quote.dex.hbarUsd.toFixed(4)}
                </p>
              )}
              <p>
                Escrow {shortAddr(ESCROW)} · next #{nextInvoiceId?.toString() ?? "—"}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <form id="create" onSubmit={createInvoice} className="card scroll-mt-24 border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div>
                <h2 className="card-title text-xl">Create invoice</h2>
                <p className="text-sm text-base-content/60">Blank token = HBAR. USD uses SaucerSwap / Hedera rate.</p>
              </div>
              <label className="form-control">
                <span className="label-text">HTS token (0.0.x or 0x…)</span>
                <div className="flex gap-2">
                  <input
                    className="input input-bordered flex-1"
                    placeholder="Blank = HBAR"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                  />
                  <button className="btn btn-ghost" type="button" onClick={lookupToken}>
                    Lookup
                  </button>
                </div>
                {tokenHint && <span className="label-text-alt mt-1">{tokenHint}</span>}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="form-control">
                  <span className="label-text">Amount {usdHint && <span className="opacity-60">{usdHint}</span>}</span>
                  <input className="input input-bordered" value={amount} onChange={e => setAmount(e.target.value)} />
                </label>
                <label className="form-control">
                  <span className="label-text">USD → HBAR</span>
                  <input
                    className="input input-bordered"
                    placeholder="e.g. 5"
                    value={usd}
                    disabled={!isHbar}
                    onChange={e => applyUsd(e.target.value)}
                  />
                </label>
              </div>
              <label className="form-control">
                <span className="label-text">Decimals</span>
                <input
                  className="input input-bordered"
                  value={isHbar ? "18" : decimals}
                  disabled={isHbar}
                  onChange={e => setDecimals(e.target.value)}
                />
              </label>
              <label className="form-control">
                <span className="label-text">Order reference</span>
                <input className="input input-bordered" value={metadata} onChange={e => setMetadata(e.target.value)} />
              </label>
              <button className="btn btn-primary" type="submit" disabled={writesBlocked}>
                {isMining ? "Confirming…" : "Create invoice"}
              </button>
            </div>
          </form>

          <section id="pay" className="card scroll-mt-24 border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body gap-4">
              <div>
                <h2 className="card-title text-xl">Pay invoice</h2>
                <p className="text-sm text-base-content/60">Amount is read from the contract. No over/under pay.</p>
              </div>
              <label className="form-control">
                <span className="label-text">Invoice ID</span>
                <input className="input input-bordered" value={invoiceId} onChange={e => setInvoiceId(e.target.value)} />
              </label>
              <label className="form-control">
                <span className="label-text">Receipt note</span>
                <input
                  className="input input-bordered"
                  placeholder="optional"
                  value={receiptRef}
                  onChange={e => setReceiptRef(e.target.value)}
                />
              </label>
              {liveInvoice && liveInvoice[0] !== ZERO && (
                <div className="rounded-xl bg-base-200 px-3 py-2 text-xs">
                  Status {STATUS_LABEL[Number(liveInvoice[5])] ?? "?"} ·{" "}
                  {liveInvoice[1].toLowerCase() === ZERO
                    ? `${formatEther(liveInvoice[2])} HBAR`
                    : `${liveInvoice[2].toString()} units`}
                  <p className="mt-1 font-mono text-base-content/60">Merchant {shortAddr(liveInvoice[0])}</p>
                </div>
              )}
              <button className="btn btn-secondary" type="button" onClick={payInvoice} disabled={writesBlocked}>
                {isMining ? "Confirming…" : "Pay exact amount"}
              </button>
            </div>
          </section>
        </div>

        {(status || lastTx) && (
          <div className="alert border border-base-300 bg-base-100">
            <div className="w-full space-y-2">
              {status && <p className="text-sm break-words">{status}</p>}
              <div className="flex flex-wrap gap-3">
                {lastTx && (
                  <a className="link link-primary font-mono text-sm" href={HASHSCAN_TX(lastTx)} target="_blank" rel="noreferrer">
                    HashScan ↗
                  </a>
                )}
                {lastTx && (
                  <button className="btn btn-xs btn-outline" type="button" onClick={stampHcs}>
                    Stamp HCS receipt
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <section id="board" className="card scroll-mt-24 border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="card-title text-xl">Invoice board</h2>
                <p className="text-sm text-base-content/60">Live InvoiceEscrow reads · latest 12</p>
              </div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => refetchNext()}>
                Refresh
              </button>
            </div>
            {idsToShow.length === 0 ? (
              <p className="py-8 text-center text-sm text-base-content/50">No invoices yet.</p>
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
                        onPay={() => selectToPay(id.toString())}
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

  const [merchant, token, amount, , , status] = data as unknown as InvoiceTuple;
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
