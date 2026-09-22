# SaucerPay

**Hedera invoice escrow for HBAR and HTS-compatible tokens.** SaucerPay is a production-shaped Scaffold-HBAR template for merchants who need to create invoices, accept settlement on Hedera, and produce receipts that can be inspected on HashScan or anchored to the Hedera Consensus Service.

## Why this template exists

A developer should be able to start a Hedera payment workflow without assembling wallet connection, a contract, token settlement, Mirror Node reads, and receipt stamping from unrelated examples. SaucerPay composes those pieces into one focused pattern:

1. A merchant creates an invoice for HBAR or an HTS token.
2. A payer settles the exact amount through the `InvoiceEscrow` contract.
3. The contract emits indexed `InvoiceCreated` and `InvoicePaid` events.
4. The frontend links developers to HashScan, while the optional API route stamps a compact receipt in an HCS topic.
5. The Mirror Node route resolves a Hedera token ID into human-readable metadata.

The integration is load-bearing: removing Hedera EVM token compatibility, HashScan events, or HCS receipt stamping removes the core payment and verification workflow.

## Scaffold in one command

```bash
npm create scaffold-hbar@latest -- --template BikramBiswas786/saucerpay
cd saucerpay
npm install
```

The template targets Node.js **20.18.3 or later** and includes Next.js, Hardhat, TypeScript, Viem, Wagmi, the Hedera SDK, and the Scaffold-HBAR UI components.

## Run locally

```bash
cp packages/hardhat/.env.example packages/hardhat/.env
cp packages/nextjs/.env.example packages/nextjs/.env.local
yarn install
yarn hardhat:compile
yarn hardhat:test
yarn next:dev
```

Open `http://localhost:3000`. A local wallet can be used for the contract tests. For a real Hedera flow, deploy to testnet and update the generated contract registry as described below.

## Testnet deployment

Create or import a funded Hedera testnet account through the [Hedera Portal](https://portal.hedera.com). Never commit the private key.

```bash
export __RUNTIME_DEPLOYER_PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
yarn hardhat:deploy --network hederaTestnet
```

The deploy command compiles the contracts, deploys `InvoiceEscrow`, and regenerates the TypeScript ABI registry at `packages/nextjs/contracts/deployedContracts.ts`. Start the frontend after deployment:

```bash
yarn next:dev
```

The web app accepts an HTS token ID such as `0.0.1234` and converts it to the Hedera EVM address. For an HTS payment, the payer must approve the deployed escrow contract for the invoice amount before calling **Pay invoice**. HBAR invoices use the native payable path and do not require token approval.

## Optional HCS receipt stamping

The API route at `POST /api/hedera/receipt` uses the official Hedera SDK and is disabled unless all three variables are configured:

```bash
HEDERA_ACCOUNT_ID=0.0.1234
HEDERA_PRIVATE_KEY=your_operator_key
HEDERA_RECEIPT_TOPIC_ID=0.0.5678
```

Example request:

```bash
curl -X POST http://localhost:3000/api/hedera/receipt \
  -H 'content-type: application/json' \
  -d '{"invoiceId":"0","txId":"0.0.1234@1234567890.000000000"}'
```

Use a dedicated low-balance testnet operator for this route. The private key is read only from the server environment and is never exposed to the browser.

## Mirror Node token metadata

```text
GET /api/hedera/token?id=0.0.1234
```

The route reads testnet token metadata from the Hedera Mirror Node and returns the token ID, name, symbol, decimals, type, and treasury account.

## Contract surface

`packages/hardhat/contracts/InvoiceEscrow.sol` implements:

- `createInvoice(token, amount, dueAt, metadataHash)` for merchant invoices.
- `payInvoice(invoiceId, receiptHash)` for exact HBAR or HTS-compatible settlement.
- `withdraw(invoiceId)` for merchant settlement.
- `cancelInvoice(invoiceId)` for open invoices.
- Indexed payment and receipt events for HashScan and Mirror Node indexing.

The contract intentionally keeps invoice metadata off-chain. The `metadataHash` field lets an application bind an external invoice or order document to the on-chain record without putting customer data on a public ledger.

## Validation

```bash
yarn hardhat:compile
yarn hardhat:test
yarn next:check-types
yarn next:build
```

The Hardhat suite covers native HBAR settlement, HTS-compatible ERC-20 settlement, approval, payment events, and withdrawal. The testnet proof required for a bounty submission should be added to the submission notes as a HashScan transaction link after deploying and executing one invoice flow on testnet.

## Repository layout

```text
packages/
  hardhat/
    contracts/InvoiceEscrow.sol
    deploy/03_deploy_invoice_escrow.ts
    test/InvoiceEscrow.test.ts
  nextjs/
    app/page.tsx
    app/api/hedera/token/route.ts
    app/api/hedera/receipt/route.ts
    contracts/deployedContracts.ts
template.json
AGENTS.md
```

## Security notes

This is a starting template, not a completed production payment processor. Add access control, invoice expiry handling, reentrancy protection appropriate to your threat model, robust token allow-listing, rate limits, monitoring, and a professional audit before using real funds. Do not commit `.env`, private keys, customer documents, or production secrets.

## License

MIT. See [`LICENCE`](./LICENCE).
