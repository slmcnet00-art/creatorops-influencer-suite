import { QUOTE_FORM_TYPES, quoteFormType } from '../shared/campaignQuote.js'

// The two clean templates are authored with the bundled spreadsheet runtime.
// Only business cells/rows are filled here; shared report-export styling is unchanged.
// eslint-disable-next-line no-control-regex
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const col = index => String.fromCharCode(65 + index)
const padNote = value => value ? String(value).split('\n').map(line => `\u00a0\u00a0${line}`).join('\n') : ''
const unprefix = value => value?.replace(/(<\/?)x:/g, '$1').replace('xmlns:x=', 'xmlns=')
const safeLink = value => { try { const u = new URL(value); return /^https?:$/.test(u.protocol) && !u.username && !u.password ? u.href : '' } catch { return '' } }
const koreaDate = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))

export async function buildMipingQuoteXlsx({ campaign, brand, quote, settings = {}, templateBytes, exportedAt = new Date().toISOString() }) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(templateBytes)
  const original = unprefix(await zip.file('xl/worksheets/sheet1.xml')?.async('string'))
  if (!original || !zip.file('xl/styles.xml')) throw new Error('미핑기획 견적서 양식을 불러오지 못했습니다.')
  const formType = quoteFormType(quote.formType || settings.formType)
  const formLabel = QUOTE_FORM_TYPES.find(type => type.id === formType).label
  const styleOf = ref => {
    const tag = original.match(new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*>`))?.[0]
    if (!tag) throw new Error(`견적서 양식 서식 누락: ${ref}`)
    return Number(tag.match(/\bs="(\d+)"/)?.[1] || 0)
  }
  const styles = { company: styleOf('B1'), label: styleOf('A2'), meta: styleOf('B2'), title: styleOf('B3'), date: styleOf('B4'), amount: styleOf('B5'), header: styleOf('A6'), text: styleOf('A7'), qty: styleOf('E7'), unit: styleOf('F7'), cost: styleOf('G7'), note: styleOf('H7'), subtotal: styleOf('A8'), subCost: styleOf('G8'), vat: styleOf('A9'), vatCost: styleOf('G9'), total: styleOf('A10'), totalCost: styleOf('G10'), totalNote: styleOf('H10'), footer: styleOf('A12') }
  const styleXml = unprefix(await zip.file('xl/styles.xml').async('string'))
  const xfBlock = styleXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)
  const xfs = xfBlock?.[1].match(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g)
  if (!xfs?.[styles.unit]) throw new Error('견적서 단가 서식이 올바르지 않습니다.')
  const indent = (xf, left = false) => {
    if (!/<alignment\b/.test(xf)) return xf.replace('</xf>', `<alignment indent="1"${left ? ' horizontal="left"' : ''}/></xf>`)
    return xf.replace(/<alignment\b([^>]*?)\s*\/>/, (_, attrs) => `<alignment${attrs.replace(/\sindent="[^"]*"/g, '').replace(left ? /\shorizontal="[^"]*"/g : /$^/, '')} indent="1"${left ? ' horizontal="left"' : ''}/>`)
  }
  for (let i = 0; i < xfs.length; i++) if (xfs[i].includes('horizontal="right"')) xfs[i] = indent(xfs[i])
  const percentStyle = xfs.length
  const percentXf = xfs[styles.unit].replace(/numFmtId="\d+"/, 'numFmtId="9"')
  const noteStyle = xfs.length + 1, totalNoteStyle = xfs.length + 2
  zip.file('xl/styles.xml', styleXml.replace(xfBlock[0], `<cellXfs count="${xfs.length + 3}">${xfs.join('')}${percentXf}${indent(xfs[styles.note], true)}${indent(xfs[styles.totalNote], true)}</cellXfs>`))
  styles.note = noteStyle; styles.totalNote = totalNoteStyle
  const cell = (ref, value, style, formula) => {
    if (formula) return `<c r="${ref}" s="${style}"${typeof value === 'number' && Number.isFinite(value) ? '' : ' t="str"'}><f>${xml(formula)}</f><v>${xml(value ?? '확인 필요')}</v></c>`
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
  }
  const rows = [], merges = [], links = []
  const writeRow = (r, cells, height = 30) => rows.push(`<row r="${r}" ht="${height}" customHeight="1">${cells.join('')}</row>`)
  const meta = (r, label, value, style = styles.meta, formula) => {
    merges.push(`B${r}:H${r}`)
    const lines = String(value ?? '').split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil([...line].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 2 : 1), 0) / 120)), 0)
    writeRow(r, [cell(`A${r}`, label, styles.label), cell(`B${r}`, value, style, formula)], Math.max(30, lines * 16 + 10))
  }
  const first = 7
  const creatorLast = first + quote.items.length - 1
  const managementRow = first + quote.items.length, shippingRow = managementRow + 1, otherRow = managementRow + 2
  const lastDetail = Math.max(otherRow, 14), subtotalRow = lastDetail + 1, vatRow = lastDetail + 2, grandRow = lastDetail + 3
  meta(1, '', [settings.issuerName || '㈜미핑기획', settings.issuerAddress].filter(Boolean).join(' · '), styles.company)
  meta(2, 'To', settings.recipient || brand?.name || campaign.brandName || '수신처 확인 필요')
  const dates = [campaign.schedule?.recruitStart, campaign.schedule?.uploadDue].filter(Boolean)
  meta(3, 'Title', `${campaign.name} · ${formLabel}${dates.length ? ` (${dates.join(' ~ ')})` : ''}`, styles.title)
  meta(4, 'Date', settings.issuedAt || koreaDate(exportedAt), styles.date)
  meta(5, 'Amount', quote.total, styles.amount, `G${grandRow}`)
  merges.push('A6:B6')
  writeRow(6, [cell('A6', 'List', styles.header), ...['채널', '콘텐츠 형식', '수량', 'Unit Cost (KRW)', '예상 비용 (KRW)', '비고'].map((v, i) => cell(`${col(i + 2)}6`, v, styles.header))], 34)
  quote.items.forEach((item, index) => {
    const r = first + index
    const note = [item.priceLabel, item.note, item.memberCount ? `${item.memberCount}명 기준` : '', item.roundingAdjustment ? `개별 건 원 단위 반올림 차이: ${item.roundingAdjustment}원` : ''].filter(Boolean).join('\n')
    const values = [item.grade, item.name, item.platform, item.scope, item.quantity ?? '확인 필요', item.unitPrice ?? '확인 필요', item.total, padNote(note)]
    const cells = values.map((value, index) => cell(`${col(index)}${r}`, value, [styles.text, styles.text, styles.text, styles.text, styles.qty, styles.unit, styles.cost, styles.note][index], index === 6 ? `IF(AND(ISNUMBER(E${r}),ISNUMBER(F${r})),ROUND(E${r}*F${r},0)${item.roundingAdjustment ? `+(${item.roundingAdjustment})` : ''},"확인 필요")` : undefined))
    const length = (value, width) => Math.ceil([...String(value ?? '')].reduce((n, c) => n + (c.charCodeAt(0) > 255 ? 2 : 1), 0) / width)
    const noteLines = note.split('\n').reduce((sum, line) => sum + Math.max(1, length(line, 26)), 0)
    const height = Math.max(32, Math.max(length(item.grade, 13), length(item.name, 23), length(item.platform, 11), length(item.scope, 17), noteLines) * 14 + 12)
    writeRow(r, cells, height)
    if (formType === 'list' && safeLink(item.profileUrl)) links.push({ ref: `B${r}`, url: safeLink(item.profileUrl) })
  })
  const detail = (r, label, qty, unit, cost, note, formula, unitStyle = styles.unit) => writeRow(r, [cell(`A${r}`, '운영', styles.text), cell(`B${r}`, label, styles.text), cell(`C${r}`, '', styles.text), cell(`D${r}`, '', styles.text), cell(`E${r}`, qty, styles.qty), cell(`F${r}`, unit, unitStyle), cell(`G${r}`, cost == null ? '미포함' : cost, styles.cost, formula), cell(`H${r}`, padNote(note), styles.note)], 40)
  detail(managementRow, '운영 기획 및 관리, 모니터링', 1, quote.managementRate / 100, quote.management, '크리에이터 비용 소계 기준', quote.items.length ? `ROUND(SUM(G${first}:G${creatorLast})*F${managementRow},0)` : '0', percentStyle)
  detail(shippingRow, '배송비', quote.shippingQuantity, quote.shippingUnitCost ?? '미입력', quote.shipping, '제품 배송 · 미입력 비용은 합계 제외', `IF(AND(ISNUMBER(E${shippingRow}),ISNUMBER(F${shippingRow})),ROUND(E${shippingRow}*F${shippingRow},0),"미포함")`)
  detail(otherRow, '기타 비용', 1, quote.additionalCost ?? '미입력', quote.additionalCost, settings.additionalNote || '제품비·2차 활용료 등 별도 협의', `IF(AND(ISNUMBER(E${otherRow}),ISNUMBER(F${otherRow})),ROUND(E${otherRow}*F${otherRow},0),"미포함")`)
  for (let r = otherRow + 1; r <= lastDetail; r++) writeRow(r, Array.from({ length: 8 }, (_, i) => cell(`${col(i)}${r}`, '', styles.text)), 24)
  const summary = (r, label, value, formula, leftStyle, numberStyle, note = '', noteStyle = leftStyle) => {
    merges.push(`A${r}:F${r}`)
    writeRow(r, [cell(`A${r}`, label, leftStyle), cell(`G${r}`, value, numberStyle, formula), cell(`H${r}`, padNote(note), noteStyle)], 34)
  }
  summary(subtotalRow, 'Sub Total / 공급가액', quote.subtotal, `SUM(G${first}:G${lastDetail})`, styles.subtotal, styles.subCost, quote.unknownCount ? `미확인 ${quote.unknownCount}행 제외` : '')
  // Keep the tax rate numeric and editable in H so the downloaded quote recalculates.
  merges.push(`A${vatRow}:F${vatRow}`)
  writeRow(vatRow, [cell(`A${vatRow}`, 'VAT / 부가세', styles.vat), cell(`G${vatRow}`, quote.vat, styles.vatCost, `ROUND(G${subtotalRow}*H${vatRow},0)`), cell(`H${vatRow}`, quote.vatRate / 100, percentStyle)], 30)
  summary(grandRow, 'Grand Total / 총 견적', quote.total, `SUM(G${subtotalRow}:G${vatRow})`, styles.total, styles.totalCost, 'VAT 포함 · 견적 초안', styles.totalNote)
  const notes = [
    `* 상기 견적은 예상되는 협업 범위에 따른 견적으로, 실제 Scope에 따라 변경될 수 있습니다. ${quote.unknownCount ? `단가·수량 미확인 ${quote.unknownCount}행은 합계에서 제외했습니다.` : ''}`,
    `* 견적 유효기간: ${settings.validUntil || '협의 후 확정'} · ${settings.note || '제품·배송·2차 활용 범위 및 확정 단가는 협의 후 결정합니다.'}`,
    `* ${formLabel} · ${formType === 'general' ? '등급·채널·형식·단가가 같은 항목을 묶어 작성하며, 등급별 계획 수량·단가를 수정할 수 있습니다.' : '선택한 캠페인의 포함된 크리에이터 명단 기준입니다. 이름을 클릭하면 등록된 공개 채널로 이동합니다.'}`,
  ]
  const footerLines = notes.flatMap(note => note.split(/\r?\n/).flatMap(line => {
    const result = []; let text = '', width = 0
    for (const character of line) {
      const next = character.charCodeAt(0) > 255 ? 2 : 1
      if (width + next > 135) { result.push(text); text = ''; width = 0 }
      text += character; width += next
    }
    result.push(text); return result
  }))
  footerLines.forEach((note, index) => { const r = grandRow + 2 + index; merges.push(`A${r}:H${r}`); writeRow(r, [cell(`A${r}`, note, styles.footer)], 30) })
  const end = grandRow + 2 + footerLines.length
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  const cols = original.match(/<cols>[\s\S]*?<\/cols>/)?.[0]
  if (!cols) throw new Error('견적서 열 너비 서식이 없습니다.')
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${main}" xmlns:r="${rel}"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:H${end}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="6" topLeftCell="A7" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/>${cols}<sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>${links.length ? `<hyperlinks>${links.map((link, i) => `<hyperlink ref="${link.ref}" r:id="rId${i + 1}"/>`).join('')}</hyperlinks>` : ''}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.15" footer="0.15"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;C&amp;P / &amp;N</oddFooter></headerFooter></worksheet>`)
  const relations = 'http://schemas.openxmlformats.org/package/2006/relationships'
  zip.file('xl/worksheets/_rels/sheet1.xml.rels', `<Relationships xmlns="${relations}">${links.map((link, index) => `<Relationship Id="rId${index + 1}" Type="${rel}/hyperlink" Target="${xml(link.url)}" TargetMode="External"/>`).join('')}</Relationships>`)
  const workbook = unprefix(await zip.file('xl/workbook.xml').async('string'))
  const escapedName = formLabel.replaceAll("'", "''")
  const defined = `<definedNames><definedName name="_xlnm.Print_Area" localSheetId="0">'${escapedName}'!$A$1:$H$${end}</definedName><definedName name="_xlnm.Print_Titles" localSheetId="0">'${escapedName}'!$1:$6</definedName></definedNames>`
  zip.file('xl/workbook.xml', workbook.replace(/<definedNames>[\s\S]*?<\/definedNames>/, '').replace(/<calcPr\b[^>]*\/?>(?:[\s\S]*?<\/calcPr>)?/, '').replace('</workbook>', `${defined}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`))
  // Prevent historical calculation chains from pointing at replaced row addresses.
  zip.remove('xl/calcChain.xml')
  for (const name of ['xl/_rels/workbook.xml.rels', '[Content_Types].xml']) {
    const content = await zip.file(name).async('string')
    zip.file(name, content.replace(/<(?:Relationship|Override)\b[^>]*calcChain[^>]*\/>/g, ''))
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}
