const text = (value, limit = 1500) => String(value || '').trim().slice(0, limit)

export function buildCandidateEvidence(creator = {}) {
  const evidence = []
  const profileText = [creator.description, creator.bio, creator.sourceTitle, creator.sourceSnippet].filter(Boolean).join('\n')
  if (profileText) evidence.push({ id: 'profile', text: text(profileText, 600), url: text(creator.profileUrl || creator.evidenceUrl, 250) })
  for (const video of (creator.recentRelevance?.evidence || []).slice(0, 3)) {
    if (video.videoId && video.title) evidence.push({ id: `video:${video.videoId}`, text: text([video.title, video.description].filter(Boolean).join('\n'), 700), url: text(video.url, 250) })
  }
  if (!creator.recentRelevance?.evidence?.length && creator.sourceTitle && creator.matchedContentUrl) evidence.push({ id: 'matched-content', text: text(creator.sourceTitle, 600), url: text(creator.matchedContentUrl, 250) })
  return evidence
}

export function validateCandidateAssessments(items, candidates) {
  const fail = message => { throw Object.assign(Error(message), { status: 422 }) }
  if (!Array.isArray(items) || items.length !== candidates.length) fail('AI 평가 후보가 누락되었습니다. 다시 실행하세요.')
  const known = new Map(candidates.map(row => [String(row.recommendationId), row]))
  const seen = new Set()
  return items.map(item => {
    const candidate = known.get(String(item.recommendationId))
    if (!candidate || String(item.creatorId) !== String(candidate.creatorId) || seen.has(String(item.recommendationId))) fail('AI 평가에 알 수 없거나 중복된 후보가 있습니다.')
    seen.add(String(item.recommendationId))
    if (!Number.isFinite(item.fitScore) || item.fitScore < 0 || item.fitScore > 100 || !['recommend', 'review', 'exclude'].includes(item.decision) || !['low', 'medium', 'high'].includes(item.confidence)) fail('AI 적합성 평가 형식이 잘못되었습니다.')
    const evidenceIds = Array.isArray(item.evidenceIds) ? [...new Set(item.evidenceIds)] : []
    const permitted = new Set((candidate.evidence || []).map(row => row.id))
    if (evidenceIds.some(id => !permitted.has(id))) fail('입력에 없는 근거를 인용한 AI 평가입니다.')
    if (item.decision === 'recommend' && (!evidenceIds.length || item.fitScore < 60 || item.confidence === 'low')) fail('근거가 부족한 후보는 확정 추천할 수 없습니다.')
    return {
      recommendationId: candidate.recommendationId, creatorId: candidate.creatorId,
      fitScore: Math.round(item.fitScore), decision: item.decision, confidence: item.confidence, evidenceIds,
      aiSummary: text(item.aiSummary, 500),
      aiReasons: (Array.isArray(item.aiReasons) ? item.aiReasons : []).map(value => text(value, 500)).filter(Boolean).slice(0, 3),
      outreachAngle: text(item.outreachAngle, 500), riskNote: text(item.riskNote, 500), message: text(item.message, 2500),
    }
  })
}

export function applyCandidateAssessments(rows, items) {
  const byId = new Map(items.map(item => [String(item.recommendationId), item]))
  return rows.map(row => {
    const item = byId.get(String(row.id))
    return item ? { ...row, ruleScore: row.ruleScore ?? row.score, score: item.fitScore, aiFitScore: item.fitScore, aiDecision: item.decision, aiConfidence: item.confidence, aiEvidenceIds: item.evidenceIds }
      : { ...row, aiDecision: 'unassessed' }
  }).sort((a, b) => (b.aiFitScore ?? -1) - (a.aiFitScore ?? -1))
}
