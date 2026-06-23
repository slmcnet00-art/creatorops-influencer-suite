# Competitor/API Expansion Notes

## Ugwanggi Comparison

Ugwanggi is strongest as a YouTube advertising/reference intelligence product:

- YouTube creator collaboration ads, in-stream ads, and display ad references
- Competitor and industry-level advertising trend search
- Daily data refresh positioning
- Excel export for richer plans
- Search by keyword, competitor, creator, and content

CreatorOps should not copy Ugwanggi data or depend on Ugwanggi APIs. The product direction is:

- Keep CreatorOps as an execution platform: campaign setup, creator discovery, outreach, recruited pool, delivery, tracking, report, and team permissions.
- Add Ugwanggi-like reference discovery where it helps campaign planning: trending content/ad references, source evidence, saved production references, and guide reuse.
- Use official or approved data sources first. Use public search only for public URL discovery and keep metric confidence visible.

## Implemented Expansion

`POST /references/search`

- YouTube: uses YouTube Data API `search.list`, `videos.list`, and `channels.list`.
- Instagram/TikTok: uses Brave Search API for public URL discovery, then attempts public snapshot enrichment.
- `platform=all`: searches YouTube, Instagram, and TikTok together.

Environment variable:

- `BRAVE_SEARCH_API_KEY`

## Recommended Next APIs

1. Brave Search API
   - Purpose: low-cost public web discovery for Instagram/TikTok/reference URLs.
   - Strength: replaces blocked/newly limited Google Custom Search for broad URL discovery.
   - Limitation: not a platform metric API; hidden views/likes remain unavailable.

2. Meta Instagram Graph API
   - Purpose: approved business/creator account data, hashtag media, owned-account insights.
   - Strength: official Meta path.
   - Limitation: not a full arbitrary competitor/PPL search database.

3. TikTok Research API
   - Purpose: public TikTok video/account research for eligible approved researchers.
   - Strength: official public data path where approved.
   - Limitation: eligibility is restricted and not a general commercial discovery API.

4. Google Ads Transparency Center provider
   - Purpose: competitor ad creative/reference monitoring.
   - Strength: closer to Ugwanggi's ad-reference surface.
   - Limitation: Google does not expose a broad official Ads Transparency Center API; third-party providers must be reviewed for terms, cost, and compliance.

5. Creator authorization/OAuth path
   - Purpose: campaign tracking after recruitment.
   - Strength: highest confidence for creator-post performance.
   - Limitation: requires creator consent and a clean onboarding flow.

## Product Gap Map

| Area | Ugwanggi-style expectation | CreatorOps status | Next action |
| --- | --- | --- | --- |
| YouTube reference search | Search high-performing ad/content references | Implemented via YouTube Data API | Add ad/brand classification tags |
| Instagram/TikTok reference search | Find viral PPL/reels/short-form examples | Added via Brave Search URL discovery | Add Meta/TikTok approved APIs when keys/eligibility are ready |
| Competitor ad monitoring | Search competitor brand ads | Not fully implemented | Add Ads Transparency provider after compliance review |
| Export | Excel export of data | Implemented in core pools; references can be saved for reuse | Add reference-board export if needed |
| Execution CRM | Outreach, recruited pool, delivery, reporting | CreatorOps advantage | Keep deepening campaign-specific workflow |

