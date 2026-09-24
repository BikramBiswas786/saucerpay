# SaucerPay

**Invoice escrow on Hedera** for HBAR and HTS. A Scaffold-HBAR template: one command, a working merchant → payer → withdraw flow, HashScan evidence, SaucerSwap quotes, Mirror Node metadata, and optional HCS receipts.

```bash
npm create scaffold-hbar@latest --template BikramBiswas786/saucerpay
```

Built for the [Scaffold-HBAR Template Bounty](https://hedera.com/blog/scaffold-hbar-template-bounty/).

## What you get

1. Merchant creates an invoice (HBAR or HTS token id `0.0.x`).
2. Payer settles the **exact** on-chain amount into `InvoiceEscrow`.
3. Merchant withdraws.
4. Events are on [HashScan](https://hashscan.io/testnet/contract/0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3).
5. `GET /api/quote` sizes USD → HBAR from **SaucerSwap** testnet order books, falling back to Hedera network exchangerate.
6. Optional `POST /api/hedera/receipt` stamps an HCS message.
7. Agents read `/llms.txt` and `GET /api/agent/manifest`.

Removing SaucerSwap/Hedera quotes, Mirror Node, or the escrow contract breaks the product. That is the load-bearing integration the bounty asks for.

## Eligibility / proof

| Gate | Evidence |
| --- | --- |
| Monorepo | `packages/hardhat` + `packages/nextjs` |
| Manifest | [`template.json`](./template.json) |
| Docs | this README, [`AGENTS.md`](./AGENTS.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Hedera services | Solidity escrow + HTS facade + Mirror Node + HCS route |
| Testnet tx | [createInvoice](https://hashscan.io/testnet/transaction/0xb242ea5a73a675ab9c6a666aee3a58c32f89b2267c447c5d81f1de7070d0a96d) |
| Live contract | [0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3](https://hashscan.io/testnet/contract/0xd955a0ADe4a5EC4AA95422D2D7650749A2fe1db3) |
| MIT | [`LICENCE`](./LICENCE) |
| Harness | [`.harness/recipe.yaml`](./.harness/recipe.yaml) |

## Prerequisites

- Node.js ≥ 20.18.3
- Yarn 3 (repo default) or npm
- A **Hedera testnet** ECDSA account from the [Hedera Portal](https://portal.hedera.com), funded via the faucet
- MetaMask on chain **296**, RPC `https://testnet.hashio.io/api`

A brand-new MetaMask key is **not** a Hedera account. Hashio will return `Sender account not found` until Mirror Node lists `0.0.x` for that EVM address.

## Run locally

```bash
cp packages/hardhat/.env.example packages/hardhat/.env
cp packages/nextjs/.env.example packages/nextjs/.env.local
yarn install
yarn hardhat:compile
yarn hardhat:test
yarn next:dev
```

Open `http://localhost:3000`. The checked-in registry already points at the testnet escrow. Deploy your own only if you want a fresh contract:

```bash
export __RUNTIME_DEPLOYER_PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
yarn hardhat:deploy --network hederaTestnet
```

## Using the app

1. Connect the funded `0.0.x` wallet on Hedera Testnet. The green banner must show the Hedera account id.
2. Create an HBAR invoice (leave token blank) or paste an HTS id such as `0.0.429274`.
3. Optional: enter USD — the quote API converts with SaucerSwap/Hedera rates.
4. On the board, tap **Pay**, then **Pay exact amount**. The app sends the on-chain amount, not the form field.
5. Merchant taps **Withdraw**.
6. Optional: **Stamp HCS receipt** after a successful pay (needs server operator env).

HTS payers must approve the escrow for the invoice amount first.

## Environment

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | browser | WalletConnect (optional locally) |
| `HEDERA_ACCOUNT_ID` | server | HCS operator |
| `HEDERA_PRIVATE_KEY` | server | HCS operator — never `NEXT_PUBLIC_` |
| `HEDERA_RECEIPT_TOPIC_ID` | server | HCS topic |
| `HEDERA_MIRROR_TESTNET_URL` | server | Mirror Node |

## API (humans and agents)

| Route | Role |
| --- | --- |
| `GET /api/quote` | SaucerSwap HBAR/USDC + Hedera exchangerate |
| `GET /api/hedera/token?id=0.0.x` | Mirror token metadata |
| `GET /api/hedera/account?evm=0x…` | EVM → `0.0.x` or null |
| `POST /api/hedera/receipt` | HCS stamp |
| `GET /api/agent/manifest` | Machine-readable tools |
| `/llms.txt` | Agent briefing |

## Validation

```bash
yarn hardhat:compile
yarn hardhat:test
yarn next:check-types
yarn next:build
```

## Security

Template, not a production processor. Add allow-lists, expiry enforcement, monitoring, and an audit before mainnet funds. Do not commit secrets.

## License

MIT. See [`LICENCE`](./LICENCE).
