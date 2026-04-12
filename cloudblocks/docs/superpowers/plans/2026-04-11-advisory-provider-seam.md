# Advisory System Provider Seam — Architectural Decision

**Author:** Architect  
**Date:** 2026-04-11  
**Status:** Decision recorded — no implementation required now

---

## The Question

If Terminus adds Azure or GCP plugins (M6), where does the advisory rule system need to change so it accommodates provider-specific rules without a painful refactor?

---

## Current Shape

- `AdvisoryRuleId` in `src/renderer/types/cloud.ts` — a flat string union of all known AWS rule IDs
- `analyzeNode(node: CloudNode): Advisory[]` in `src/renderer/utils/analyzeNode.ts` — a single function that switches on `node.type`
- `TerminusPlugin` interface in `src/main/plugin/types.ts` — has `id`, `nodeTypes`, `scan()`, etc., but **no advisory hook**

## The Seam

**One addition to `TerminusPlugin` is all that's needed:**

```typescript
// In src/main/plugin/types.ts — add to TerminusPlugin interface
analyzeNode?(node: CloudNode): Advisory[]
```

With this optional method:
- `analyzeNode.ts` becomes the AWS implementation: it runs its existing rules for AWS-owned node types
- A future `azurePlugin` or `gcpPlugin` implements `analyzeNode` for its own types
- The shared `FirstScanSummary` / advisory queue calls a dispatcher:

```typescript
// In src/renderer/utils/analyzeNode.ts — when M6 lands, replace with:
export function analyzeNode(node: CloudNode, pluginAdvisoryFn?: (n: CloudNode) => Advisory[]): Advisory[] {
  const base = awsAnalyzeNode(node)           // existing AWS rules
  const extra = pluginAdvisoryFn?.(node) ?? []
  return [...base, ...extra]
}
```

**`AdvisoryRuleId`** does not need to become provider-namespaced. Plugin rules can use string literals that don't conflict with AWS rule IDs if plugins use their own prefix convention (e.g. `'azure-vm-no-disk-encryption'`). The type stays a union — plugins extend it via module augmentation when they register. This is the same pattern as `NodeType` extensibility via `pluginNodeTypes` in `useUIStore`.

---

## What NOT to Do Now

- Do not refactor `analyzeNode.ts` today — the seam is clear, the refactor is one hour of work when M6 arrives
- Do not add `analyzeNode?` to `TerminusPlugin` until there is a real second provider — premature abstraction
- Do not namespace `AdvisoryRuleId` (e.g. `'aws:lambda-no-timeout'`) — breaking change for no gain; prefix convention is sufficient

---

## Decision

The advisory system is **ready for M6 without changes**. The seam is: add `analyzeNode?` to `TerminusPlugin` and a thin dispatcher in the renderer utility. Record this doc, revisit when a second provider plugin is being built.
