/** Map Hashio / viem / custom-error dumps into operator-facing copy. */
export function humanizeHederaError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const lower = raw.toLowerCase();

  if (lower.includes("sender account not found")) {
    return "Hedera has no account for this wallet. Import a Portal-created testnet ECDSA account (0.0.x) and switch MetaMask to Hedera Testnet, chain ID 296. A brand-new MetaMask key cannot send.";
  }
  if (raw.includes("0x788a686f") || lower.includes("wrongpayment")) {
    return "Exact-amount mismatch (WrongPayment). HBAR invoices must be paid with the on-chain amount only. HTS invoices must send 0 HBAR plus an ERC-20 allowance to the escrow.";
  }
  if (raw.includes("0xddafad98") || lower.includes("notopen")) {
    return "This invoice is not open — it was already paid or cancelled.";
  }
  if (raw.includes("0x3b6405f4") || lower.includes("notmerchant")) {
    return "Only the merchant who created this invoice can withdraw or cancel it.";
  }
  if (raw.includes("0x2c5211c6") || lower.includes("invalidamount")) {
    return "Amount must be greater than zero.";
  }
  if (raw.includes("0x90b8ec18") || lower.includes("transferfailed")) {
    return "Token transfer failed. For HTS, approve the escrow for the invoice amount first.";
  }
  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request")) {
    return "Signature rejected in the wallet.";
  }

  const trimmed = raw.split("Details:")[0].split("Contract Call:")[0].split("Request body:")[0].trim();
  return trimmed.length > 320 ? `${trimmed.slice(0, 320)}…` : trimmed || "Transaction failed.";
}
