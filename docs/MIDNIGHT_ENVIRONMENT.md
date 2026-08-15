# Midnight Preprod & 1AM Wallet Environment Setup

This document describes the configurations, environments, and services required to run the **Confidential Splits** DApp on the Midnight Preprod network.

## 1. Environment Details

### Midnight Preprod Network
* **Network ID:** `'preprod'`
* **RPC Endpoint:** `https://rpc.preprod.midnight.network`
* **Indexer GraphQL HTTP Endpoint:** `https://indexer.preprod.midnight.network/api/v4/graphql`
* **Indexer GraphQL WebSocket Endpoint:** `wss://indexer.preprod.midnight.network/api/v4/graphql/ws`

### Local Zero-Knowledge Proof Server
* **Docker Image:** `midnightntwrk/proof-server:8.0.3`
* **Port Mapping:** `6300:6300`
* **Endpoint:** `http://localhost:6300`
* **Compatibility:** Strictly compatible with the Midnight JS SDK v4.1.1.

### Compact Compiler & Toolchain
* **Compact CLI Tool version:** `0.5.1` (installed at `/home/sylvia/.local/bin/compact`)
* **Compact Compiler version:** `0.31.1` (installed at `/home/sylvia/.compact/versions/0.31.1/x86_64-unknown-linux-musl/compactc`)

---

## 2. 1AM Wallet Setup & Configuration

1. **Extension Installation:** Download and install the **1AM Wallet** extension in Chrome.
2. **Select Preprod Network:**
   * Open the 1AM Wallet extension.
   * Configure the active network to **Midnight Preprod**.
3. **Local Proof Server Setup:**
   * In the wallet's configuration settings, enable local proof generation and set the endpoint URL to `http://localhost:6300`.
4. **Injected Object:**
   * The wallet injects its DApp Connector API under `window.midnight['1am']`.

---

## 3. Toolchain & WSL Environment Integration

When running in a Windows Host with WSL2, ensure you export the paths to the Linux binaries explicitly to prevent fallback to Windows `.cmd` executables (which fail UNC path checks).

```bash
# Export path for Node/npm and the Compact CLI toolchain
export PATH="/home/sylvia/.nvm/versions/node/v24.18.1/bin:/home/sylvia/.local/bin:/home/sylvia/.compact/versions/0.31.1/x86_64-unknown-linux-musl:$PATH"
```

### Key Scripts
* **Smart Contract Compilation:**
  ```bash
  npm run compact --workspace=contract
  ```
* **Contract/TypeScript Build:**
  ```bash
  npm run build --workspace=contract
  ```
* **UI Server Build:**
  ```bash
  npm run build --workspace=bboard-ui
  ```

---

## 4. Troubleshooting & Notes

* **Proof Server Connection Reset:**
  * When first starting up, the Docker proof server fetches zero-knowledge proving and verifying keys (Zswap/Dust parameters) from AWS S3 storage.
  * During the download (around 20-30 MB of keys), requests to `http://localhost:6300` will return connection resets.
  * Wait 1-2 minutes and monitor logs via `docker logs -f proof-server-local` until you see parameter downloads verify successfully.
* **Mixed Content & CORS in Browser:**
  * Browsers blocking HTTP localhost requests from HTTPS Preprod resources are bypassed in checking code by setting the request fetch mode to `no-cors`, which returns an opaque status (`0`) verifying server connectivity.
