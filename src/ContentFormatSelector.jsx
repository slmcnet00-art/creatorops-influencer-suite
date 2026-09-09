import { contentFormatOptions, normalizeContentFormats, toggleContentFormat } from './campaignTypes.js'
import './ContentFormatSelector.css'

export default function ContentFormatSelector({ value, onChange }) {
  const selected = normalizeContentFormats(value)
  return (
    <fieldset className="campaign-content-formats">
      <legend>콘텐츠 형식 · 다중 선택</legend>
      <div>
        {contentFormatOptions.map((format) => (
          <label key={format}>
            <input
              type="checkbox"
              checked={selected.includes(format)}
              onChange={() => onChange(toggleContentFormat(selected, format))}
            />
            {format}
          </label>
        ))}
      </div>
      <small>캠페인 타입과 별도로 여러 형식을 선택할 수 있습니다. 미선택 시 미정으로 저장합니다.</small>
    </fieldset>
  )
}
