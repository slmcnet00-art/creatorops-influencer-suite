import { creatorAccountGroup } from '../shared/creatorAccountGroup.js'
import './creatorAccountGroup.css'

export default function CreatorAccountGroupBadge({ creator }) {
  const group = creatorAccountGroup(creator)
  return <span className={`creator-account-group-badge group-${group.id}`} title={group.detail} aria-label={`계정 등급: ${group.label}. ${group.detail}`}>{group.label}</span>
}
