# ZeroWaste AI: Agentic Intelligence for Smarter Grocery Inventory
## GDGoC HITAM Agentic AI Hackathon — Problem Statement 2 Presentation

---

# Slide 1: Title & The Mission
## ZeroWaste AI: Eliminating Grocery Waste Through Agentic Intelligence
- **Team**: Antigravity Engineers
- **Hackathon Track**: GDGoC HITAM Agentic AI Hackathon — Problem Statement 2: Zero-Waste Grocery
- **Deployed App**: [INSERT DEPLOYED URL]
- **GitHub Repository**: [INSERT GITHUB URL]

[INSERT SCREENSHOT: Overview 3D Quantum FIFO Core]

---

# Slide 2: The Problem — The $400B Grocery Waste Crisis
- **Financial Toll**: Over $400 Billion in fresh food is written off annually in retail supermarkets.
- **The Operational Dilemma**:
  - Overstocking causes accelerated expiration and direct landfill waste.
  - Understocking causes stockouts, lost sales margins, and frustrated customers.
- **Why Traditional Systems Fail**:
  - Legacy ERPs use rigid, static min/max $(s, S)$ reorder thresholds.
  - They ignore physical batch-level expiry clocks and non-linear demand spikes (payday cycles, weekends).
  - Human store managers lack the time to compute complex markdown elasticity trade-offs across thousands of SKUs.

---

# Slide 3: The Solution — Coordinated Multi-Agent Architecture
ZeroWaste AI replaces static thresholds with **5 collaborative agents** governed by a **deterministic safety coordinator**:

1. **Demand Forecaster (`DemandAgent`)**: Runs an empirical 3-model tournament (Seasonal-Naive, 7-day MA, SES) with 80% prediction intervals.
2. **Expiry Auditor (`SpoilageRiskAgent`)**: Simulates physical FIFO batch depletion and quantifies unsold waste risk.
3. **Inventory Auditor (`InventoryAgent`)**: Audits days-of-supply and prevents over-replenishment.
4. **Action Optimizer (`RecommendationAgent`)**: Evaluates expected loss across 5 candidate actions (No Action, Markdowns 10–50%, Donations, Transfers, Replenishments).
5. **Deterministic Arbiter (`CoordinatorAgent`)**: Enforces zero-hallucination mathematical bounds and selects the optimal lowest-loss action.

[INSERT SCREENSHOT: 5-Agent Command Center & Counterfactual Replay]

---

# Slide 4: 3D Vibe Coding & Futuristic Interface
A cutting-edge retail operations dashboard built with **Three.js** and **React Three Fiber**:
- **Quantum FIFO Core**: Real-time 3D particle sphere and wireframe geodesic globe with orbiting category nodes.
- **3D Isometric Shelves**: Interactive multi-tier retail shelving unit with color-coded shelf-life cubes (Green = Fresh, Amber = Warning, Red = Expiring <48h).
- **Time-Travel Horizon Simulator**: Interactive day-offset slider (0 to +7 days) to simulate future batch aging in real time.
- **ZeroWaste Copilot AI Bot**: Floating interactive copilot answering natural language queries grounded directly in live database state.

[INSERT SCREENSHOT: 3D Isometric Shelf Visualizer & Time-Travel]

---

# Slide 5: Scientific Validation — Benchmark Results
*Results copied from a real multi-seed simulation run (5 seeds, synthetic data, 14-day horizon on identical starting inventory and customer demand sequences):*

### Benchmark: `demand_spike` Preset (+40% Demand Surge)
| Metric | FIFO-Only Baseline | Fixed-Threshold Baseline | ZeroWaste AI (Agentic) | Impact / Advantage |
| :--- | :---: | :---: | :---: | :---: |
| **Service Level** | 28.76% | 57.91% | **96.87%** | **+38.96% availability** |
| **Stockout Units** | 286.4 units | 177.2 units | **12.6 units** | **95.6% stockout reduction** |
| **Waste Units** | 0.0 units | 0.0 units | 0.0 units | n/a (high sell-through) |
| **Net Profit Margin** | $166.04 | $224.82 | **$268.79** | **+$43.97 profit increase** |
| **Engine Runtime** | 0.12 ms | 0.14 ms | 19.86 ms | Real-time interactive latency |

### Benchmark: `excess_inventory` Preset (+50% Initial Overstock)
| Metric | FIFO-Only Baseline | Fixed-Threshold Baseline | ZeroWaste AI (Agentic) | Impact / Advantage |
| :--- | :---: | :---: | :---: | :---: |
| **Service Level** | 46.46% | 77.64% | **99.93%** | **Near-perfect availability** |
| **Stockout Units** | 154.8 units | 83.2 units | **0.2 units** | **Eliminated stockouts** |
| **Net Profit Margin** | $240.04 | $280.71 | **$272.82** | Balanced margin recovery |

---

# Slide 6: Sustainability & Environmental Impact
- **Global Food Waste Factor**: Every 1 kg of grocery food waste prevented saves **$2.50\text{ kg CO}_2\text{e}$** in greenhouse gas emissions (FAO UN standard).
- **Automated Food Rescue (Donations)**: Items nearing expiration with $\ge 1$ day remaining are automatically routed to local food banks, capturing tax recovery while achieving zero waste.
- **Inter-Store Balancing**: Overstocked items are transferred to deficit stores within the network, preserving fresh margins and avoiding landfill disposal.

[INSERT SCREENSHOT: Spoilage Risk Simulator & Sustainability Panel]

---

# Slide 7: Enterprise Safety & Fail-Closed Architecture
- **Fail-Closed Security**: Zero API keys or database URLs in client bundles; browser communicates strictly through server proxy.
- **Human-in-the-Loop Planner**: Inventory managers retain full control to calibrate quantities or reject proposals.
- **Atomic Verification**: Stock is re-verified at the exact millisecond of execution; changed inventory triggers safe failure.
- **Rejected Proposals Execute Nothing**: Strict guarantee that rejected proposals never execute write-offs or adjustments.

[INSERT SCREENSHOT: Inventory Planner Center with Copilot Drawer]

---

# Slide 8: Summary & Links
- **Working Prototype**: Fully functional full-stack system deployed on Vercel with Neon Serverless Postgres.
- **Automated Verification**: 46 backend unit tests passing; 0 console errors across all viewports; clean secret canary audit.
- **Live Deployment**: [INSERT DEPLOYED URL]
- **Source Code**: [INSERT GITHUB URL]

*ZeroWaste AI — Agentic Intelligence for Smarter Grocery Inventory.*
