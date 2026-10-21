# OS active learning bridge

`POST /os-bridge/v1/learning` accepts only `stage` and a bounded public topic `query`.
The dedicated server-only `CREATOROPS_OS_TOKEN` authenticates this read-only
single-company bridge. It does not accept workspace/brand identifiers, run an
AI model, edit policies, send outreach, or export contact/credential records.

Only persisted active recommendation/content-guide policies are read. Strategy
requests also require the active campaign-strategy policy. A database failure
does not fall back to stale memory or empty instructions.

The response pins complete policy instructions/rules and hashes of extracted
attachments. At most 12 relevant text chunks, 2 per material, fit within 24 KB.
Unselected or unindexed material is counted; no full Drive/library ingestion
is claimed. Full-file hashes identify the stored extracted text, not unread
original PDFs, videos, or changes that have not been imported.

The OS still owns the metered recommendation/guide model call. This bridge is
not the original specialized AI endpoint and does not return its output shape.
The OS records policy versions/fingerprints and combines its separately reviewed
project feedback with the pinned native context.
