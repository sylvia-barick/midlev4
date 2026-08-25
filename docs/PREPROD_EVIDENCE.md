# Midnight Preprod Evidence

> **Status: PARTIALLY VERIFIED, still BLOCKED overall.** Contract deployment is confirmed
> on real Preprod (independently verified against the live indexer, decoded with this
> project's own contract code — see [`docs/PREPROD_E2E_STATUS.md`](./PREPROD_E2E_STATUS.md)
> §2). Every step after deployment (`join_group` through `claim_payment`) has not been
> submitted or confirmed, and a real attempt was root-caused to a reproducible hang in the
> installed Midnight wallet SDK's dust-wallet sync — see `PREPROD_E2E_STATUS.md` §6-§9 for
> the full investigation, evidence, and next steps. This is distinct from the
> independently-verified 339 real Preprod addresses documented in the main `README.md`.

## Contract

Contract Address:
`9a378876a47bc46b81d275c8e0c6ba40163009184565eb35414c7cc9d62467fd`

Deployment Tx Hash:
`3cffa9d76a160c27c7d6f8299fbe3d2a3d3cb7b47382107cfd9c8804b1b55f66` (block 2,119,943 — verify via the live indexer per `docs/PREPROD_E2E_STATUS.md` §2)

## Membership

join_group Tx Hash:
BLOCKED (see PREPROD_E2E_STATUS.md)

## Expense

post_expense Tx Hash:
BLOCKED (see PREPROD_E2E_STATUS.md)

## Private Balance

Wallet A sync_balance Tx:
BLOCKED (see PREPROD_E2E_STATUS.md)

Wallet B sync_balance Tx:
BLOCKED (see PREPROD_E2E_STATUS.md)

## Settlement

post_payment Tx Hash:
BLOCKED (see PREPROD_E2E_STATUS.md)

claim_payment Tx Hash:
BLOCKED (see PREPROD_E2E_STATUS.md)
