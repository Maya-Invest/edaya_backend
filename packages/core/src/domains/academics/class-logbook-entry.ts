import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../authorization'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, permissionAction, read, readByIds, write } from '../../shared'
import { parseDomain, zodDate } from '../utils'

export const classLogbookEntryBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank'),
  date: zodDate(),
  chapter: z.string().trim().min(1, 'chapter must not be blank'),
  content: z.string().trim().min(1, 'content must not be blank'),
  objectives: z.array(z.string().trim().min(1, 'objective must not be blank')).default([]),
  homework: z.string().trim().min(1, 'homework must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  attachments: z.array(z.string().trim().min(1, 'attachment must not be blank')).default([]),
  progress: z.number().int().min(0, 'progress must be between 0 and 100').max(100, 'progress must be between 0 and 100'),
  createdAt: zodDate().default(() => new Date()),
})

export const classLogbookEntrySchema = classLogbookEntryBaseSchema

export type ClassLogbookEntryData = z.infer<typeof classLogbookEntrySchema>
export type ClassLogbookEntryInput = z.input<typeof classLogbookEntrySchema>

export const classLogbookEntryCreateSchema = classLogbookEntryBaseSchema.omit({ createdAt: true })
export const classLogbookEntryUpdateSchema = classLogbookEntryBaseSchema.partial().required({ id: true })

/**
 * Teaching journal entry for a class subject session (chapter, content, objectives, progress).
 */
export class ClassLogbookEntry {
  readonly data: ClassLogbookEntryData

  constructor(args: ClassLogbookEntryInput) {
    this.data = parseDomain(classLogbookEntrySchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get classGroupId() { return this.data.classGroupId }
  get classSubjectId() { return this.data.classSubjectId }
  get date() { return this.data.date }
  get chapter() { return this.data.chapter }
  get content() { return this.data.content }
  get objectives() { return this.data.objectives }
  get homework() { return this.data.homework }
  get attachments() { return this.data.attachments }
  get progress() { return this.data.progress }
  get createdAt() { return this.data.createdAt }
}

export const classLogbookEntryConfig: EntityConfigFactory<ClassLogbookEntry> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classLogbookEntries,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(
      permissionAction(Permission.CLASS_LOGBOOK_READ),
      readByIds(async (actor, ids) => {
        const entries = await repositories.classLogbookEntries.findByIds(ids)
        await policy.checkClassGroupAccess(actor, entries.map(entry => entry.classGroupId))
      }),
    ),
    write: write(
      permissionAction(Permission.CLASS_LOGBOOK_UPDATE),
      authorizeClassGroupLinked(policy, 'classGroupId'),
      authorizeClassGroupLinkedDelete(policy),
    ),
    gates: {
      preSave: validateClassLogbookEntrySave,
    },
    atomicExecution,
  })

async function validateClassLogbookEntrySave(
  entry: ClassLogbookEntry,
  _existing: ClassLogbookEntry | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [classGroup, classSubject] = await Promise.all([
    repositories.classGroups.findById(entry.classGroupId),
    repositories.classSubjects.findById(entry.classSubjectId),
  ])

  if (
    !classGroup
    || !classSubject
    || classSubject.classGroupId !== classGroup.id
    || classGroup.schoolId !== entry.schoolId
  ) {
    denyResourceAccess()
  }
}
