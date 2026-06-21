# DocShield investor presentation script

**Format:** 12-slide, 9–10 minute pre-seed pitch, followed by Q&A  
**Audience:** early-stage cybersecurity, enterprise software, and AI-infrastructure investors  
**Core claim:** DocShield is the policy-aware document passport and verification network for enterprise files moving across organizational and AI boundaries.

## Narrative spine

Enterprise controls are strong while files remain inside managed systems. The moment a sensitive document crosses a company or application boundary, its identity, policy, and history separate from the file. AI makes that gap urgent. DocShield binds those signals to the asset, gives enforcement points a deterministic decision, and adds visibility when the file moves through a controlled link.

---

## Slide 1 — The file crossed the boundary. Its rules did not.

**On slide**

DocShield  
The trust layer for documents entering AI workflows

**Visual direction**

A single sensitive document crossing from one organization into another, with its policy visibly staying attached. Use the NJX deck’s dark black-and-electric-blue atmosphere, but replace the event branding with DocShield’s existing mark and wordmark.

**Speaker script — 35 seconds**

“Every enterprise has controls around its data—until a document leaves the system that created it. A contract is emailed to outside counsel. A security report reaches a customer. A diligence file is uploaded into an AI tool. At that moment, the sender’s identity, sharing rules, and AI policy usually stop traveling with the file. DocShield gives that file a signed, machine-readable passport, so the next system can know who issued it, whether it changed, what is allowed, and what happened when it was shared.”

**Transition**

“The problem is not that enterprises have no controls. It is that those controls end at the boundary.”

---

## Slide 2 — Managed systems protect containers, not traveling assets

**On slide**

Inside the tenant: identity, labels, policy, logs  
Outside the tenant: an attachment

**Supporting line:** AI turns lost context into an immediate policy risk.

**Visual direction**

One file moving from a managed repository through email or a partner portal toward an external AI application. The left side is structured; the right side loses the policy layer.

**Speaker script — 50 seconds**

“DLP, document management, and virtual data rooms work best while the file remains inside their environment. But high-value business documents must move—across firms, vendors, customers, auditors, and now AI applications. Ordinary metadata is easy to strip. Email attachments lose revocation and access visibility. And a label like ‘do not upload to external AI’ is not useful if the receiving gateway cannot verify who set it or whether it belongs to this exact file. The result is a growing trust gap between the document owner and every downstream system asked to handle it.”

**Investor emphasis**

This frames incumbents as incomplete infrastructure and potential distribution partners, not straw-man competitors.

---

## Slide 3 — Four questions every sensitive file should answer

**On slide**

1. Who issued it?  
2. Has it changed?  
3. What is allowed?  
4. What happened when it was shared?

**Visual direction**

One document in the center with four sparse callouts. Avoid a dashboard screenshot here; make the mental model instantly legible.

**Speaker script — 45 seconds**

“DocShield turns document trust into four deterministic questions. Who issued this file? Has a byte changed? What policy applies—including whether external AI is allowed? And, when the sender uses controlled distribution, what happened after sharing? Today those answers live in separate systems, disappear at organizational boundaries, or do not exist. DocShield packages them into one verification layer designed for people, enterprise applications, and AI gateways.”

**Transition**

“We deliver that through two complementary modes, because evidence and control are different jobs.”

---

## Slide 4 — Portable evidence. Controlled visibility.

**On slide**

**Portable passport** — issuer, integrity, policy, lifecycle  
**Secure link** — access controls, revocation, telemetry, anomaly alerts

**Footer:** Evidence travels. Control applies where the channel is controlled.

**Visual direction**

A simple two-path composition: downloadable protected file on one path; secure link on the other. Keep the guarantees visually distinct.

**Speaker script — 60 seconds**

“The first mode is a portable protected file. DocShield fingerprints the exact PDF or DOCX, signs a canonical manifest with the issuer’s Ed25519 identity, chains lifecycle events, and embeds an encrypted passport. A compatible verifier can detect tampering, revocation, or missing metadata and evaluate the signed AI policy. The second mode is a secure link. It adds expiry, password or organization restrictions, revocation, access telemetry, and anomaly scoring. The portable file provides evidence; the controlled link provides stronger operational visibility. We are deliberate about that distinction: DocShield is tamper-evident, not magically uncopyable.”

**Demo cue — optional 45 seconds**

Protect a PDF, download it, verify the valid state, then show the same workflow denying an external-AI operation or surfacing a suspicious access event.

---

## Slide 5 — The wedge: policy at the AI upload point

**On slide**

Supplier signs `NO_EXTERNAL_AI`  
Recipient gateway verifies  
Upload is blocked or routed to an approved model  
Both sides retain evidence

**Visual direction**

A four-step horizontal flow. The document passport reaches a gateway before any content reaches the model.

**Speaker script — 60 seconds**

“Our beachhead is not generic file sharing. It is policy ambiguity when sensitive documents enter AI-enabled workflows across companies. Imagine a supplier issuing a security report with a signed `NO_EXTERNAL_AI` policy. The recipient’s AI gateway verifies the issuer, the exact file, its revocation state, and the requested operation. It can block the upload or route the file to an approved private model. Both organizations retain a verifiable issuance and decision record. This is the missing connective tissue between document owners, recipients, and the growing class of AI enforcement products.”

**Transition**

“This wedge fits existing security budgets because DocShield complements the enforcement stack rather than asking customers to replace it.”

---

## Slide 6 — Built to integrate, not replace the stack

**On slide**

DocShield sits between:

- Document systems
- Email and collaboration
- DLP and secure browsers
- AI gateways and applications
- Audit and compliance workflows

**Visual direction**

A restrained ecosystem map with DocShield as the passport and verification layer—not a giant central vault.

**Speaker script — 50 seconds**

“The competitive landscape spans secure sharing, DRM, DLP, signatures, and provenance standards. Each category solves part of the problem. DocSend and Digify control distribution. Microsoft Purview and Nightfall enforce policy inside managed channels. Adobe signatures establish authenticity. C2PA is building an interoperable provenance standard. DocShield’s opportunity is the layer between them: issuer-signed enterprise policy, cross-company verification, lifecycle evidence, and secure-share monitoring. That makes incumbents integration targets and potential channels, while our differentiation lives in the policy schema, trust network, and operating layer.”

**Presenter note**

Do not say “we have no competitors.” Say the market is fragmented around containers, channels, and formats.

---

## Slide 7 — A working end-to-end prototype, not a concept deck

**On slide**

23 API routes  
44 named test cases  
8-layer verification  
8-signal risk engine

**Supporting line:** Registration → signing → protected delivery → verification → telemetry → audit export

**Visual direction**

Use one strong product screenshot—preferably document verification or the dashboard—beside the four proof points. Avoid showing seeded demo totals as traction.

**Speaker script — 55 seconds**

“We have built the complete prototype loop. The product registers tenants and keys, signs manifests and lifecycle events, embeds an encrypted passport, issues controlled links, verifies protected files, scores unusual access, and exports audit history. The backend currently exposes 23 routes. The repository contains 44 named backend and frontend test cases. Verification evaluates eight layers of trust, while the risk engine watches eight per-document behavioral signals. This is early software, but it is real enough to put in front of design partners and measure the workflow.”

**Accuracy note**

The 44 figure is a static count, not a passing-test assertion. Do not imply production readiness.

---

## Slide 8 — Start where the document is valuable and the boundary is unavoidable

**On slide**

Beachhead workflows:

- Vendor security and audit reports
- Legal diligence and privileged work product
- Regulated partner documents

**Buyer:** security, risk, or legal  
**Users:** document owner, recipient, auditor, AI gateway team

**Visual direction**

Three representative document types, not a generic industry-logo wall.

**Speaker script — 50 seconds**

“We will begin with workflows where three conditions are true: the document is high value, it must cross an organizational boundary, and the recipient is likely to use AI. Vendor security reports, legal diligence files, and regulated partner documents are strong starting points. The economic buyer is security, risk, or legal. The daily user is the document owner, while recipients and AI platform teams become part of the verification network. That gives us an enterprise buyer, a measurable risk, and a path to network effects across organizations.”

---

## Slide 9 — Land with a measurable 6–10 week pilot

**On slide**

Pilot scorecard:

- Time to protect and send
- Recipient verification rate
- AI policy enforcement coverage
- Alert usefulness
- Workflow friction
- Complete lifecycle evidence

**Visual direction**

A clean scorecard with target fields left blank until validated with the first partner.

**Speaker script — 50 seconds**

“Our first commercial motion is a focused six-to-ten-week design partnership. We choose one document workflow, connect the issuer, recipient, and an AI upload point, then measure whether DocShield creates useful control without creating unacceptable friction. The scorecard is concrete: protection time, successful verification, the percentage of targeted upload paths that honor policy, human review of alerts, and the number of exchanges with complete lifecycle evidence. The next twelve-month milestone is two or three design partners and one excellent enforcement integration—not a sprawling feature matrix.”

**Fill in before presenting**

Add the real number of interviews, pilots, LOIs, and any measured workflow times. If none exist, say “design-partner recruitment” rather than “pipeline.”

---

## Slide 10 — Monetize the trust layer, keep verification friction low

**On slide**

Enterprise platform + usage

- Base annual contract
- Protected-document / issuance volume
- API and SDK usage
- Monitoring and audit add-on

**Footer:** Verification should be inexpensive enough to become habitual.

**Visual direction**

A simple expansion path from design-partner platform to API ecosystem. Do not show fabricated dollar amounts.

**Speaker script — 45 seconds**

“The business model starts with an enterprise annual contract for policy management, key operations, integrations, retention, and support. Usage can scale with protected-document volume, issuance, and API calls, while advanced telemetry and audit become an add-on. We do not want pure per-seat pricing: value crosses issuers, recipients, and automated systems. And we do not want to tax verification so heavily that recipients skip it. The commercial model should reward network use while keeping trust checks ubiquitous.”

**Fill in before presenting**

Replace this hypothesis with tested pricing and an expected annual contract range after customer discovery.

---

## Slide 11 — The moat is the network around the passport

**On slide**

Protocol adoption → issuer trust → integrations → behavior baselines → compliance evidence

**Supporting line:** Open the passport enough to spread it; monetize the enterprise operating layer.

**Visual direction**

A flywheel with five stages. This is the one diagram worth using because it makes the defensibility thesis easier to grasp.

**Speaker script — 55 seconds**

“The cryptography is necessary, but it is not the moat. Defensibility comes from adoption of a trusted policy schema across AI gateways and document systems; a verified issuer and key network; deep workflow integrations; privacy-safe behavioral baselines; and the compliance evidence required to operate this infrastructure. We believe the passport should become interoperable—potentially through C2PA-compatible assertions or a published specification—while the commercial moat sits in trust operations, integrations, policy management, monitoring, and enterprise workflow. Openness can increase distribution rather than weaken the business.”

---

## Slide 12 — Make every document verifiable before AI can act on it

**On slide**

**Now:** working end-to-end prototype  
**Next:** 2–3 design partners + one enforcement integration  
**Raise:** [amount] to fund [runway] months  
**Use:** production trust architecture, integrations, pilots, and compliance readiness

**Visual direction**

Return to the single traveling document from slide 1, now arriving with identity, policy, and proof intact.

**Speaker script — 55 seconds**

“DocShield begins with a simple belief: when a sensitive document crosses a boundary, its identity and rules should not disappear. We have built the end-to-end prototype. The next proof is a real enterprise issuing a protected document, a separate organization’s AI gateway honoring its signed policy, and both sides producing trustworthy evidence of what happened. We are raising [amount] to fund [runway] months of production architecture, one excellent enforcement integration, two or three design partnerships, and the security work required to earn enterprise trust. We are building the trust layer that lets documents stay verifiable before AI can act on them.”

**Close**

“We’d welcome your questions.”

---

# Q&A appendix

## A1 — Why can’t Microsoft, Adobe, or Dropbox build this?

“They can build parts of it, and several are important ecosystem partners. Their strongest controls are usually tied to a tenant, channel, viewer, or format. DocShield is designed around cross-company verification and vendor-neutral AI policy. Our strategy is to integrate with incumbents, align with open provenance standards, and own the trust operations and policy network spanning those systems.”

## A2 — Isn’t this just DRM or watermarking?

“No. DRM tries to prevent actions through a controlled viewer; visible watermarking deters or attributes leaks. DocShield provides a tamper-evident identity, signed policy, lifecycle history, and verification decision. Secure links add controls and telemetry, but we do not claim an offline file is uncopyable or universally trackable.”

## A3 — Does the AI policy enforce itself?

“No. It is a signed declaration consumed by a compatible enforcement point. That is why the beachhead includes an AI gateway, secure browser, endpoint, or application integration. DocShield supplies the trusted decision input; the enforcement point applies it.”

## A4 — Do you see the customer’s content?

“The current prototype stores encrypted document blobs server-side to support downloads, so we do not present it as content-blind today. The production architecture is designed to move raw-content processing and embedding into a customer-hosted gateway, leaving DocShield with hashes, signatures, keys, policy, and permitted telemetry.”

## A5 — What happens if someone strips the passport?

“The verifier reports that the expected passport is missing or metadata was stripped. No embedded credential can survive every screenshot, print-scan, conversion, or reconstruction. The product creates verifiable evidence and, in the controlled-link mode, stronger operational controls. We avoid claiming impossibility.”

## A6 — Why use anomaly detection per document?

“The document is the protected asset, so its access pattern is a useful initial baseline. The prototype combines statistical deviation with a small autoencoder and returns explanation codes. It is an early prioritization signal, not proof of malicious behavior. Pilot data will determine whether per-document, cohort, tenant, or hybrid models provide the best alert quality.”

## A7 — What must be productionized?

“Enterprise identity and tenant authorization, customer-controlled signing keys, customer-hosted content processing, KMS-backed secret management and rotation, PostgreSQL migrations, asynchronous risk scoring, rate limits, observability, retention controls, and external security validation. Those items are the heart of the fundraise plan, not details we are hiding.”

## A8 — What is the first irreversible advantage?

“A real cross-company workflow in which the issuer’s signed policy is honored by the recipient’s AI gateway. That proves the network behavior, creates integration leverage, and begins the trust graph around issuers, policies, and verification.”

---

# Presenter preparation checklist

Before this goes in front of investors, replace every bracketed field and add:

1. Founder names, roles, and the one sentence of founder-market fit that is most difficult to copy.
2. Customer discovery count and two anonymized quotes or repeated pain patterns.
3. Any design-partner, pilot, or LOI evidence.
4. The raise amount, runway, hiring plan, and 18-month milestones.
5. Tested pricing or a clearly labeled pricing experiment.
6. One concise live demo path with a recorded fallback.
7. A product screenshot showing real functionality without fake traction totals.

# Source and claim notes

- Product architecture, limits, verification layers, anomaly features, and production gaps: `docs/technical.md`.
- Positioning, ICP, competitive map, business-model hypotheses, pilot design, moat, and 12-month priorities: `docs/company.md`.
- Visual atmosphere and event framing: `agents/assets/njx/njx_slideshow.pdf`.
- Real-user, customer-fit, innovation, execution, and pitch emphasis: `agents/assets/njx/cipher-city-mission-briefings.pdf`.
- Repository counts: 23 route decorators across backend API files; 26 named backend test functions and 18 frontend test cases. Counts are static code inspection, not runtime verification.

