# AGENTS.md — SaucerPay

## Purpose

SaucerPay is a Scaffold-HBAR template for invoice escrow on Hedera. Merchants create exact-amount invoices in HBAR or HTS. Payers settle on-chain. Optional HCS receipts and SaucerSwap/Hedera quotes size those invoices in USD.

Scaffold:

```bash
npm create scaffold-hbar@latest --template BikramBiswas786/saucerpay
```

## Commands

```bash
yarn install
yarn hardhat:compile
yarn hardhat:test
yarn next:check-types
yarn next:build
yarn next:dev
```

Never commit `.env`, `.env.local`, private keys, or operator secrets.

## Hedera rules that agents get wrong

1. A random MetaMask key is not a Hedera account. Hashio returns `Sender account not found` until the EVM address maps to `0.0.x` (check `GET /api/hedera/account?evm=`).
2. Native HBAR invoices must be paid with **exact** `invoice.amount` (`WrongPayment` / `0x788a686f` otherwise).
3. JSON-RPC HBAR uses 18 decimals (`parseEther`). HTS uses the token's own decimals from Mirror Node.
4. HTS payers must `approve` the escrow before `payInvoice`, and send `value: 0`.
5. `HEDERA_PRIVATE_KEY` is server-only. Never `NEXT_PUBLIC_`.
6. Custom errors must stay on the ABI in `packages/nextjs/contracts/deployedContracts.ts`.

## Architecture

- `packages/hardhat/contracts/InvoiceEscrow.sol` — settlement + events
- `packages/hardhat/test` — HBAR, HTS, WrongPayment, cancel
- `packages/nextjs/app/page.tsx` — merchant/payer UI
- `packages/nextjs/app/api/quote` — SaucerSwap order book + Hedera exchangerate
- `packages/nextjs/app/api/hedera/*` — token, account, HCS receipt
- `packages/nextjs/app/api/agent/manifest` — machine-readable tools
- `packages/nextjs/public/llms.txt` — agent briefing

Use `useScaffoldReadContract` / `useScaffoldWriteContract`. Keep invoice event names stable.

## After every payment change

Run `yarn hardhat:test`. If you change the ABI, update `deployedContracts.ts` and create a regression test.
