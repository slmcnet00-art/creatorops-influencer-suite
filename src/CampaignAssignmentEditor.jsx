export default function CampaignAssignmentEditor({ creators, value, onChange }) {
  return (
    <fieldset className="assignment-list">
      <legend>배정 후보 수정</legend>
      <p>체크를 해제하면 이 캠페인 배정만 해제됩니다. 후보 그룹과 저장 후보는 유지됩니다.</p>
      {creators.map((creator) => (
        <label key={creator.id}>
          <input
            type="checkbox"
            aria-label={`${creator.name} 캠페인 배정`}
            checked={value.includes(creator.id)}
            onChange={(event) => onChange(event.target.checked
              ? [...value, creator.id]
              : value.filter((id) => id !== creator.id))}
          />
          {creator.name}
        </label>
      ))}
      {!creators.length && <p>배정된 후보가 없습니다. 후보 그룹에서 원하는 후보를 배정하세요.</p>}
    </fieldset>
  )
}
