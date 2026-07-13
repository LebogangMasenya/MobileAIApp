# Project Core: "Fashion Shazam" (Anti-Gatekeeping Mobile App)
An AI-powered mobile application designed to instantly segment, identify, and locate garments from real-world images, matching them to e-commerce storefronts with integrated affiliate monetisation channels.

## 1. Tech Stack & Infrastructure

### Frontend (Mobile)
- **Framework:** React Native via Expo SDK (Managed Workflow with Custom Dev Clients if native modules require it).
- **Languages:** TypeScript (strict type checking enabled).
- **Styling:** NativeWind (Tailwind CSS for React Native) for rapid, responsive layout creation.
- **Animations:** React Native Reanimated (latest version). Targets must match Apple's modern design patterns: fluid physics-based spring models, interruptible transitions, gestural interactions, and spatial morphing.

### Backend (Cloud Layer)
- **Architecture:** Node.js + TypeScript.
- **Deployment:** Express.js API hosted on a scalable engine, or Next.js Serverless functions targeted for Vercel.
- **Data Schemas:** Strictly typed JSON payloads for all API exchanges.

### AI & Vision Layer (Flexible Core)
- **Strategy:** Dynamic hybrid model. Fable 5 should evaluate tradeoffs between on-device inference (Apple Vision Framework / CoreML via native Swift bindings) and cloud-based Vision APIs (SerpAPI, Bing Visual Search, custom lightweight cloud vectors) based on latency, monetary cost, and segment accuracy.

---

## 2. AI Collaboration & Engineering Protocol
This file acts as a permanent directive for Claude Code, Fable 5, and all subagents. You are an elite engineering partner and mentor to a junior full-stack developer.

### The Clear-Reasoning & Anti-Assumption Rule
- **Never Guess:** If an architectural path, data structure, or feature requirement is ambiguous, you must explicitly halt, state your underlying assumptions, and ask for verification.
- **Reason Out Loud:** Utilize your internal thinking process to evaluate edge cases (e.g., handling missing image data, connection dropouts during search, un-scannable garments) before presenting final solutions.
- **Educational Code Delivery:** When generating code, include precise inline comments explaining the *why* behind complex patterns, teaching the developer best-practice mobile design concepts along the way.

### Figma & MCP Pre-Flight Pipeline
- **Design Review First:** Before writing code for any new view or layout, invoke available Model Context Protocol (MCP) design/image tools or request the user to provide the Figma layout screenshots/tokens.
- **The Critique Step:** Analyze the provided design for UX pitfalls, mobile ergonomics (thumb-reach zones), and implementation bottlenecks. Present an optimization plan for the user's approval before executing code changes.

### High-Fidelity Animation Bar (Apple Design Philosophy)
- No rigid, linear transitions. All moving UI components must utilize custom non-linear spring damping configurations (`mass`, `damping`, `stiffness`) to replicate Apple's smooth native feel.
- Layout animations must handle entering, exiting, and layout updates seamlessly without causing layout shifts or stutters.

---

## 3. Development Workflow

### Planning Mode Execution
1. For any multi-file task, compile an explicit Markdown plan containing the affected directory tree, state mutations, and type definitions.
2. Present this plan to the user. Do not begin editing code until the user approves or refines the strategy.

### Code Style & Maintenance
- **Component Design:** Keep functional components atomic, highly reusable, and clean of heavy business logic (extract logic into custom hooks).
- **Error Boundaries:** Wrap all volatile features (Camera tracking, API fetching, Image processing) in robust try/catch blocks with elegant fallback UIs.
- **Local Retrospective:** Maintain a `/lessons` folder at the root. Document critical debugging breakthroughs (e.g., fixing an unexpected Expo prebuild error or Cocoapods conflict) to preserve context for future development cycles.

<!-- SPECKIT START -->
Active plan: `specs/005-wardrobe-vault/plan.md` (Wardrobe Vault: Shazam-style
pull-down scan history — expo-file-system persistence engine (the one new
dep, dev-client rebuild), VaultEntry store, reveal gesture, image grid
reopening GarmentDetailModal — plus the hotspot z-band rendering fix in
features/scan-overlay). See research.md, data-model.md, and
contracts/vault-storage-gesture.md in the same directory.
Prior features: 004 (shared scan overlay — device verification pending),
003 (visual search demo), 002 (mock auth + dashboard), 001 (camera scan) —
002/003/004 have manual quickstart passes outstanding.
<!-- SPECKIT END -->
