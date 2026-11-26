import { CONTENT_METRICS, contentMetricHistory, metricValue } from '../shared/contentMetricHistory.js'

// eslint-disable-next-line no-control-regex -- Remove characters disallowed by XML 1.0 before writing cells.
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const col = n => { let s = ''; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s }
const link = (url, label) => /^https?:\/\//i.test(url || '') ? { label, url } : '미제공'
const metric = (post, key) => metricValue(post, key) ?? '미확인'
const dateCell = value => {
  if (!value || !Number.isFinite(Date.parse(value))) return '미기재'
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return { serial: Date.parse(value) / 86400000 + 25569 + (dateOnly ? 0 : 9 / 24), dateOnly }
}

export function campaignWorkbookSheets({ brand, campaign, posts = [], creators = [], markets = [], externalPosts = [], brandMonitor = [], exportedAt = new Date().toISOString(), cost = null, revenue = null }) {
  posts = posts.filter(post => post.sourceType !== 'demo')
  externalPosts = externalPosts.filter(post => post.sourceType !== 'demo')
  const name = campaign?.name || '캠페인 미선택'
  const metadata = `${brand?.name || ''} · ${name} · 작성 ${new Date(exportedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (한국시간)`
  const totals = CONTENT_METRICS.map(key => {
    const known = posts.map(post => metricValue(post, key)).filter(value => value !== null)
    return [known.length ? known.reduce((a, b) => a + b, 0) : '미확인', `${known.length}/${posts.length}건 확인`]
  })
  const summary = [
    ['브랜드', brand?.name || '', ''], ['캠페인', name, '선택한 캠페인만 포함'], ['업로드 콘텐츠', posts.length, '등록한 콘텐츠 URL 기준'],
    ...['조회수', '좋아요', '댓글', '공유', '저장'].map((label, i) => [label, ...totals[i]]),
    ['실제 집행비 (원)', cost ?? '연결 필요', '예산·예상 견적과 구분'], ['기록된 매출 (원)', revenue ?? '연결 필요', '구매 귀속 확인 필요'],
    ['매출 대비 집행 효율', cost > 0 && revenue !== null ? `${(revenue / cost * 100).toFixed(1)}%` : '계산 대기', '매출 ÷ 실제 집행비 × 100'],
  ]
  if (campaign?.archiveReport) summary.push(['제품 발송 기록', campaign.archiveReport.shipments?.length || 0, '발송과 업로드를 구분'])
  const sheets = [{ name: '성과 요약', title: '캠페인 성과 보고서', metadata, note: '미확인 값은 0으로 합산하지 않습니다. 수집일과 작성일을 구분합니다.', headers: ['항목', '결과', '집계 기준'], widths: [28, 42, 64], rows: summary, filter: false },
    { name: '콘텐츠 성과', title: '개별 업로드 콘텐츠 성과', metadata, note: '원본 열기를 누르면 게시물로 이동합니다. 게시일과 수집일은 별도 기록입니다.',
      headers: ['번호', '크리에이터', '플랫폼', '콘텐츠 제목', '게시일', '조회수', '좋아요', '댓글', '공유', '저장', '원본 링크', '수집일 (한국시간)', '출처'],
      widths: [7, 24, 14, 44, 14, 15, 14, 12, 12, 12, 15, 23, 38],
      rows: posts.map((post, i) => [i + 1, creators.find(c => c.id === post.creatorId)?.name || post.creator || '', post.platform || '', post.title || '', dateCell(post.publishedAt), ...CONTENT_METRICS.map(key => metric(post, key)), link(post.url || post.contentUrl, '원본 열기'), dateCell(post.sourceCollectedAtIso || post.checkedAt || post.fetchedAt), post.metricsSource || post.source || '미기재']) },
    { name: '관측 이력', title: '콘텐츠별 실제 관측 이력', metadata, note: '최근 30일 실제 관측값만 포함합니다. 게시일이나 작성일로 과거 수집일을 만들지 않습니다.',
      headers: ['콘텐츠 제목', '관측일 (한국시간)', '조회수', '좋아요', '댓글', '공유', '저장', '출처', '원본 링크'], widths: [44, 23, 15, 14, 12, 12, 12, 38, 15],
      rows: posts.flatMap(post => contentMetricHistory(post).map(point => [post.title || '', dateCell(point.measuredAt), ...CONTENT_METRICS.map(key => point[key] ?? '미확인'), point.source || '', link(post.url || post.contentUrl, '원본 열기')])) },
  ]
  if (campaign?.archiveReport?.shipments?.length) sheets.push({ name: '발송 내역', title: '제품 발송 기록', metadata, note: '원본 계정·제품·발송일 기준입니다. 수령자 연락처·주소·송장번호는 포함하지 않습니다.', headers: ['번호', '계정', '제품', '발송일', '프로필', '원본 행'], widths: [7, 28, 40, 15, 16, 12], rows: campaign.archiveReport.shipments.map((row, i) => [i + 1, row.handle, row.product, dateCell(row.shippedAt), link(row.profileUrl, '프로필 열기'), row.sourceRow]) })
  if (markets.length) sheets.push({ name: '국가별 성과', title: '캠페인 국가별 운영 현황', metadata, note: '캠페인의 국가별 운영 집계입니다. 콘텐츠 원천별 확인 여부는 콘텐츠 성과 시트에서 확인하세요.', headers: ['국가', '마켓', '발굴 후보', '연락', '회신', '섭외', '업로드'], widths: [12, 25, 16, 14, 14, 14, 14], rows: markets.map(row => [row.country, row.label, row.discovered, row.contacted, row.responded, row.recruited, row.uploaded]) })
  if (externalPosts.length) sheets.push({ name: '외부 콘텐츠 참고', title: '연결된 외부 콘텐츠 자료', metadata, note: '외부 업로드 원천입니다. 캠페인 연결을 확인하기 전에는 성과 요약에 합산하지 않습니다.', headers: ['크리에이터', '캠페인 표기', '플랫폼', '제목', '조회수', '좋아요', '댓글', '공유', '저장', '원본', '파일', '시트'], widths: [25, 30, 14, 44, 15, 14, 12, 12, 12, 15, 35, 25], rows: externalPosts.map(row => [row.creatorName, row.campaignName || '미연결', row.platform, row.title, ...CONTENT_METRICS.map(key => metric(row, key)), link(row.url, '원본 열기'), row.fileName, row.sheetName]) })
  if (brandMonitor.length) sheets.push({ name: '브랜드 모니터', title: '브랜드 모니터 참고자료', metadata, note: '브랜드·경쟁 관련 크리에이터 자료입니다. 개별 캠페인의 실제 업로드 성과와 구분합니다.', headers: ['크리에이터', '팔로워', '지역', '언어', '평균 조회수', '총 조회수', '영상 수', '프로필', '원본 파일'], widths: [28, 16, 25, 20, 17, 17, 14, 16, 40], rows: brandMonitor.map(row => [row.creatorName, row.followers, row.region, row.language, row.averageViews, row.totalViews, row.videos, link(row.profileUrl, '프로필 열기'), row.fileName]) })
  return sheets
}

const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd"/><numFmt numFmtId="166" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="4"><font><sz val="11"/><color rgb="FF172033"/><name val="맑은 고딕"/></font><font><b/><sz val="19"/><color rgb="FF172033"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="맑은 고딕"/></font><font><sz val="11"/><color rgb="FF2460CC"/><u/><name val="맑은 고딕"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2460CC"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><bottom style="hair"><color rgb="FFE3E7EE"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="0" applyAlignment="1"><alignment vertical="center" wrapText="1" indent="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center" indent="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" applyAlignment="1"><alignment vertical="center" indent="1"/></xf><xf numFmtId="165" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="166" fontId="0" fillId="0" borderId="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

export async function buildReportXlsx(sheets) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships'
  zip.file('_rels/.rels', `<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)
  zip.file('xl/styles.xml', styles)
  zip.file('xl/workbook.xml', `<workbook xmlns="${main}" xmlns:r="${rel}"><bookViews><workbookView/></bookViews><sheets>${sheets.map((sheet, i) => `<sheet name="${xml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<Relationships xmlns="${packageRel}">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`)
  zip.file('[Content_Types].xml', `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)
  sheets.forEach((sheet, i) => {
    const links = []
    const last = col(sheet.headers.length - 1)
    const cell = (value, ref, style = 0) => {
      if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="4"><v>${value}</v></c>`
      if (value?.serial != null) return `<c r="${ref}" s="${value.dateOnly ? 6 : 7}"><v>${value.serial}</v></c>`
      if (value?.url) { links.push({ ref, url: value.url }); return `<c r="${ref}" s="5" t="inlineStr"><is><t>${xml(value.label)}</t></is></c>` }
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
    }
    const rows = [
      `<row r="1" ht="38" customHeight="1">${cell(sheet.title, 'A1', 1)}</row>`,
      `<row r="2" ht="30" customHeight="1">${cell(sheet.metadata, 'A2', 2)}</row>`,
      `<row r="3" ht="38" customHeight="1">${cell(sheet.note, 'A3', 2)}</row>`,
      `<row r="5" ht="32" customHeight="1">${sheet.headers.map((v, j) => cell(v, `${col(j)}5`, 3)).join('')}</row>`,
      ...(sheet.rows.length ? sheet.rows : [['기록된 자료가 없습니다.']]).map((row, n) => {
        const height = Math.min(180, Math.max(32, ...row.map((value, j) => {
          if (typeof value !== 'string') return 32
          const length = [...value].reduce((sum, c) => sum + (c.charCodeAt(0) > 255 ? 2 : 1), 0)
          return (Math.ceil(length / Math.max(8, sheet.widths[j] - 3)) + value.split('\n').length - 1) * 17 + 10
        })))
        return `<row r="${n + 6}" ht="${height}" customHeight="1">${row.map((v, j) => cell(v, `${col(j)}${n + 6}`)).join('')}</row>`
      }),
    ].join('')
    const end = Math.max(6, sheet.rows.length + 5)
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, `<worksheet xmlns="${main}" xmlns:r="${rel}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${last}${end}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ${sheet.headers.length > 8 ? 'xSplit="2" ' : ''}ySplit="5" topLeftCell="${sheet.headers.length > 8 ? 'C6' : 'A6'}" activePane="${sheet.headers.length > 8 ? 'bottomRight' : 'bottomLeft'}" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="32"/><cols>${sheet.widths.map((width, j) => `<col min="${j + 1}" max="${j + 1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${rows}</sheetData>${sheet.filter !== false ? `<autoFilter ref="A5:${last}${end}"/>` : ''}<mergeCells count="3">${[1, 2, 3].map(row => `<mergeCell ref="A${row}:${last}${row}"/>`).join('')}</mergeCells>${links.length ? `<hyperlinks>${links.map((l, n) => `<hyperlink ref="${l.ref}" r:id="rId${n + 1}"/>`).join('')}</hyperlinks>` : ''}<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="${sheet.headers.length > 10 ? 8 : 9}" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`)
    if (links.length) zip.file(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, `<Relationships xmlns="${packageRel}">${links.map((l, n) => `<Relationship Id="rId${n + 1}" Type="${rel}/hyperlink" Target="${xml(l.url)}" TargetMode="External"/>`).join('')}</Relationships>`)
  })
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
