import { useState } from 'react'
import { creatorProfileImage } from '../shared/creatorProfilePresentation.js'
export default function CreatorProfileAvatar({ creator }) {
  const [failed, setFailed] = useState('')
  const image = creatorProfileImage(creator)
  return image && failed !== image ? <img src={image} alt={`${creator.name} 프로필`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(image)} /> : <span className="creator-profile-placeholder" title="실제 프로필 이미지 확인 필요">{String(creator.name || '?').slice(0, 2)}</span>
}
