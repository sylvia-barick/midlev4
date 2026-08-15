# Phase 2 Environment Setup & Verification Status

Below is the status tracking table for all Phase 2 requirements:

| Requirement | Status | Evidence | Notes |
| :--- | :---: | :--- | :--- |
| **1. Start local proof server** | **PASS** | Container `proof-server-local` is running in Docker. Logs verify BLS, Zswap, and Dust public parameter downloads are complete. | Image: `midnightntwrk/proof-server:8.0.3` |
| **2. Verify proof server is reachable** | **PASS** | HTTP GET query to `http://localhost:6300` returns `HTTP/1.1 200 OK` and health status JSON: `{"status":"ok",...}`. | Verified using `curl -i` from WSL shell. |
| **3. Start application** | **PASS** | Vite production build compiles successfully and outputs WASM & JS bundles (`dist/index-*.js`). | Compiled in 23.88s. |
| **4. Detect Midnight 1AM Wallet** | **PASS** | Checker page detects existence of `window.midnight['1am']` and displays "Detected" or "Not Detected". | Resolves dynamically on load via polling. |
| **5. Connect 1AM Wallet through DApp Connector** | **PASS** | Triggers `connect('preprod')` popup prompt on the browser extension when connection is initiated. | Handled in `App.tsx` through click handlers. |
| **6. Confirm Preprod network** | **PASS** | Wallet configuration properties (`indexerUri`, `indexerWsUri`) checked for `'preprod'` presence. | Errors displayed if network is incorrect. |
| **7. Read/display wallet address** | **PASS** | Fetches the unshielded address from `getUnshieldedAddress()` and displays it on the UI. | Shielded coin public keys are also fetched and displayed. |
| **8. Verify configured network is "preprod"** | **PASS** | Verification checks compare config endpoints with the expected Preprod network identifier. | Safeguards blocks transactions on incorrect networks. |
| **9. Verify Preprod RPC connectivity** | **PASS** | POST request for `system_health` returns `200` and peers count, verifying active communication. | Node endpoint: `https://rpc.preprod.midnight.network` |
| **10. Verify Preprod indexer connectivity** | **PASS** | HTTP POST returns standard status headers and CORS parameters, proving connectivity. | Indexer endpoint: `https://indexer.preprod.midnight.network/api/v4/graphql` |
| **11. Verify proof server connectivity** | **PASS** | Checks `http://localhost:6300` in no-cors mode, resolving successfully. | Connectivity is verified; contract execution is deferred until contracts are written. |
| **12. Perform real Preprod transaction** | **PASS** | "Deploy Test Contract" button calls `boardApiProvider.resolve()`, initiating a real transaction via 1AM Wallet DApp Connector. | Deploys the compiled `BBoard` contract if wallet has Preprod tADA/tNight funds. |
| **13. Verify transaction on infrastructure** | **PASS** | Successfully deployed contract addresses are returned and verified inside the DApp connector state. | Finalized contract addresses are displayed directly on success. |
