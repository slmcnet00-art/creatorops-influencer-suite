# CreatorOps Public Data Collection Policy

## Purpose

CreatorOps collects public creator and content signals to support campaign discovery, outreach prioritization, and reporting.

## Collection Layers

1. Official APIs
   - YouTube Data API for channel and video statistics.
   - Google Programmable Search for public profile discovery.
   - Gmail API for approved outbound email.

2. Public Snapshot Collection
   - Public profile or content URLs can be fetched server-side.
   - The collector reads public HTML/metadata only.
   - It extracts visible metadata such as title, description, image, followers, views, likes, comments, shares, or saves when these values are present in public metadata.

3. Manual Verification
   - Instagram and TikTok often hide or vary metrics.
   - If the public snapshot does not expose reliable metrics, the system records `manual_required`.
   - Operators should verify those values manually or through creator-authorized data.

## Exclusions

The system must not:

- bypass login walls, CAPTCHA, rate limits, or private account restrictions
- use stolen sessions, unofficial cookies, or credential sharing
- collect private audience information without creator authorization
- guarantee estimated metrics as verified metrics

## Confidence Model

- Official API: high confidence
- Public snapshot: medium confidence
- Search snippet only: low to medium confidence
- Manual entry: depends on operator verification

Each surfaced metric should retain a source label so client reports can distinguish official, public snapshot, estimated, and manually verified data.
