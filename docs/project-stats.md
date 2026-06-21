# DocShield: real-world market statistics

Prepared June 21, 2026. These are external statistics that support the problem DocShield addresses: sensitive documents entering AI tools, document forgery, impersonation, cross-company risk, and the need for verifiable document identity and policy.

## Best statistics for the investor pitch

| Statistic | Why it matters to DocShield | Investor-safe wording | Source and scope |
|---|---|---|---|
| **Nearly 22% of files uploaded to GenAI tools contained sensitive content.** | This is the cleanest evidence that uploaded files—not only typed prompts—create a material AI data-exposure problem. | “In an analysis of real enterprise AI activity, more than one in five uploaded files contained sensitive content.” | [Harmonic Security, Q2 2025](https://www.harmonic.security/resources/genai-data-exposure-report-fa6wt). Vendor telemetry covering 20,000 files and 1 million prompts across 300+ GenAI and AI-enabled SaaS applications. |
| **Files produced 79.7% of stored-credit-card exposures, 75.3% of customer-profile leaks, and 68.8% of employee-PII incidents in Harmonic’s observed AI traffic.** | It shows that file uploads are disproportionately concentrated with strategic or regulated data. | “Uploaded files were responsible for most observed customer-profile, employee-PII, and stored-card exposure events.” | [Harmonic Security, Q2 2025](https://www.harmonic.security/resources/genai-data-exposure-report-fa6wt). Vendor-observed customer traffic; not a universal enterprise rate. |
| **Employee use of unapproved AI tools rose from 15% to 45% in one year.** | AI adoption is outrunning centralized governance, creating the enforcement gap DocShield targets. | “Verizon reports that employee shadow-AI usage tripled in one year, reaching 45%.” | [Verizon 2026 DBIR announcement](https://www.verizon.com/about/news/breach-industry-wide-dbir-finds), based on incidents and activity observed during the report period. |
| **75% of knowledge workers used AI at work; 78% of those AI users brought their own AI tools.** | Employees are already moving work into AI systems outside formal enterprise rollout. | “Three quarters of knowledge workers already use AI at work, and nearly four in five AI users bring their own tools.” | [Microsoft and LinkedIn 2024 Work Trend Index](https://www.microsoft.com/en-us/worklab/work-trend-index/ai-at-work-is-here-now-comes-the-hard-part), a survey of 31,000 people in 31 countries plus Microsoft 365 and LinkedIn signals. |
| **Data sent to GenAI applications increased more than 30-fold in one year—from 250 MB to 7.7 GB per organization per month on average.** | Exposure opportunity is rising much faster than the GenAI user population. | “The amount of enterprise data moving into GenAI applications grew more than 30 times in one year.” | [Netskope Cloud and Threat Report: Generative AI 2025](https://www.netskope.com/resources/cloud-and-threat-reports/cloud-and-threat-report-generative-ai-2025). Telemetry from organizations using Netskope; not all enterprises. |
| **72% of observed enterprise GenAI use occurred through personal accounts.** | A file-level policy needs to survive beyond an organization-managed account or application. | “Nearly three quarters of observed enterprise GenAI usage still ran through personal accounts.” | [Netskope Cloud and Threat Report: Generative AI 2025](https://www.netskope.com/resources/cloud-and-threat-reports/cloud-and-threat-report-generative-ai-2025). Vendor telemetry. Netskope classifies this as shadow IT. |
| **57.46% of fraudulent identity documents were digital forgeries, versus 16.7% one year earlier.** | Digital documents are becoming easier to alter and manufacture with AI-assisted tools, increasing the need to verify issuer and integrity. | “For the first time in Entrust’s dataset, digital forgeries were the majority of document fraud—57.46%, up from 16.7% a year earlier.” | [Entrust Identity Fraud Report 2025](https://www.entrust.com/sites/default/files/documentation/reports/2025-identity-fraud-report.pdf), based on Entrust/Onfido identity-verification data. This concerns identity documents, not all business files. |
| **21,442 Business Email Compromise complaints produced $2.77 billion in reported losses during 2024.** | Business transactions fail when recipients cannot trust the apparent sender or instructions attached to a communication. | “The FBI recorded $2.77 billion in Business Email Compromise losses in 2024 across more than 21,000 complaints.” | [FBI IC3 2024 Annual Report](https://www.ic3.gov/AnnualReport/Reports/2024_IC3Report.pdf), complaint-based reported losses. Underreporting is possible. |
| **The average reported BEC loss was approximately $129,000 per complaint.** | One forged or compromised high-value exchange can justify an enterprise trust-control budget. | “Reported BEC losses averaged roughly $129,000 per complaint in 2024.” | Calculated from the FBI’s $2.770 billion and 21,442 complaint totals. This is an arithmetic mean, not the median loss. |
| **48% of breaches in Verizon’s 2026 DBIR involved a third party, a 60% increase.** | The security boundary increasingly includes vendors, partners, and shared workflows—the precise place where document policy and provenance break down. | “Almost half of analyzed breaches involved a third party, according to Verizon’s latest DBIR.” | [Verizon 2026 DBIR announcement](https://www.verizon.com/about/news/breach-industry-wide-dbir-finds). “Third party” is broader than document exchange and should be presented as boundary-risk context. |
| **Consumers reported $12.5 billion in fraud losses in 2024, including $2.95 billion from imposter scams.** | Verification of who issued an artifact is a broad and economically significant trust problem. | “Imposter scams alone generated nearly $3 billion in reported consumer losses in 2024.” | [U.S. Federal Trade Commission, 2024 fraud data](https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024). Consumer reports, not enterprise document fraud. |
| **Email was the identified contact method in 25% of FTC fraud reports and those reports represented $502 million in losses.** | Documents and official-looking instructions commonly arrive through a channel that recipients already struggle to trust. | “Email was the most commonly reported fraud-contact method in the FTC’s 2024 data.” | [FTC Consumer Sentinel Network Data Book 2024](https://www.ftc.gov/system/files/ftc_gov/pdf/csn-annual-data-book-2024.pdf). Consumer complaint data. |

## The strongest three-slide sequence

### Problem slide: AI adoption has outrun policy

Use these together:

- 75% of knowledge workers use AI at work.
- 78% of AI users bring their own AI tools.
- Verizon reports shadow-AI usage rising from 15% to 45% in one year.

Suggested line:

> “AI is already inside the workflow. Three quarters of knowledge workers use it, most users bring their own tools, and Verizon says shadow-AI usage tripled in a year. Enterprise policy did not travel at the same speed.”

### Exposure slide: files carry the highest-value data

Use these together:

- Nearly 22% of observed GenAI file uploads contained sensitive content.
- Files accounted for 75.3% of observed customer-profile leaks and 68.8% of employee-PII incidents.
- Data volume sent to GenAI applications increased more than 30-fold in a year.

Suggested line:

> “The risk is not theoretical and it is not limited to prompts. More than one in five uploaded files in Harmonic’s observed enterprise AI traffic contained sensitive content, while the volume of data entering GenAI applications grew more than 30 times in a year.”

### Trust slide: boundaries and authenticity are expensive failures

Use these together:

- 48% of breaches involved a third party in Verizon’s 2026 DBIR.
- FBI BEC losses reached $2.77 billion in 2024.
- Digital forgeries became 57.46% of document fraud in Entrust’s identity-verification dataset.

Suggested line:

> “Almost half of analyzed breaches now involve a third party, reported Business Email Compromise losses reached $2.77 billion, and digital forgeries have become the majority of document fraud in Entrust’s identity dataset. The enterprise boundary has become a trust problem.”

## Recommended opening statistic

The most directly relevant opening number is:

> **Nearly 22% of files uploaded to GenAI tools contained sensitive content.**

Follow immediately with the scope:

> “That comes from Harmonic Security’s analysis of 20,000 enterprise file uploads in Q2 2025—not a survey about hypothetical concern.”

This supports DocShield’s AI-upload-policy wedge more directly than general cybercrime totals.

## Statistics that need careful framing

- **Do not say “22% of all documents are sensitive or fraudulent.”** The 22% finding applies to files uploaded to GenAI tools in Harmonic’s observed customer traffic.
- **Do not say “57% of business documents are forged.”** The 57.46% finding means digital forgeries represented 57.46% of fraudulent identity documents detected in Entrust’s dataset.
- **Do not equate BEC losses with document fraud.** BEC is evidence of broken sender and instruction trust; it includes compromised and spoofed communications beyond documents.
- **Do not claim third-party involvement proves a document caused a breach.** Verizon’s 48% figure establishes the scale of boundary and supply-chain risk.
- **Do not combine different studies as though they share a denominator.** Microsoft is a workforce survey; Harmonic and Netskope report vendor-observed activity; FBI and FTC figures are complaint-based; Verizon analyzes security incidents and breaches.
- **Say “reported losses,” not total losses.** FBI and FTC totals depend on victims reporting incidents.

## Claims to avoid entirely

- “Twenty percent of documents are fraud.” No credible universal statistic with that denominator was found.
- “DocShield would have prevented $2.77 billion in BEC losses.” The evidence does not support that counterfactual.
- “Most corporate files leak to AI.” The available data supports a significant risk, not that majority claim.
- “Document fraud grew 244% everywhere.” Entrust observed that increase in the digital-forgery share of its identity-document fraud dataset.

## Internal product proof points

These are still useful later in the deck, but they are not market statistics:

- Four questions answered: issuer, integrity, policy, and controlled-share history.
- Two trust modes: portable passport and secure link.
- Eight verification layers and eight behavioral signals.
- Twenty-three implemented backend routes.
- Forty-four named backend and frontend test cases by static repository count; this is not a passing-test claim.
- A proposed 6–10 week design-partner pilot and a target of two or three initial partners.

## Source quality notes

1. **Government complaint data:** FBI and FTC are authoritative for reported complaints and losses, but totals are incomplete because not every incident is reported.
2. **Incident datasets:** Verizon’s DBIR aggregates law-enforcement, forensic, insurer, industry, and Verizon case data. It is strong cyber-risk context but is not a random sample of every company.
3. **Workforce survey:** Microsoft and LinkedIn surveyed 31,000 people across 31 countries and supplemented the survey with product and labor-market signals.
4. **Vendor telemetry:** Harmonic, Netskope, and Entrust publish measurements from the traffic or verification activity visible to their products. These offer valuable real-world behavior data but may overrepresent organizations actively buying security controls.
