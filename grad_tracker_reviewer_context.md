# Grad Program Tracker — Reviewer Context
**File:** `grad_program_tracker_v2_7.xlsx`  
**Prepared:** March 2026  
**Owner:** JD Britt (MSgt, USAF — separating Nov 2027, targeting PhD entry Fall 2028)

---

## Why This Tracker Exists

This is a PhD application planning tool built around a specific career target: **AI/BCI Research Scientist**, with neuromorphic computing as the implementation layer. The tracker supports a systematic, data-driven approach to matching the owner's research interests to the right advisor at the right program — then executing outreach and applications from that foundation.

The core application logic is **supervisor-first**: the right advisor matters more than program prestige. A well-matched supervisor at UW may be more valuable than no connection at Stanford. The tracker exists to operationalize that principle at scale.

---

## Career Context (Why These 8 Programs)

The owner is an active-duty Air Force E-7 completing a BS in Computer Science (WGU, target: early 2027). Separation is planned for November 2027. The PhD is the primary post-military path, targeting Fall 2028 entry.

**Research identity — three-tier framework:**
- **Tier 1 (Theory):** ML theory, neuroscience-inspired algorithms, computational neuroscience as a lens into better models
- **Tier 2 (Implementation):** Neuromorphic computing (e.g., Intel Loihi), embedded systems, systems programming
- **Tier 3 (Application):** Brain-computer interfaces, AR, robotics, human-machine integration

Programs were selected to cover this intersection across a range of competitiveness, geography, and structure. The list is deliberately not all elite reaches — it includes accessible options and international programs for structural diversity.

---

## The 8 Target Programs

| ID | School | Degree | Location | Notes |
|---|---|---|---|---|
| STAN-CS-PHD | Stanford | CS PhD | Stanford, CA | Dream program. Pipeline to DeepMind/Neuralink/Meta AI. Stipend ~$57K/yr. GRE waived. |
| UCB-EECS-PHD | UC Berkeley | EECS PhD | Berkeley, CA | Dream program. GRE not accepted. Strong AI/ML + robotics. Stipend ~$44K/yr. |
| MIT-EECS-PHD | MIT | EECS PhD | Cambridge, MA | 152 faculty catalogued. Strong CSAIL neuroscience-adjacent PIs. Stipend ~$51.2K/yr. GRE waived. |
| CMU-SCS-PHD | CMU | SCS PhD | Pittsburgh, PA | Strong AI + robotics. GRE optional. Stipend ~$42.9K/yr. **GI Bill BAH ~$1,400/mo** — substantially lower than Bay Area. |
| UW-CSE-PHD | UW | CSE PhD | Seattle, WA | Rajesh Rao at Center for Neurotechnology. 131 faculty catalogued. GRE waived. |
| UCD-CS-PHD | UC Davis | CS PhD | Davis, CA | Nearby (Sacramento). More accessible than top-5. |
| IST-IGPC-MD | Science Tokyo | IGP(C) M+D | Tokyo, Japan | Integrated Master+Doctoral. **Requires advisor consent letter before applying** — most time-sensitive outreach. MEXT scholarship potential. |
| CAM-CS-PHD | Cambridge | CS PhD | Cambridge, UK | 2 referees standard; 3 for Gates Cambridge funding. ~53 faculty catalogued. |

**Mix:** 4 ultra-competitive (Stanford, MIT, Berkeley, CMU) · 1 strong/accessible (UW) · 1 nearby safety (UC Davis) · 2 international (Science Tokyo, Cambridge)

---

## Workbook Structure — 5 Sheets

### Sheet 1: Lists
Dropdown validation reference values for all standardized fields. Defines:
- 20 research interest areas (see below)
- 7 contact status stages
- GRE status options, degree types, priority levels, term starts, currencies, relationship types

### Sheet 2: Programs
8 rows, one per target program. Fields include: school, location, department, degree type, application fee, LOR count, GRE policy, stipend notes, application timeline, special deadlines, and website. **All entries verified 2026-02-27.**

### Sheet 3: Advisors
**565 rows** — the core database. Fields per advisor:
- Advisor ID (school abbreviation + sequential number, e.g., MIT-154)
- Program ID (links back to Programs sheet)
- Name, title, department, specialties, email, website
- Interest score (1–5 scale — **defined but not yet assigned for any entry**)
- Up to 3 top paper slots
- Contact status, last contact date, next follow-up date
- Google Scholar, DBLP, ResearchGate links (largely blank)

**Faculty counts by program:**
MIT (152) · UW (131) · UC Berkeley (70) · Stanford (54) · Cambridge (53) · Science Tokyo (35) · UC Davis (33) · CMU (37)

### Sheet 4: Program_Advisor_Map
**Empty.** Designed to map specific advisors to programs with relationship type (Primary target / Secondary / Co-advisor possible / Lab member) and fit rationale. This is a critical gap — it's the deliverable that transforms the raw database into an application shortlist.

### Sheet 5: Additional_Papers
**Empty.** Designed to catalogue representative papers per high-scoring advisor, with title, link, alignment rationale, citation count, and date added.

---

## Where the Data Came From

Faculty data was sourced from official department pages and research group listings, with methodology documented in the Notes column of the Advisors sheet:

- **Cambridge:** Faculty directory saved HTML; emails derived from CRSid in profile URLs
- **CMU:** CSD faculty lists filtered by AI/ML/Robotics area tags
- **MIT:** EECS faculty CS + AI+D listings (saved HTML), deduplicated; additional CSAIL PIs added from lab pages
- **Stanford:** CS AI faculty listing (saved HTML)
- **UC Berkeley:** EECS AI area page; Primary and Secondary faculty designations preserved
- **UC Davis:** CS area faculty listings (saved HTML), deduplicated
- **UW:** Allen School area faculty listings (saved HTML), deduplicated
- **Science Tokyo:** IGP(C) Application Guide faculty appendix

---

## What's Complete vs. What's Not

| Component | Status |
|---|---|
| Tracker schema and validation lists | ✅ Complete and stable |
| Program data (8 programs) | ✅ Complete, verified 2026-02-27 |
| Advisor database (565 entries) | ✅ Names, titles, departments, specialties, emails populated |
| Interest scores (1–5) | ❌ 0 of 565 assigned |
| Top papers per advisor | ❌ 0 populated |
| Program_Advisor_Map | ❌ Empty |
| Additional_Papers | ❌ Empty |
| Scholar/DBLP/ResearchGate links | ❌ Blank for nearly all entries |
| Contact outreach | ❌ All 565 show "Not contacted" |

**The tracker is fully built but unevaluated.** The raw database is complete; the analysis layer has not started.

---

## The Interest Scoring System

**Scale: 1–5** (defined, not yet calibrated)

The 20 defined research interest areas used for scoring:

> BCI · Embedded systems · Human-machine integration/cybernetics · Evolutionary ML · Optimization methods · Robotics · Embodied intelligence · Computational neuroscience · Learning algorithms/ML theory · Systems programming (C/C++/Rust/Zig) · Computer architecture · OS fundamentals · Reverse engineering · Hardware interfacing · Hardware hacking · Cybersecurity foundations · Networking fundamentals · Cryptography · Compilers/PL concepts · AI foundations

**What a reviewer needs to do:** Assign a 1–5 score to each advisor based on alignment with these 20 areas, with higher weight on the Tier 1–3 framework (ML theory → neuromorphic/embedded → BCI/robotics). A rubric distinguishing score levels has not yet been formalized — this is the first task before scoring begins.

---

## Key Factors and Why They Matter

**GI Bill BAH differential** — The GI Bill housing allowance varies by school location and runs for 36 months (years 1–3 of PhD). Bay Area rate (Stanford/Berkeley): $4,992/mo. CMU (Pittsburgh): ~$1,400/mo. That's a ~$43K/year income difference during PhD years — a material factor when ranking programs that are otherwise comparable on academic fit.

**GI Bill + stipend stacking** — Universities do not reduce PhD stipends for GI Bill recipients. Both stack. Total estimated GI Bill value (Bay Area, 36 months): ~$275K.

**Science Tokyo timing** — The IGP(C) program requires a written consent letter from an advisor *before* the application can be submitted. This makes advisor outreach there more urgent than at any US program.

**Advisor fit over ranking** — The application strategy is explicitly supervisor-first. The tracker exists to identify 2–4 primary target advisors per program, not to rank programs by US News order.

**Contact window** — Ideal advisor outreach is 3–6 months before application deadlines (typically December). Applications open in September. Science Tokyo is the exception — outreach must precede the application itself.

---

## Contact Status Workflow

Seven stages tracked in the Advisors sheet:

`Not contacted` → `Contacted` → `Responded` → `Meeting scheduled` → `Declined` / `No response` / `Active`

All 565 advisors are currently at stage 1 (Not contacted).

---

## Recommended Next Steps for a Reviewer

1. **Define the scoring rubric** — what distinguishes a 3 from a 4? Anchor each level to concrete criteria before scoring begins.
2. **Score the Advisors sheet** — apply the 1–5 scale to all 565 entries based on alignment with the 20 interest areas and the three-tier framework.
3. **Build the Program_Advisor_Map** — for each program, identify 2–4 primary targets and 1–2 secondaries based on scores. Write one-line fit rationales.
4. **Populate top papers** — for advisors scoring 4–5, identify 1–3 representative papers and enter them in the Advisors sheet (and Additional_Papers for deeper dives).
5. **Add Scholar/DBLP links** — enables faster research during evaluation.
6. **Flag Science Tokyo advisors** — any scoring 4–5 should trigger immediate outreach planning given the consent-letter requirement.
