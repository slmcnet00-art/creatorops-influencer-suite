export function creativeExecutionInstructions(kind) {
  return [
    '\n## Creative execution quality (current task, not a generic playbook)',
    'A slogan, generic benefits list, or "introduce the app then add CTA" is not an executable plan. Do not promise virality.',
    'Start from one specific audience tension, one observable product proof, and one behavior to ask for. State the evidence and the uncertainty behind that hypothesis.',
    'Develop THREE materially different concepts (different opening image, tension and proof task, not synonyms of the same line). Select one and explain why it fits the supplied audience/creator evidence. Avoid default "오늘 뭐 먹지?" hooks unless an actual, specific cooking constraint changes the premise.',
    'For each concept give a proposed first-3-second image AND exact spoken line/subtitle. Use concrete objects/tasks from supplied evidence. Numerical challenges, price savings, time savings, before/after results and past experience must be measured or explicitly proposed tests, never invented proof.',
    'For recipe promotion, distinguish teaching a replicable recipe from watching someone eat. The viewer must see the actual dish/task and a reason the product helps, using only verified functionality. Unknown functionality becomes a preproduction verification task; build the safe core idea from known facts rather than repeating warnings in every sentence.',
    'Use supplied reference URLs with title and evidence scope. Explain one SPECIFIC element to adapt into a NEW scene and one thing not to copy. Title/description proves the premise, not an unseen camera sequence. Mark a scene as a new proposal, not an observation. If no usable source exists, explicitly state reference selection pending and specify search criteria; never invent a successful reference.',
    'End with a small comparison test: change only the opening/proof task, specify a measurable signal that is actually accessible, when to review and what decision follows. Targets are hypotheses, not guaranteed forecasts. Do not require unavailable save/share/conversion data.',
    kind === 'guide'
      ? 'Use an actual storyboard TABLE for the chosen concept: time/chapter | visual/action | spoken line | subtitle | evidence/asset | CTA. Separate first 0-3s, proof demonstration, payoff and closing. Cover EACH selected format. Place all outstanding product/language/link/fee approvals in a short preproduction checklist. Give creators choices, not the same script for everyone.'
      : 'Include a concrete hero storyboard outline with opening, proof task, payoff and CTA in addition to operations/budget. Assign creator roles from real supplied public content evidence. Explain why the concept is useful to the viewer rather than just useful to the brand.',
  ].join('\n')
}

export function assertCreativeExecution(text, kind) {
  const value = String(text || '')
  const fail = () => { throw Object.assign(Error('구체적인 후킹·촬영 순서·검증 계획이 부족한 생성물입니다. 자료를 보완하고 다시 생성하세요.'), { status: 422 }) }
  if (!/(?:0\s*[-–~〜]\s*3|(?:첫|오프닝)\s*3\s*초|最初の?\s*3\s*秒|first\s*3\s*seconds)/i.test(value)) fail()
  if (!/(?:검증|비교\s*테스트|가설|検証|比較テスト|仮説|hypothesis|test)/i.test(value)) fail()
  if (kind === 'guide' && value.split('\n').filter(line => /^\s*\|.+\|/.test(line)).length < 5) fail()
}
