import type { Incident } from '@edaya/core'
import { IncidentStatus, Permission } from '@edaya/core'

/** Describe business changes so each required action covers the complete mutation. */
export function incidentChanges(after: Incident, before?: Incident) {
  const content = ({ status: _status, resolutionNotes: _notes, resolvedAt: _at, resolvedByStaffId: _by, updatedAt: _updated, ...data }: Incident['data']) => data
  return {
    content: !before || JSON.stringify(content(after.data)) !== JSON.stringify(content(before.data)),
    resolution: (after.status === IncidentStatus.Resolved) !== (before?.status === IncidentStatus.Resolved)
      || after.resolutionNotes !== before?.resolutionNotes
      || after.resolvedAt?.getTime() !== before?.resolvedAt?.getTime()
      || after.resolvedByStaffId !== before?.resolvedByStaffId,
    cancellation: (after.status === IncidentStatus.Cancelled) !== (before?.status === IncidentStatus.Cancelled),
  }
}

export function incidentWriteAction(after: Incident, before?: Incident): Permission {
  if (!before)
    return Permission.DISCIPLINE_CREATE
  const changes = incidentChanges(after, before)
  if (!changes.content && changes.resolution)
    return Permission.DISCIPLINE_VALIDATE
  if (!changes.content && changes.cancellation)
    return Permission.DISCIPLINE_ARCHIVE
  return Permission.DISCIPLINE_UPDATE
}
