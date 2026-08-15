# Production Deployment Manual

This document details the manual steps to build, configure, and host the **Confidential Splits** DApp in a production environment.

---

## 1. Prerequisites & Dependencies

Before deploying, ensure you have:
* **Node.js**: `v24.11.1` or higher.
* **1AM Wallet Extension**: Chrome or Edge extension installed on client browsers.
* **Local Proof Server**: Docker proof server running on client machines (`http://localhost:6300`).

---

## 2. Manual Deployment Steps

The DApp is packaged as a single-page React static site. It can be hosted on any static hosting provider (e.g., Netlify, Vercel, Cloudflare Pages, or AWS S3).

### Step 1: Install Dependencies
Run the package installation from the workspace root:
```bash
npm install
```

### Step 2: Compile Contracts & Copy ZK Keys
Compile the smart contract to generate ZK circuits and mappings:
```bash
npm run compact --workspace=contract
```
This automatically updates compiled files inside `contract/src/managed/`.

### Step 3: Build the UI Workspace
Run the production build command:
```bash
npm run build --workspace=bboard-ui
```
This script executes the following sequence:
1. Runs `copy-zk-keys.js` to map and transfer all compiled Splits and BBoard ZK keys into `public/keys` and `public/zkir`.
2. Compiles TypeScript modules.
3. Invokes Vite build configured for the **Preprod network** (`--mode preprod`).
4. Outputs the fully bundled static files in `bboard-ui/dist/`.

### Step 4: Host Static Output
Deploy the generated contents of the `bboard-ui/dist/` directory to your static hosting provider.
* **Vercel**: Run `npx vercel ./bboard-ui/dist`
* **Netlify**: Run `npx netlify deploy --dir=./bboard-ui/dist`
* **Local HTTP Server**: Run `npx http-server ./bboard-ui/dist --port 8080`

---

## 3. Production Hardening Verification

* **Network Targeting**: The build targets Preprod network configurations by default. Ensure the browser's connected **1AM Wallet** network is set to **Preprod** to route transactions correctly.
* **Assets Serving**: Prover keys (`/keys/*`) and compilation outputs (`/zkir/*`) are served statically from the deployment root. Ensure the hosting provider does not block access to these directories.
