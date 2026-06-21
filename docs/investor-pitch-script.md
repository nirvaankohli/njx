# DocShield investor pitch script

**Version:** Full investor narrative, June 2026
**Format:** 17 slides, approximately 12–14 minutes, followed by Q&A
**Audience:** pre-seed and seed investors in cybersecurity, AI infrastructure, enterprise software, and compliance
**Core thesis:** Documents need a portable, verifiable identity and AI-use policy when they move beyond the system that created them.

## The story in one paragraph

AI adoption has moved faster than enterprise policy. Employees upload documents into tools the issuer does not control, often through personal accounts, while traditional DLP, data rooms, signatures, and DRM each protect only part of the journey. DocShield gives every enterprise file a signed, machine-readable passport that answers who issued it, whether it changed, what AI and sharing policy applies, and what happened during controlled distribution. The initial wedge is high-value documents crossing company boundaries into AI-enabled workflows. The long-term opportunity is a vendor-neutral trust and verification network connecting document systems, enterprises, and AI enforcement points.

## Delivery principles

- Speak in plain language before explaining cryptography.
- Use one strong number per slide; do not recite a wall of statistics.
- Never call the passport an “unremovable watermark.”
- Never claim a policy tag blocks arbitrary AI applications by itself.
- Never call the current prototype content-blind or production-ready.
- Treat Microsoft, Adobe, DLP vendors, and AI gateways as competitors, complements, and channels depending on the workflow.
- End each slide by creating the question answered by the next slide.

---

## Slide 1 — The file crossed the boundary. Its rules did not.

**Time:** 30 seconds

### On slide

**DocShield**
The trust layer for documents entering AI workflows

### Visual direction

Use a minimal dark canvas inspired by the NJX launch deck: black, deep electric blue, white type, and a restrained glow. Show one document moving from one organization to another with a visible policy ribbon remaining attached. Use the existing DocShield mark and wordmark—not NJX event logos.

### Speaker script

“Every enterprise protects sensitive information while it remains inside a managed system. But business requires documents to move: a security report goes to a customer, a contract goes to outside counsel, and a diligence file goes to an investor. Today, the moment that file crosses a company or application boundary, the sender’s identity, policy, and history usually stop traveling with it. DocShield makes those signals portable and verifiable—especially before an AI system can act on the document.”

### Transition

“And that boundary problem is becoming urgent because AI adoption has already outrun enterprise control.”

---

## Slide 2 — More than one in five AI-uploaded files contained sensitive content

**Time:** 45 seconds

### On slide

**22%**
of files uploaded to GenAI tools contained sensitive content

Small source line: Harmonic Security analysis of 20,000 files and 1 million prompts, Q2 2025

### Visual direction

Make “22%” the dominant visual. Behind it, show a faint stream of PDFs and DOCX files entering an AI interface. Do not use a pie chart unless the deck designer can make it exceptionally simple.

### Speaker script

“The risk is measurable. Harmonic Security analyzed 20,000 file uploads and one million prompts across more than 300 AI-enabled applications. Nearly 22 percent of the uploaded files contained sensitive content. Those files were also responsible for most of the observed customer-profile, employee-PII, and stored-card exposure events. This is not a hypothetical survey response. It is what employees are already moving into AI tools.”

### Source

[Harmonic Security, GenAI Data Exposure, Q2 2025](https://www.harmonic.security/resources/genai-data-exposure-report-fa6wt)

### Transition

“The volume is growing because employees are not waiting for official enterprise AI programs.”

---

## Slide 3 — AI adoption moved faster than governance

**Time:** 55 seconds

### On slide

**75%** of knowledge workers use AI at work
**78%** of AI users bring their own tools
**15% → 45%** shadow-AI usage in one year

### Visual direction

Use a simple rising line or three progressively larger figures. Keep the dominant message “governance is behind adoption.”

### Speaker script

“Microsoft and LinkedIn found that 75 percent of knowledge workers were already using AI at work, and 78 percent of those AI users brought their own tools. Verizon’s latest breach research says employee use of unapproved AI tools tripled in a year, from 15 to 45 percent. Netskope separately observed that 72 percent of enterprise GenAI use ran through personal accounts. AI is already inside the workflow. Enterprise policy did not travel at the same speed.”

### Sources

- [Microsoft and LinkedIn 2024 Work Trend Index](https://www.microsoft.com/en-us/worklab/work-trend-index/ai-at-work-is-here-now-comes-the-hard-part)
- [Verizon 2026 DBIR announcement](https://www.verizon.com/about/news/breach-industry-wide-dbir-finds)
- [Netskope Cloud and Threat Report: Generative AI 2025](https://www.netskope.com/resources/cloud-and-threat-reports/cloud-and-threat-report-generative-ai-2025)

### Transition

“Existing security controls are not useless. They are simply attached to containers and channels rather than to the traveling asset.”

---

## Slide 4 — Managed systems protect containers, not traveling assets

**Time:** 55 seconds

### On slide

Inside the tenant:

- identity
- labels
- policy
- logs

Outside the tenant:

**an attachment**

Footer: 48% of breaches in Verizon’s 2026 DBIR involved a third party.

### Visual direction

Show a file leaving a structured, labeled environment and arriving on the other side without context. The file itself should be the center of attention.

### Speaker script

“DLP, document management, and virtual data rooms work best while the file stays inside the system enforcing the rule. But the highest-value files must cross boundaries. The recipient may not know whether the issuer is authentic, whether a version changed, or whether an AI restriction still applies. Email attachments lose revocation and access visibility. Ordinary metadata can be modified or stripped. Meanwhile, Verizon reports that 48 percent of analyzed breaches now involve a third party. The enterprise perimeter has become a trust boundary, and documents cross it every day.”

### Source

[Verizon 2026 DBIR announcement](https://www.verizon.com/about/news/breach-industry-wide-dbir-finds)

### Transition

“So we started with the four questions every sensitive file should be able to answer for itself.”

---

## Slide 5 — Four questions every sensitive file should answer

**Time:** 45 seconds

### On slide

1. **Who issued it?**
2. **Has it changed?**
3. **What is allowed?**
4. **What happened when it was shared?**

### Visual direction

Place one document in the center with four spacious callouts. This is the simplest expression of the product and should be visually memorable.

### Speaker script

“DocShield turns document trust into four deterministic questions. Who issued this file? Has it changed? What usage policy applies—including whether external AI is allowed? And, when it was distributed through a controlled channel, what happened after it was shared? Those answers are cryptographically bound to the exact file and can be read by a person, an enterprise application, or an AI gateway.”

### Transition

“We answer those questions through two modes because portable evidence and operational control are different promises.”

---

## Slide 6 — Portable evidence. Controlled visibility.

**Time:** 65 seconds

### On slide

**Portable passport**
Issuer · integrity · AI policy · lifecycle

**Secure link**
Access controls · revocation · telemetry · anomaly alerts

Footer: Evidence travels. Control applies while the channel is controlled.

### Visual direction

Use a clean two-path composition. One path ends in a downloadable PDF or DOCX with a passport. The other ends in a secure browser flow with telemetry.

### Speaker script

“The first mode is a portable protected file. DocShield fingerprints the exact document, signs a canonical manifest with the issuer’s identity, chains lifecycle events, and embeds an encrypted passport. A compatible verifier can determine whether the file is valid, tampered with, revoked, unknown, or missing its passport, and can evaluate the signed policy for the requested operation.

“The second mode is a secure link. It adds expiry, password or organization restrictions, revocation, access telemetry, and per-document anomaly scoring. The portable file provides evidence. The controlled link provides stronger operational visibility. We are precise about this distinction: DocShield is tamper-evident, not magically uncopyable, and secure-link telemetry does not follow every offline copy.”

### Transition

“The sharpest initial use case is where a document owner’s policy must become a recipient’s AI decision.”

---

## Slide 7 — The wedge: verify policy before AI can act

**Time:** 70 seconds, including demo setup

### On slide

1. Supplier issues a report with `NO_EXTERNAL_AI`
2. Recipient gateway verifies the passport
3. Upload is blocked or routed to an approved model
4. Both organizations retain evidence

### Visual direction

Use a four-step horizontal flow with the AI gateway visibly positioned before the model. The gateway should be the enforcement point; DocShield supplies the trusted decision.

### Speaker script

“Imagine a supplier sends a security assessment to an enterprise customer. The supplier signs a `NO_EXTERNAL_AI` policy into the document passport. When an employee attempts to upload that file to an AI tool, the recipient’s gateway asks DocShield four things: Is this the registered document? Is the issuer signature valid? Has the file or history changed? Is this operation allowed? The gateway can block the upload or route it to an approved private model. Both sides retain a verifiable issuance and decision record.

“The policy does not enforce itself. The gateway, browser, endpoint, or application enforces it. DocShield provides the trusted, asset-specific decision input.”

### Demo sequence

1. Register and protect a PDF.
2. Show the signed policy and issuer.
3. Download and verify the protected file as valid.
4. Evaluate `external_ai_upload` and show the denied result.
5. Modify or strip the passport and show the changed verification state.
6. Open the secure-link analytics and show a suspicious event.

Target demo time: 60–90 seconds. If the meeting is short, show steps 2–4 only.

### Transition

“Under the hood, this is not a label database. It is a layered verification system.”

---

## Slide 8 — Eight layers of verification, one clear answer

**Time:** 55 seconds

### On slide

Registry → manifest → issuer key → history chain → source fingerprint → key status → revocation → policy

Outputs: valid · tampered · revoked · passport missing · unknown · invalid signature

### Visual direction

Use one restrained verification pipeline. Do not expose implementation code. Keep detailed cryptography in speaker notes or an appendix.

### Speaker script

“Verification is layered. DocShield resolves the registry record, compares the signed manifest, verifies the issuer’s Ed25519 signature, validates every hash-linked lifecycle event, compares the source SHA-256 fingerprint, checks key and document revocation, and evaluates the requested policy operation. The embedded passport is authenticated with AES-256-GCM. The result is not a vague risk score. It is an explicit trust state a recipient or gateway can act on.”

### Technical credibility line

“The current prototype implements this flow across registration, sharing, verification, telemetry, and audit export through 23 backend routes.”

### Transition

“That architecture matters most in workflows where the document is valuable, the boundary is unavoidable, and the recipient is likely to use AI.”

---

## Slide 9 — Start with high-value documents that must leave the company

**Time:** 55 seconds

### On slide

**Beachhead workflows**

- Vendor security and audit reports
- Legal diligence and privileged work product
- Regulated partner documents

**Buyer:** CISO, data protection, risk, legal
**Users:** issuer, recipient, auditor, AI platform team

### Visual direction

Show three recognizable high-value documents. Avoid a broad industry-logo collage.

### Speaker script

“Our best initial customer is a mid-market or enterprise organization exchanging high-value documents with outside parties and already worried about generative-AI leakage. Vendor security reports, legal diligence files, and regulated partner documents are strong beachheads because the file must leave the sender’s environment, the contents matter, and AI use is plausible.

“The economic buyer is security, data protection, risk, or legal. The document owner initiates the workflow. The recipient and AI platform team complete the verification loop. That gives us a budget owner, a reachable user, and a cross-company network effect.”

### Expansion verticals

Financial services, insurance, healthcare and life sciences, defense and manufacturing, enterprise procurement, and research publishing.

### Transition

“The market is not ‘every PDF.’ We size it from the protected workflows and verification volume customers will pay to govern.”

---

## Slide 10 — A focused wedge into a larger trust infrastructure market

**Time:** 55 seconds

### On slide

**Beachhead market**
[number of target organizations] × [initial ACV] = [serviceable market]

**Expansion**
Protected documents + verification API + secure-share monitoring

**Long term**
Cross-company document trust network

### Visual direction

Use a three-ring expansion visual only if it remains simple. Prefer a bottom-up equation over an inflated top-down TAM circle.

### Speaker script

“We will not claim a giant market by adding every adjacent security category. Our initial market is bottom-up: the number of organizations in the first two or three regulated workflows multiplied by a validated annual contract value. From there, usage expands through document issuance, verification calls, and controlled-share monitoring. The long-term market is the trust infrastructure connecting document systems, enterprises, and AI enforcement points.”

### Fill in before presenting

- Target organizations in the chosen beachhead: **[count]**
- Validated or tested starting ACV: **[$ amount]**
- Initial serviceable market: **[$ count × ACV]**
- Expected documents or verification calls per customer: **[volume]**

Do not put a TAM number on this slide until its assumptions can survive investor questioning.

### Transition

“The business model follows the way trust is consumed: by organizations, documents, integrations, and verification volume—not only seats.”

---

## Slide 11 — Enterprise platform plus usage

**Time:** 45 seconds

### On slide

- Annual platform contract
- Protected-document or issuance volume
- Verification API and SDK usage
- Monitoring and audit add-on
- Enterprise features: SSO, KMS/HSM, retention, regional hosting, support

Footer: Keep verification inexpensive enough to become habitual.

### Visual direction

Show a simple land-and-expand line: pilot → platform → integrations → network usage.

### Speaker script

“The commercial model begins with an enterprise annual contract for policy management, key operations, integrations, retention, and support. Usage can scale with protected-document volume, issuance, and API calls. Advanced telemetry, anomaly detection, and audit retention become an add-on. We do not want pure per-seat pricing because value crosses issuers, recipients, services, and automated verification. And we do not want to tax verification so heavily that recipients avoid it.”

### Fill in before presenting

“Our current pricing hypothesis is **[$ pilot]** for a design partnership and **[$ ACV range]** for the initial annual contract.”

Only say this after customer discovery supports it.

### Transition

“This market already has strong companies. The opportunity exists because their guarantees stop at different boundaries.”

---

## Slide 12 — The missing layer between sharing, DLP, and provenance

**Time:** 65 seconds

### On slide

| Category | Strong at | Gap DocShield targets |
|---|---|---|
| Sharing / VDR | controlled delivery | portable signed AI policy |
| DRM | persistent viewer controls | open, cross-system verification |
| AI DLP | content inspection and enforcement | issuer-bound asset identity |
| Signatures / C2PA | authenticity and provenance | enterprise policy, telemetry, workflow |

### Visual direction

Use a clean four-row comparison. Avoid feature-checkmark overload.

### Speaker script

“DocSend and Digify provide mature link sharing, engagement analytics, and data rooms. Vitrium and Locklizard provide stronger DRM controls. Microsoft Purview and Nightfall classify content and enforce policy inside managed channels. Adobe signatures establish document authenticity, while C2PA is building an open provenance ecosystem.

“DocShield does not try to out-DRM a DRM company or out-DLP Microsoft. We provide the layer those categories do not cleanly share: an issuer-signed, machine-readable document identity and AI-use policy that can cross organizations, feed an enforcement point, and retain lifecycle evidence. C2PA is more likely to become an interoperability foundation than an enemy.”

### Transition

“That positioning also determines our go-to-market: one controlled workflow, three participating parties, and measurable proof.”

---

## Slide 13 — Land with a measurable 6–10 week pilot

**Time:** 55 seconds

### On slide

**One issuer + one recipient + one AI enforcement point**

Pilot scorecard:

- Time to protect and send
- Recipient verification rate
- AI-policy enforcement coverage
- Alert usefulness
- Workflow friction
- Complete lifecycle evidence

### Visual direction

Use a restrained scorecard with target fields. Do not fabricate green results.

### Speaker script

“The first commercial motion is a six-to-ten-week design partnership around one document workflow. We connect an issuer, an external recipient, and one AI enforcement point. Then we measure whether DocShield creates useful control without unacceptable friction: protection time, recipient verification, the percentage of targeted upload paths honoring policy, human review of alerts, and exchanges with complete lifecycle evidence.

“The first twelve-month commercial objective is two or three design partners and one excellent gateway, browser, or DLP integration. The goal is proof of network behavior—not a sprawling feature matrix.”

### Distribution path

1. Direct enterprise design partnerships.
2. AI gateway, secure browser, and DLP integrations.
3. Plugins for Microsoft 365, Google Workspace, email, and document-authoring tools.
4. Free verification to reduce recipient friction.
5. Published or standards-compatible passport semantics.

### Transition

“We have enough product to run that pilot. The remaining work is turning a hackathon-born prototype into trusted enterprise infrastructure.”

---

## Slide 14 — Working end to end; clear about what comes next

**Time:** 60 seconds

### On slide

**Built**

- 23 backend routes
- 44 named backend and frontend tests by static count
- Registration, signing, secure links, verification, telemetry, audit export
- Eight-layer verification and eight-signal risk engine

**Next**

- Enterprise identity and tenant authorization
- Customer-hosted content processing
- Managed signing keys and KMS-backed secrets
- Production database, migrations, observability, rate limits
- Asynchronous and calibrated risk scoring
- Standards-compatible embedding and verification

### Visual direction

Use one authentic product screenshot plus a short “built / next” contrast. Do not use seeded demo totals as traction.

### Speaker script

“DocShield began at the NJX cybersecurity innovation hackathon, where the challenge emphasized real value, customer fit, innovation, execution, and a story that survives past the weekend. We built the complete prototype loop: registration, signing, protected delivery, verification, secure sharing, access telemetry, anomaly scoring, and audit export.

“We are equally clear about the production gap. The demo stores encrypted file blobs server-side, uses demo-oriented authentication and browser-stored development keys, and runs risk scoring synchronously. The production system must move content handling into a customer-hosted gateway, enforce tenant isolation, use managed signing keys, add KMS-backed rotation, migrations, observability, and calibrated asynchronous detection. That is the work required to earn enterprise trust.”

### Accuracy note

The 44 test figure is a static repository count, not a claim that every test currently passes in every environment.

### Transition

“If we execute that roadmap, the moat is not the encryption primitive. It is the network and operating layer around the passport.”

---

## Slide 15 — The moat is the network around the passport

**Time:** 55 seconds

### On slide

Policy-schema adoption
→ trusted issuers and keys
→ deep workflow integrations
→ privacy-safe behavior baselines
→ compliance and operational trust

Footer: Open the credential enough to spread it; monetize the enterprise operating layer.

### Visual direction

Use one simple flywheel. This is the only complex diagram the main deck needs.

### Speaker script

“SHA-256, Ed25519, and AES-GCM are necessary, but they are not a moat. Defensibility comes from adoption of a trusted policy schema across AI gateways and document systems; a verified issuer and key network; deep integrations; privacy-safe behavior baselines; and the compliance evidence required to operate this infrastructure.

“We believe the passport should become interoperable—potentially through C2PA-compatible assertions or a published specification—while the commercial moat sits in trust operations, policy management, integrations, monitoring, and enterprise workflow. Openness can increase distribution instead of weakening the business.”

### Transition

“The people building this must combine security credibility, enterprise workflow empathy, and the ability to create a standard others will adopt.”

---

## Slide 16 — The team

**Time:** 45 seconds

### On slide

**[Founder name] — [role]**
[One-line founder-market fit]

**[Founder name] — [role]**
[One-line founder-market fit]

**Why us:** [security] + [enterprise distribution] + [product execution]

### Visual direction

Use professional founder photographs and one proof point per person. Avoid biographies.

### Speaker script template

“We are **[names]**. I bring **[specific credential, insight, or network relevant to the problem]**. **[Co-founder]** brings **[complementary technical, security, product, or distribution strength]**. We built the end-to-end prototype because **[personal observation or customer experience that made the problem unavoidable]**. Our unfair advantage is **[credible access to initial customers, unique expertise, or demonstrated speed]**.”

### Required preparation

Do not present this deck without replacing every placeholder. Investors back the team as much as the idea.

### Transition

“We have built the first version. This round is about proving the cross-company enforcement loop and productionizing the trust architecture.”

---

## Slide 17 — Make every document verifiable before AI can act on it

**Time:** 60 seconds

### On slide

**Now:** working end-to-end prototype
**Next:** 2–3 design partners + one enforcement integration
**Raise:** [$ amount] for [months] of runway

Use of funds:

- production trust architecture
- integrations and pilots
- security and compliance readiness
- [key hires]

### Visual direction

Return to the traveling document from slide 1. This time it reaches the recipient with issuer identity, policy, and proof intact.

### Speaker script

“DocShield begins with a simple belief: when a sensitive document crosses a boundary, its identity and rules should not disappear. We have built the complete prototype. The next proof is a real enterprise issuing a protected document, a separate organization’s AI gateway honoring its signed policy, and both sides producing trustworthy evidence of what happened.

“We are raising **[$ amount]** to fund **[months]** of runway. That capital will productionize the trust architecture, deliver one excellent enforcement integration, run two or three design partnerships, and complete the security work required to earn enterprise trust.

“AI can move faster than policy. DocShield makes sure the document’s rules arrive first.”

### Final line

“We’d welcome your questions.”

---

# Six-minute condensed version

If the room gives you only six minutes, present slides 1, 2, 3, 5, 6, 7, 9, 13, 14, and 17.

Target timing:

1. Opening and problem: 60 seconds.
2. Why now: 40 seconds.
3. Four questions and two modes: 75 seconds.
4. AI gateway wedge and demo: 90 seconds.
5. Customer and pilot: 60 seconds.
6. Execution and roadmap: 45 seconds.
7. Team and ask: 50 seconds.

Condensed closing:

> “More than one in five files uploaded to GenAI tools in Harmonic’s observed enterprise traffic contained sensitive content. Yet the issuer’s identity and AI policy usually disappear when the file crosses a company boundary. DocShield gives every file a signed passport that proves who issued it, whether it changed, what is allowed, and what happened when it was shared. We have built the end-to-end prototype. We are now raising **[$ amount]** to productionize the trust architecture, integrate with one enforcement point, and prove the network with two or three design partners.”

---

# Three-minute NJX-style version

This version follows the NJX mission brief’s demand for a real customer, clear adoption reason, working demo, and believable future.

> “Sensitive documents are entering AI tools without the rules that governed them. Harmonic Security analyzed 20,000 file uploads and found that nearly 22 percent contained sensitive content. Microsoft found that 75 percent of knowledge workers already use AI, and most bring their own tools.
>
> “The problem is simple: enterprise controls protect the system, but the document has to leave. Once it crosses into email, a partner organization, or an AI application, the recipient may not know who issued it, whether it changed, or whether external AI is allowed.
>
> “DocShield gives the document a signed passport. It answers four questions: who issued it, has it changed, what is allowed, and what happened when it was shared. A portable file carries verifiable evidence. A secure link adds expiry, revocation, telemetry, and anomaly alerts.
>
> “Our first customer is a security, risk, or legal team exchanging high-value reports with outside organizations. The key workflow is an AI upload. A supplier signs `NO_EXTERNAL_AI`; the recipient’s gateway verifies the exact file and blocks it or routes it to an approved model. The policy does not enforce itself—DocShield provides the trusted decision and the gateway enforces it.
>
> “We built the full prototype: signing, protected downloads, secure links, verification, telemetry, and audit export. Next, we will productionize customer-hosted content processing and managed keys, integrate one AI enforcement point, and run two or three design partnerships.
>
> “AI moves faster than policy. DocShield makes sure the document’s rules arrive first.”

---

# Investor Q&A

## Q1 — Why is this a company rather than a feature?

“A passport alone could be a feature. The company is the cross-company trust network and operating layer around it: issuer identity, keys, revocation, policy semantics, verification APIs, integrations, monitoring, audit evidence, and compliance operations. The network becomes more useful as more document systems and enforcement points understand the credential.”

## Q2 — Why can’t Microsoft, Adobe, or Dropbox build this?

“They can build parts of it, and several are likely partners. Their strongest controls are generally tied to a tenant, viewer, channel, or format. DocShield is designed around vendor-neutral, cross-company verification and AI-policy semantics. Our strategy is interoperability, distribution through integrations, and ownership of the trust operations spanning those systems.”

## Q3 — Isn’t this just DRM or watermarking?

“No. DRM attempts to prevent actions through a controlled viewer. Visible watermarking deters or attributes leaks. DocShield provides a tamper-evident identity, signed usage policy, lifecycle history, and verification decision. Secure links add operational controls, but we do not claim an offline file is uncopyable or universally trackable.”

## Q4 — Why not just use a normal digital signature?

“Certificate signatures are useful for authenticity and integrity. DocShield adds organization-level AI and sharing policy, cross-company lifecycle events, revocation and key operations, verification APIs for machine decisions, controlled-share telemetry, and audit workflow. ‘We sign PDFs’ is not the differentiated proposition.”

## Q5 — Why not just use C2PA?

“C2PA is an important open provenance standard and may become part of the implementation. DocShield’s commercial value is the enterprise policy schema, issuer operations, AI decisioning, integrations, telemetry, and audit workflow around provenance. Alignment with C2PA could accelerate interoperability.”

## Q6 — Does the AI policy enforce itself?

“No. It is a signed declaration consumed by a compatible gateway, browser, endpoint, or application. DocShield supplies a deterministic, issuer-bound decision input. The enforcement point applies the rule.”

## Q7 — Do you read or store customer content?

“The current prototype stores encrypted document blobs server-side to power secure downloads, so we do not market it as content-blind today. The production architecture moves raw-content processing and passport embedding into a customer-hosted gateway. DocShield then operates on hashes, signatures, keys, policy, and permitted telemetry.”

## Q8 — What if someone strips the passport?

“The verifier reports that the expected credential is missing. No embedded passport can survive every screenshot, print-scan, conversion, flattening, or reconstruction. The product creates tamper evidence and, when the sender controls the link, stronger distribution controls and telemetry. We do not make impossible persistence claims.”

## Q9 — What stops someone from forging an issuer?

“The manifest is signed with an Ed25519 private key associated with a registered organization. Production trust depends on enterprise identity proofing, managed private-key custody, rotation, revocation, and auditability. Those operations—not the signature algorithm alone—are central to the product.”

## Q10 — How accurate is the anomaly detection?

“The prototype uses eight behavior features and combines online statistical deviation with a small per-document autoencoder. It returns a review score and explanation codes, not a verdict of theft. We do not yet have a labeled evaluation set or calibrated precision and recall. Pilot data will determine the right model and thresholds.”

## Q11 — What is the buyer’s ROI?

“The pilot measures it directly: fewer ambiguous AI decisions, more complete lifecycle evidence, lower investigation effort, and reduced workflow friction compared with manual review or blanket blocking. The FBI recorded $2.77 billion in reported BEC losses in 2024, but we do not claim DocShield prevents that entire category. We use the number to show that trust failures in business communications are economically material.”

## Q12 — What is the sales motion?

“Founder-led design partnerships with security, risk, or legal teams around one external document workflow. The pilot includes the issuer, recipient, and AI enforcement point. A successful pilot converts to an annual platform contract and expands through document volume, API usage, monitoring, and additional workflows.”

## Q13 — What is the first irreversible advantage?

“A real cross-company workflow where the issuer’s signed policy is honored by the recipient’s AI gateway. That proves network behavior, creates integration leverage, and begins the trust graph around issuers, policies, and verification.”

## Q14 — What are the greatest risks?

“The largest risks are recipient friction, proprietary-format dead ends, weak enterprise key operations, inconsistent enforcement integrations, and overclaiming the guarantees. Our roadmap addresses them through a free verifier, standards alignment, managed keys, one excellent enforcement integration, and precise product language.”

## Q15 — What milestones does this round achieve?

“By the end of the runway: **[number]** design partners, **[number]** converted annual contracts, one production enforcement integration, customer-hosted content processing, managed enterprise signing, standards interoperability decision, calibrated alert results, and **[$ ARR or usage milestone]**.”

---

# Presenter preparation checklist

## Facts that must be filled in

1. Founder names, roles, and founder-market fit.
2. Number and type of customer interviews.
3. Design-partner, pilot, or LOI evidence.
4. Bottom-up beachhead organization count.
5. Tested pilot price and expected ACV.
6. Raise amount, runway, hiring plan, and milestones.
7. Any measured protection, verification, or user-friction results.

## Demo readiness

1. Seed or create a clean tenant and document before the meeting.
2. Use one document with a short, legible title.
3. Pre-open the registration, verifier, and dashboard views.
4. Keep a known-good protected file and one modified file ready.
5. Record a 60-second fallback video.
6. Never let seeded dashboard totals be mistaken for customer traction.

## Delivery

1. Memorize slides 1, 2, 5, 7, and 17; these carry the story.
2. Do not explain AES-GCM before the audience understands the boundary problem.
3. Pause after the 22% statistic.
4. State the policy-enforcement limitation before an investor asks.
5. Make the team slide personal and specific.
6. End on the vision and raise—not on technical debt.

---

# Claim and source ledger

## External evidence

- Sensitive content in GenAI file uploads and concentration of file-based exposure: [Harmonic Security, Q2 2025](https://www.harmonic.security/resources/genai-data-exposure-report-fa6wt).
- Workplace AI adoption and BYOAI: [Microsoft and LinkedIn 2024 Work Trend Index](https://www.microsoft.com/en-us/worklab/work-trend-index/ai-at-work-is-here-now-comes-the-hard-part).
- Shadow AI and third-party breach involvement: [Verizon 2026 DBIR announcement](https://www.verizon.com/about/news/breach-industry-wide-dbir-finds).
- Personal-account usage and GenAI data-volume growth: [Netskope Cloud and Threat Report: Generative AI 2025](https://www.netskope.com/resources/cloud-and-threat-reports/cloud-and-threat-report-generative-ai-2025).
- Business Email Compromise complaints and reported losses: [FBI IC3 2024 Annual Report](https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf).
- Digital identity-document forgery: [Entrust Identity Fraud Report 2025](https://www.entrust.com/sites/default/files/documentation/reports/2025-identity-fraud-report.pdf).

## Repository evidence

- Product architecture, verification flow, risk model, secure sharing, limitations, and production roadmap: `docs/technical.md`.
- Positioning, ICP, competitive landscape, business-model hypotheses, GTM, moat, and company risks: `docs/company.md`.
- Real-world statistics and methodological caveats: `docs/project-stats.md`.
- NJX visual atmosphere, AI-defense framing, and judging criteria: `agents/assets/njx/njx_slideshow.pdf`.
- NJX emphasis on real customers, customer fit, innovation, execution, and a believable pitch: `agents/assets/njx/cipher-city-mission-briefings.pdf`.
- Repository proof points: 23 backend route decorators, 26 named backend test functions, and 18 named frontend test cases by static inspection.

## Language guardrails

- Say **“tamper-evident encrypted document passport,”** not “unremovable watermark.”
- Say **“policy declaration for compatible enforcement points,”** not “blocks every AI upload.”
- Say **“secure-link telemetry,”** not “tracks every copy.”
- Say **“online anomaly score,”** not “AI proves malicious behavior.”
- Say **“production architecture targets customer-hosted content processing,”** not “DocShield never receives content” while the prototype stores encrypted blobs.

