# Zephyr Nexus (风之灵枢)

> **The Open-Source Orchestration Platform for Autonomous AI Companies.**

Zephyr Nexus (风之灵枢) is an open-source orchestration platform for autonomous AI companies. It is designed to manage the lifecycle, governance, and monitoring of collective AI agent teams, scaling beyond single-agent tasks to full-scale autonomous operations.

### What does "风之灵枢" mean?
**风之灵枢** (Fēng zhī Língshū) translates to **"Zephyr Nexus"**. 
- **风 (Zephyr)** represents the swift, invisible, and life-giving force of AI intelligence and data flow.
- **灵枢 (Nexus/Pivot)** refers to the central axis or spiritual hub that coordinates these forces into a coherent, goal-aligned organizational structure.

## ✨ Key Features

- **🏢 Multi-Company Orchestration**: Run multiple independent AI companies from a single deployment.
- **📊 Org Charts & Roles**: Define clear hierarchies, reporting lines, and job descriptions for your agents.
- **🎯 Goal Alignment**: Every agent task is traced back to high-level company objectives.
- **🛡️ Governance & Budgeting**: Monitor token costs in real-time and enforce strict budget limits.
- **💓 Heartbeats**: Scheduled and event-driven agent triggers to keep your business running 24/7.
- **🔌 Bring Your Own Agent**: Works seamlessly with OpenClaw, Claude Code, Codex, Cursor, and custom runtimes.

---

## 🚀 Canonical Startup

### 1. Environment Setup
```bash
# Clone and enter the workspace
cd ZephyrNexus

# Install dependencies (requires pnpm)
pnpm install
```

### 2. Development Flow (Application Layer)
Standard development for the Server and UI:
```bash
pnpm run dev
```
- **UI**: [http://localhost:3000](http://localhost:3000)
- **API**: [http://localhost:3100](http://localhost:3100)

### 3. Platform Operations (AetherStack Control Plane)
Use the control plane scripts to manage the entire platform state (including sidecars like OpenClaw and Browser-Use):
```bash
# Verify environment readiness
./scripts/health-check.sh

# Start all registered services
./scripts/start-all.sh

# Stop all registered services
./scripts/stop-all.sh
```

---

## 🏗️ Architecture & Naming Model

Zephyr Nexus utilizes **AetherStack** as its control plane layer to orchestrate the monorepo and its dependencies.

| Component | Canonical Name | Purpose |
| :--- | :--- | :--- |
| **Repo/Workspace** | **ZephyrNexus** | The physical repository and monorepo structure. |
| **Product** | **Zephyr Nexus** | The public brand and user-facing application name. |
| **Display Name** | **风之灵枢** | The primary Chinese display name. |
| **Control Plane** | **AetherStack** | The script engine and orchestration layer (`scripts/`, `infra/`). |
| **Main Service** | **`zephyr-nexus`** | The runtime service name in `workspace.config.json`. |
| **Runtime Base** | **Paperclip** | The underlying "AI Operating System" technical foundation. |

---

## 📖 Documentation

- [Project Soul & Identity](IDENTITY.md)
- [OpenClaw Onboarding](docs/OPENCLAW_ONBOARDING.md)
- [Development Guide](doc/DEVELOPING.md)
- [Workspace Configuration](workspace.config.json)

---

## 📜 Technical Attribution

Zephyr Nexus incorporates and builds upon the **Paperclip AI OS** codebase. We retain "Paperclip" as a technical attribution and package namespace (`@paperclipai/*`) to honor its origins while moving forward under the **Zephyr Nexus** brand.

---

MIT &copy; 2026 Zephyr Nexus
