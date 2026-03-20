# Team Meeting: Product Direction + 1.0 Scope
**Date:** 2026-03-20

---

## Theme
Shift from blueprint tool → shippable product.

---

## 1.0 Feature Set

### Must Ship
| Feature | Owner |
|---|---|
| Settings screen (profiles, regions, theme, LocalStack endpoint) | Product + Canvas |
| Multi-region scan (regions[] param, parallel, nodes tagged by region) | Backend |
| Auto-update (electron-updater + GitHub Releases CI job) | QA |

### Should Ship
| Feature | Owner |
|---|---|
| Canvas PNG export (Electron capturePage()) | Canvas |
| Cost estimation (bundled pricing.json from AWS Price List API) | Backend |
| App identity (icon, About screen, tagline in title bar) | Product |

### Nice (1.0 if time allows, else 1.1)
| Feature | Owner |
|---|---|
| Node annotations (text on nodes, persisted in Electron store) | Canvas |
| Opt-in crash telemetry (stack traces only, no credentials/resource data) | QA |

---

## Cut to 1.1
- IPC contract integration tests
- Collapsible subnet groups (post multi-region)
- Auto Scaling Groups
- First-run onboarding wizard (needs settings screen first)

---

## Dependencies
- Settings screen is prerequisite for: multi-region UI, onboarding wizard, annotation persistence, telemetry opt-in
- Multi-region is prerequisite for: collapsible subnet groups, ASG

---

## Open Questions
- Annotation persistence: Electron store (survives reinstall) vs useUIStore (session only)?
- Cost estimation: static bundled table vs live AWS Pricing API at runtime?
- Telemetry endpoint: Sentry free tier vs self-hosted vs skip for 1.0?
- What triggers the 1.0 version tag — a specific feature gate or a date?

---

## Board (carry-forward)
- Auto Scaling Groups: post-1.0. Open Q: container node or flat with integration edges?
- Multi-region UI: multi-select confirmed by user.
- Collapsible subnet groups: post multi-region (Canvas has the design).
- Settings/Preferences screen: new milestone, prerequisite for multiple features.
