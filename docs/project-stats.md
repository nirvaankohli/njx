# DocShield: investor-relevant statistics

Prepared from `docs/company.md`, `docs/technical.md`, the NJX hackathon materials in `agents/assets/njx`, and a static count of the current repository on June 21, 2026.

## Best headline proof points

| Statistic | What it proves | Investor-safe phrasing |
|---|---|---|
| 4 trust questions answered | Clear product value | “For every protected file, DocShield answers four questions: who issued it, whether it changed, what use is allowed, and what happened when it was shared.” |
| 2 complementary trust modes | Product architecture | “Portable passports provide evidence; secure links add control and visibility.” |
| 8 verification layers | Technical depth | “Verification checks registry identity, manifest integrity, issuer signature, history integrity, source fingerprint, key status, revocation, and usage policy.” |
| 8 behavioral signals | Monitoring breadth | “The risk engine watches eight per-document behaviors, including bursts, blocked attempts, new geographies, and multi-client access.” |
| 6 verifier outcomes | Actionable result model | “A file resolves to one of six explicit trust states, including valid, tampered, revoked, and metadata stripped.” |
| 23 implemented API routes | Working product surface | “The prototype exposes 23 backend routes across registration, lifecycle, sharing, verification, telemetry, and reporting.” |
| 44 named automated test cases | Execution evidence | “The repository contains 44 named backend and frontend test cases: 26 backend and 18 frontend.” This is a static count, not a passing-test claim. |
| 6–10 week pilot | Concrete GTM motion | “The first enterprise design partnership is structured as a 6–10 week pilot with measurable verification, enforcement, alert-quality, and workflow-friction outcomes.” |
| 2–3 initial design partners | Focused 12-month objective | “The next milestone is two or three design partners around external AI-upload policy for high-value documents.” |
| 4 monetization paths | Commercial optionality | Platform subscription, enterprise contract, API/SDK usage, and monitoring add-on. These are hypotheses, not validated pricing. |
| 5 competitive categories | Category awareness | Secure sharing/VDR, DRM, AI DLP, provenance standards, and certificate signatures. |
| 6 moat-building vectors | Defensibility thesis | Policy-schema adoption, trust network, integrations, privacy-safe baselines, compliance evidence, and open-core interoperability. |

## Technical numbers worth using selectively

- SHA-256 fingerprints bind the passport to exact source bytes.
- Ed25519 signs canonical manifests and lifecycle events.
- AES-256-GCM encrypts and authenticates the embedded passport.
- A 12-byte fresh nonce is generated for each protected file.
- The anomaly model uses an `8 → 8 → 3 → 8 → 8` autoencoder.
- Risk is scored from 0–100; 50–79 is medium and 80–100 is high.
- Up to three explanation codes accompany a risk score.
- Only post-warm-up events scoring below 40 update the model, reducing normalization of obvious attacks.

These details establish technical credibility but should not dominate the main pitch. Keep most of them in the appendix.

## NJX event statistics: context, not investor evidence

- Judging weights shown in the launch deck: real value 25%, execution 20%, customer fit 15%, innovation 15%, and pitch/storytelling 15%. The displayed weights total 90%, so do not repeat them as a complete scoring model without asking organizers about the missing 10%.
- The event expected a 5–7 minute presentation including questions, while the mission briefing also says judges should believe the idea in three minutes.
- The launch deck claims “23,019 vulnerabilities uncovered” and “97 patches shipped” in six weeks for a fictionalized or event-specific “Claude Mythos Preview / Project Glasswing” narrative. Do not use this as an investor market statistic unless independently verified from a primary source.

## Claims to avoid

- “Unremovable watermark.” Use “tamper-evident encrypted document passport.”
- “Stops every AI upload.” Use “a signed policy declaration enforced by compatible gateways or endpoints.”
- “Tracks every copy.” Use “secure-link telemetry while distribution remains in the controlled flow.”
- “Zero-content backend” as a current fact. The prototype stores encrypted document blobs server-side. Present content-blind/customer-hosted processing as the production architecture being built.
- “AI detects theft.” Use “an online anomaly score prioritizes unusual access for review.”

## Missing investor statistics to obtain next

1. Number of customer interviews and exact repeated pain signals.
2. Number of design-partner commitments or letters of intent.
3. Time required to protect, share, and verify a file in user tests.
4. Percentage of targeted AI upload paths in a pilot that honor policy.
5. Alert precision/recall or at minimum human-reviewed useful-alert rate.
6. Pricing willingness and expected annual contract value.
7. Addressable document volume inside one beachhead workflow.
8. Founder-market-fit evidence and relevant security, compliance, or enterprise distribution credentials.

