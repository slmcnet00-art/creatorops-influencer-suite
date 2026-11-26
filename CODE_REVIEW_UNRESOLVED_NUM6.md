# NUM-6: 원문 확인이 필요한 한글 리터럴

정상 동작하는 인접 처리부의 헤더 별칭과 명시된 상태 상수는 복원했습니다.
아래 UI 안내·기본 제목·상태·그룹 기본값은 원문 근거가 없어 변경하지 않았습니다.
줄 번호는 이 작업 커밋 시점의 `src/App.jsx` 기준이며, 코드 문자열로 다시 찾을 수 있습니다.
이 때문에 NUM-6은 부분 완료이며 깨진 리터럴 제거 완료 조건은 아직 충족하지 않습니다.

| 줄 | 원문 확인 필요 코드 |
|---|---|
| 10588 | `getPayloadValue(payload, ['content_url', 'content url', 'video url', 'post url', 'url', 'link', '콘텐츠 URL', '영상 URL', '링크']) ?? '',` |
| 10626 | `getPayloadValue(payload, ['content_url', 'content url', 'video url', 'post url', 'url', 'link', '콘텐츠 URL', '영상 URL', '링크']) ?? '',` |
| 10634 | `const campaignName = String(getPayloadValue(payload, ['campaign_name', 'campaign', 'campaign name', '캠페인', '캠페인명']) ?? '').trim()` |
| 10687 | `audience: '??? ?? ???? ??',` |
| 10690 | `status: '?? ??',` |
| 10691 | `topics: [activeBrand.category || '???', platform],` |
| 10706 | `title: String(getPayloadValue(payload, ['content_title', 'title', 'video title', '콘텐츠 제목', '제목']) || '???? ???').trim(),` |
| 10708 | `status: views || likes || comments || shares || saves ? '?? ???' : '?? ?? ??',` |
| 10718 | `metricsSource: '???? ???',` |
| 10749 | `'??? ?? URL ' + importedCount + '? ?? ??',` |
| 10753 | `setDataRoomImportStatus('??? ?? ???? raw ' + rawRows.length + '? ?? ? ?? ?? ' + importedCount + '?')` |
| 10754 | `showToast('??? ?? ' + importedCount + '?? ??????. ??/?? ' + skippedCount + '?? ????, ???? raw? ??????.')` |
| 10756 | `showToast(error instanceof Error ? error.message : '??? ?? ????? ??????.')` |
| 10856 | `const category = String(getPayloadValue(payload, ['category', '카테고리']) || activeBrand.category || '???').trim()` |
| 10887 | `audience: String(getPayloadValue(payload, ['memo', 'note', '메모', '비고']) || '???? ?? ??'),` |
| 10890 | `status: '??? ??',` |
| 10903 | `const groupName = String(getPayloadValue(payload, ['group_name', 'group name', 'list name', '그룹명', '리스트명']) || activeBrand.name + ' ?? ??').trim()` |
| 10905 | `const groupType = String(getPayloadValue(payload, ['group_type', 'group type', 'type', '그룹 유형', '유형']) || '????').trim()` |
| 10920 | `description: String(getPayloadValue(payload, ['memo', 'note', 'description', '메모', '설명']) || '?????? ??? ?? ??'),` |
| 10923 | `owner: currentAccount?.name || '?? ???',` |
| 10947 | `'?? ?? ???? ' + importedCreators + '? ??',` |
| 10951 | `setDataRoomImportStatus('?? ?? ???? raw ' + rawRows.length + '? ?? ? ?? ?? ' + importedCreators + '? ??')` |
| 10952 | `showToast('?? ???? ???????. ?? ' + importedCreators + '?, ?? ?? ' + importedGroups + '?, ?? ' + skippedRows + '?. ???? raw? ??????.')` |
| 10954 | `showToast(error instanceof Error ? error.message : '?? ?? ????? ??????.')` |
