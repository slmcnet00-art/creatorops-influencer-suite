import { useEffect, useRef, useState } from 'react'
import { UserRound } from 'lucide-react'
import { creatorProfileImage } from '../shared/creatorProfilePresentation.js'
import { loadCreatorProfileImage } from './creatorProfileImageClient.js'
export default function CreatorProfileAvatar({ creator }) {
  const [failed, setFailed] = useState('')
  const [resolved, setResolved] = useState(null)
  const [mountedAt] = useState(Date.now)
  const visibleRef = useRef(null)
  const profileUrl = creator.profileUrl || ''
  const image = resolved?.profileUrl === profileUrl && resolved.imageUrl ? resolved.imageUrl : creatorProfileImage(creator)
  const fresh = mountedAt - Date.parse(creator.profileCheckedAt || '') < 6 * 3600000
  useEffect(() => {
    if (!profileUrl || (fresh && image && failed !== image)) return
    let cancelled = false
    const load = () => loadCreatorProfileImage(profileUrl).then(data => { if (!cancelled) setResolved({ ...data, profileUrl }) })
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      load()
    }, { rootMargin: '80px' })
    if (visibleRef.current) observer.observe(visibleRef.current)
    return () => { cancelled = true; observer.disconnect() }
  }, [profileUrl, fresh, image, failed])
  return image && failed !== image ? <img ref={visibleRef} src={image} alt={`${creator.name} 프로필`} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(image)} /> : <span ref={visibleRef} className="creator-profile-placeholder" role="img" aria-label={`${creator.name} 프로필 사진 미수집`} title="프로필 사진 확인 필요"><UserRound size={18} aria-hidden="true" /></span>
}
