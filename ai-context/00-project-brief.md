# Project Brief: Zephyr Nexus (风之灵枢)

## Core Objective
Zephyr Nexus is a control plane for AI-agent companies. It manages the lifecycle, orchestration, and monitoring of autonomous agents in a collaborative environment.

## Architecture
- **Server**: Express.js REST API.
- **UI**: React + Vite (Zephyr Nexus branding).
- **Database**: Drizzle ORM + PostgreSQL (PGlite in dev).
- **Shared**: Monorepo using `pnpm` workspace for shared types and logic.

## Key Principles
- **Company-scoped**: All data and actions must be isolated by company.
- **Control Plane**: Focus on governance, auditing, and budget management.
- **Tool-Agnostic**: Designed to work with various LLM backends and agent frameworks.
