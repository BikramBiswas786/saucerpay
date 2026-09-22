# AGENTS.md — SaucerPay

## Project purpose

SaucerPay is a Scaffold-HBAR template for invoice escrow on Hedera. The primary path is a Next.js frontend plus a Hardhat contract package. The contract accepts native HBAR and HTS-compatible tokens through the Hedera EVM token facade, emits verifiable payment events, and supports optional HCS receipt stamping through a server-only API route.

## Commands

```bash
yarn install
yarn hardhat:compile
yarn hardhat:test
yarn next:check-types
yarn next:build
```

Do not commit `.env`, `.env.local`, private keys, or generated deployment secrets.

## Coding rules

- Keep the contract behavior explicit and test every payment path.
- Use `useScaffoldReadContract` and `useScaffoldWriteContract` for frontend contract calls.
- Use Scaffold-HBAR UI components and DaisyUI classes for web3 UI.
- Keep HCS credentials server-side. Never place `HEDERA_PRIVATE_KEY` in a `NEXT_PUBLIC_*` variable.
- Treat token IDs, EVM addresses, decimals, and user-entered amounts as untrusted input.
- Preserve the invoice event schema because HashScan and Mirror Node indexing depend on stable event names and indexed fields.
- Update the README when changing setup, environment variables, deployment, or the on-chain interface.

## AI-assisted workflow

Before editing, inspect the relevant package and contract. Make small changes, run the narrowest relevant test, then run the full validation commands. Ask the coding agent to explain generated code and list failure modes. Never accept a generated payment or authentication change without reading it and adding a regression test.

## Architecture boundaries

- `packages/hardhat/contracts`: on-chain settlement and events.
- `packages/hardhat/deploy`: deterministic deployment.
- `packages/hardhat/test`: contract tests.
- `packages/nextjs/app`: UI and server routes.
- `packages/nextjs/contracts`: generated or checked-in ABI registry.
- `packages/nextjs/app/api/hedera`: Mirror Node reads and optional HCS writes.
