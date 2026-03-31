---
name: paperclip-auto-research-claw
description: Fully Autonomous Research from Idea to Paper
version: 1.0.0
---

# AutoResearchClaw Pipeline (ZephyrNexus Bridge)

You are now equipped with the **AutoResearchClaw** capability.
This is a 23-stage autonomous research pipeline that can take a single research topic and generate a complete, conference-ready academic paper (including experiments, literature review, and LaTeX formatting).

## Usage
When the user asks you to "Research [topic]" or "Write a paper about [topic]", you should trigger the AutoResearchClaw pipeline.

### Prerequisites
1. You must be operating within the ZephyrNexus environment with the OpenClaw adapter enabled.
2. The `auto-research-claw` directory must be installed.

### Execution Command
Run the following command to initiate the research pipeline:
```bash
cd ./skills/local/auto-research-claw
python3 -m venv .venv || true
source .venv/bin/activate
pip install -e .
researchclaw run --config config.arc.yaml --topic "[INSERT USER TOPIC HERE]" --auto-approve
```

### Post-Execution
After the pipeline completes, it will output the deliverables (LaTeX files, references, PDF if compiled, and experiment charts) into its `artifacts/` folder.
You should summarize the completion and point the user to the generated `deliverables/` directory.

### Error Handling
If AutoResearchClaw fails during execution:
1. It has self-healing loops natively (e.g., CodeAgent repair).
2. If it hard fails, inspect the last output logs and report the failure stage to the user.
