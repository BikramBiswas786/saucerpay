# SaucerPay architecture

Settlement state lives on InvoiceEscrow. Pricing, identity, token metadata, and optional receipts are Hedera-native services.

Merchant -> createInvoice
Payer -> payInvoice exact HBAR or HTS transferFrom
Merchant -> withdraw
Events -> HashScan / Mirror Node
Quote -> SaucerSwap order book + Hedera network exchangerate
Token -> Mirror Node /api/v1/tokens/{id}
Account -> Mirror Node /api/v1/accounts/{evm}
Receipt -> optional HCS TopicMessageSubmit
Agents -> GET /api/agent/manifest and /llms.txt

## Why SaucerSwap is load-bearing

Merchants think in USD. Hedera settles in HBAR or HTS units. GET /api/quote sizes the on-chain amount from a live SaucerSwap testnet HBAR/USDC mark when that book is usable, otherwise from Hedera network exchangerate. Remove it and the template cannot convert a business amount into an exact payable invoice.

## Hedera services

- Solidity on Hedera: invoice lifecycle
- HTS / EVM token facade: token invoices
- Mirror Node: metadata, accounts, official rate
- HCS: optional receipt after payment
- HashScan: human verification
