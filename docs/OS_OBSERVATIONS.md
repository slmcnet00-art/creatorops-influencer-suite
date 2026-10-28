# OS observation and decision principles

The pure read endpoints are `GET /os-bridge/v1/observations/runs` and `GET /os-bridge/v1/observations/principles`. They require a distinct 32+ character `CREATOROPS_OBSERVATION_READ_TOKEN` and comma-separated `CREATOROPS_OBSERVATION_PROJECT_IDS`. The existing learning, execution and administrator credentials are separate.

The runs API selects only tagged `llm-call` records in the fixed company workspace and requested OS project/run. It returns metadata, signed pagination and no encrypted prompt/output fields. No matching native call returns an empty page. The present OS integration executes its recommendation model in OS, so an empty native call list is correct; no historical binding or provider receipt is fabricated.

The principles endpoint returns IDs, versions and current states of company decision memory for supported non-outreach features. It exposes no feedback, rationale, topics or instructions. It does not activate OS common knowledge.

The existing scoped learning endpoint now includes approved feature-matched decision instructions in its bounded fingerprinted pack. The OS preserves that version manifest and rechecks the complete policy fingerprint before its model call. A native paid retry also checks that every pinned rule is still approved at that version, while preserving the original prompt rather than injecting new rules.

Dependency updates remove the known audit findings without forcing a downgrade of presentation generation. The `image-size` override uses patched 2.0.4, with an embedded PNG/text PPTX export smoke test. Advisory: https://github.com/advisories/GHSA-5p2g-fcmc-qvqq . This audit is not a whole-system security assurance.

The OS public YouTube candidate lookup uses a separate CREATOROPS_DISCOVERY_READ_TOKEN, limited to POST /discovery/youtube/search. Learning, observation and execution keys are never silently reused for this scope.
