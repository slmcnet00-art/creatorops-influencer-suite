import { validateCandidateAssessments } from '../shared/evidenceRanking.js'

// Keep provider outputs complete and bounded; a campaign's final target is not a
// limit on the number of candidates that must receive an assessment.
export async function assessCandidateBatches(candidates, assess) {
  const batches = []
  for (let start = 0; start < candidates.length; start += 10) batches.push(candidates.slice(start, start + 10))
  const results = new Array(batches.length)
  let cursor = 0
  const worker = async () => {
    while (cursor < batches.length) {
      const index = cursor++
      const items = await assess(batches[index], { index, total: batches.length })
      results[index] = validateCandidateAssessments(items, batches[index])
    }
  }
  const settled = await Promise.allSettled(Array.from({ length: Math.min(2, batches.length) }, worker))
  const failure = settled.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
  return validateCandidateAssessments(results.flat(), candidates)
}
