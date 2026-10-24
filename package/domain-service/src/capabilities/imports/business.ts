/* eslint dot-notation: "off" -- Import snapshots are index-signature records. */
import type { CoreEntityKey, CoreEntityMap, ImportBatch, ImportJson, ImportRecord, ImportRow, ImportType } from '@edaya/core'
import type { SchoolService } from '../../services/school-service'
import { ImportAccessPolicy, importResources } from '@edaya/authorization'
import { AcademicDiscipline, applyImportCollection, applyImportScalars, BusinessRuleViolationError, ClassGroup, Guardian, GuardianContactMethod, GuardianStudentLink, IMPORT_TEMPLATES, isBlankImportValue, normalizeImportKey, PaymentMethod, PlacementStatus, StaffMember, Student, StudentAcademicYearProfile, Subject, SubjectMatter, Teacher, TeacherAcademicYearProfile, TeacherAssignment } from '@edaya/core'
import { digestCommandRequest } from '../../services/commands/command-execution'
import { acceptedCatalogTerms } from '../finance/accepted-catalog-terms'
import { importJson, normalizeImportValues } from './normalization'

export class ImportBusinessIssue extends BusinessRuleViolationError {
  constructor(code: string, readonly candidates: string[] = []) { super(code, code) }
}
function fail(code: string): never {
  throw new ImportBusinessIssue(code)
}
const defined = (record: ImportRecord, fields: readonly string[]): ImportRecord => Object.fromEntries(fields.filter(field => field in record).map(field => [field, record[field]!]))
const text = (value: ImportJson | undefined): string => typeof value === 'string' ? value : ''
const listText = (value: ImportJson | undefined): string[] => Array.isArray(value) ? value.map(String) : text(value).split(/[;&]/).map(item => item.trim()).filter(Boolean)
const annualStudent = ['placementStatusId', 'isRepeating']
const annualTeacher = ['disciplineIds', 'declaredHours', 'hoursPeriod', 'hoursPeriodLabel']
const relationshipFields = ['relationship', 'isPrimary', 'isBillingContact', 'legalGuardian', 'canPickup', 'emergencyContactPriority', 'receivesAcademicReports', 'receivesAttendanceAlerts', 'contactRestrictions', 'notes']
const contactKey = (item: ImportRecord) => `${item['type']}:${normalizeImportKey(item['value'])}`
const sourceResource: Partial<Record<CoreEntityKey, ImportType>> = { academicDisciplines: 'academic_disciplines', placementStatuses: 'placement_statuses', classGroups: 'classes', subjects: 'subjects', students: 'students', guardians: 'guardians', teachers: 'teachers', staffMembers: 'staff', studentServiceEnrollments: 'billing' }
/** One bounded validation pass shares tenant indexes, never a global or cross-request cache. */
export class ImportBusinessContext {
  private readonly cached = new Map<CoreEntityKey, Promise<CoreEntityMap[CoreEntityKey][]>>()
  constructor(readonly service: SchoolService, readonly batch: ImportBatch, readonly rows: ImportRow[] = []) { }
  get base() { return this.service.baseService }
  async list<K extends CoreEntityKey>(key: K): Promise<CoreEntityMap[K][]> {
    let values = this.cached.get(key)
    if (!values) {
      const repo = this.base.repositories[key]
      if (!repo.forSchool)
        throw new Error('Import matching requires a tenant-scoped repository')
      values = repo.forSchool(this.batch.schoolId).list({}) as Promise<CoreEntityMap[CoreEntityKey][]>
      this.cached.set(key, values)
    }
    return values as Promise<CoreEntityMap[K][]>
  }

  async readable<K extends CoreEntityKey>(key: K, id: string): Promise<CoreEntityMap[K]> {
    const scope = await this.base.access.entity(key).readScope()
    const entity = await this.base.repositories[key].forAccess(scope).findById(id)
    if (!entity)
      fail('IMPORT_TARGET_RESTRICTED_OR_MISSING')
    return entity as CoreEntityMap[K]
  }

  async reference(key: CoreEntityKey, value: ImportJson | undefined, owner: ImportRow, predicate: (data: ImportRecord) => boolean = () => true): Promise<ImportRecord> {
    if (isBlankImportValue(value))
      fail('IMPORT_REFERENCE_REQUIRED')
    const lookup = normalizeImportKey(value)
    const type = sourceResource[key]
    const staged = type
      ? this.rows.filter(row => row.type === type && row.id !== owner.id && row.proposed && predicate(row.proposed)
        && [row.targetId, row.proposed['code'], key === 'students' ? row.proposed['matricule'] : ['guardians', 'teachers', 'staffMembers'].includes(key) ? undefined : row.proposed['name']].some(candidate => candidate !== undefined && normalizeImportKey(candidate) === lookup))
      : []
    const existing = (await this.list(key)).filter((entity) => {
      const data = importJson(entity)
      return predicate(data) && [entity.id, data['code'], key === 'students' ? data['matricule'] : ['guardians', 'teachers', 'staffMembers'].includes(key) ? undefined : data['name']].some(candidate => candidate !== undefined && normalizeImportKey(candidate) === lookup)
    })
    const ids = new Set([...staged.map(row => row.targetId), ...existing.map(entity => entity.id)])
    if (ids.size > 1) {
      const candidates: string[] = []
      for (const entity of existing) {
        try {
          await this.readable(key, entity.id)
          candidates.push(entity.id)
        }
        catch { /* no unauthorized candidate disclosure */ }
      }
      throw new ImportBusinessIssue('IMPORT_REFERENCE_AMBIGUOUS', candidates)
    }
    const pending = staged[0]
    if (pending) {
      owner.dependencies.push(pending.id)
      if (pending.outcome === 'blocked' || pending.outcome === 'dependency_blocked')
        fail('IMPORT_DEPENDENCY_BLOCKED')
      return pending.proposed!
    }
    if (!existing[0])
      fail('IMPORT_REFERENCE_NOT_FOUND')
    return importJson(await this.readable(key, existing[0].id))
  }

  async unique<K extends CoreEntityKey>(key: K, predicate: (entity: CoreEntityMap[K]) => boolean): Promise<CoreEntityMap[K] | undefined> {
    const matches = (await this.list(key)).filter(predicate)
    if (matches.length > 1) {
      const candidates: string[] = []
      for (const entity of matches) {
        try {
          await this.readable(key, entity.id)
          candidates.push(entity.id)
        }
        catch { /* denied candidates remain private */ }
      }
      throw new ImportBusinessIssue('IMPORT_MATCH_AMBIGUOUS', candidates)
    }
    return matches[0] ? this.readable(key, matches[0].id) : undefined
  }

  async resolveReferences(row: ImportRow, data: ImportRecord): Promise<void> {
    const year = (item: ImportRecord) => item['academicYearId'] === this.batch.academicYearId
    const refs: [
      string,
      CoreEntityKey,
            ((item: ImportRecord) => boolean)?,
    ][] = [
      ['gradeLevelId', 'gradeLevels'],
      ['classGroupId', 'classGroups', year],
      ['studentId', 'students'],
      ['guardianId', 'guardians'],
      ['teacherId', 'teachers'],
      ['disciplineId', 'academicDisciplines'],
      ['placementStatusId', 'placementStatuses'],
      ['categoryId', 'subjectCategories'],
      ['catalogServiceId', 'catalogServices', year],
    ]
    for (const [field, key, predicate] of refs) {
      if (!isBlankImportValue(data[field]))
        data[field] = (await this.reference(key, data[field], row, predicate))['id']!
    }
    if (!isBlankImportValue(data['subjectId']) || !isBlankImportValue(data['subjectReference'])) {
      let grade = data['gradeLevelId']
      if (data['classGroupId'])
        grade = (await this.reference('classGroups', data['classGroupId'], row, year))['gradeLevelId']
      const scope = (item: ImportRecord) => year(item) && (!grade || item['gradeLevelId'] === grade)
      const resolved = await this.reference('subjects', data['subjectId'] || data['subjectReference'], row, scope)
      if (data['subjectId'] && data['subjectReference'] && (await this.reference('subjects', data['subjectReference'], row, scope))['id'] !== resolved['id'])
        fail('IMPORT_SUBJECT_REFERENCE_CONFLICT')
      data['subjectId'] = resolved['id']!
    }
    delete data['subjectReference']
    if (!isBlankImportValue(data['disciplineIds'])) {
      const ids: string[] = []
      for (const code of listText(data['disciplineIds']))
        ids.push(text((await this.reference('academicDisciplines', code, row))['id']))
      data['disciplineIds'] = [...new Set(ids)]
    }
    else if ('disciplineIds' in data) {
      data['disciplineIds'] = []
    }
    if (!isBlankImportValue(data['studentIds'])) {
      const ids: string[] = []
      for (const value of listText(data['studentIds']))
        ids.push(text((await this.reference('students', value, row))['id']))
      data['studentIds'] = [...new Set(ids)]
    }
  }
}
function primaryFields(type: ImportType): string[] {
  const secondary = type === 'students' ? [...annualStudent, 'classGroupId', 'enrolledAt'] : type === 'teachers' ? annualTeacher : type === 'guardians' ? [...relationshipFields, 'studentIds', 'completeContacts'] : []
  return IMPORT_TEMPLATES[type].columns.map(col => col.field).filter((field): field is string => Boolean(field && !secondary.includes(field)))
}
function project(type: ImportType, record: unknown): ImportRecord {
  const data = importJson(record)
  return defined(data, ['id', 'schoolId', 'academicYearId', ...primaryFields(type)])
}
async function matchTarget(ctx: ImportBusinessContext, row: ImportRow, data: ImportRecord) {
  const key = importResources[row.type]
  const explicit = text(row.values['target_id'])
  if (explicit)
    return ctx.readable(key, explicit)
  const saved = (await ctx.list(key)).find(entity => entity.id === row.targetId)
  if (saved)
    return ctx.readable(key, saved.id)
  const same = (a: unknown, b: unknown) => !isBlankImportValue(b) && normalizeImportKey(a) === normalizeImportKey(b)
  const sameYear = (record: ImportRecord) => record['academicYearId'] === ctx.batch.academicYearId
  return ctx.unique(key, (entity) => {
    const record = importJson(entity)
    switch (row.type) {
      case 'academic_disciplines':
      case 'placement_statuses':
      case 'teachers':
      case 'guardians':
      case 'staff': return same(record['code'], data['code'])
      case 'students': return same(record['matricule'], data['matricule'])
      case 'classes': return sameYear(record) && same(record['gradeLevelId'], data['gradeLevelId']) && same(record['name'], data['name'])
      case 'subjects': return sameYear(record) && same(record['gradeLevelId'], data['gradeLevelId']) && (data['code'] ? same(record['code'], data['code']) : same(record['name'], data['name']))
      case 'guardian_contacts': return same(entity.id, data['guardianId'])
      case 'guardian_relationships': return same(record['guardianId'], data['guardianId']) && same(record['studentId'], data['studentId'])
      case 'class_offerings': return same(record['classGroupId'], data['classGroupId']) && same(record['subjectId'], data['subjectId'])
      case 'teacher_assignments': return sameYear(record) && same(record['teacherId'], data['teacherId']) && record['kind'] === (data['kind'] ?? 'subject') && same(record['classSubjectId'] ?? record['classGroupId'], data['classSubjectId'] ?? data['classGroupId'])
      case 'chapters': return same(record['subjectId'], data['subjectId']) && record['sequenceOrder'] === data['sequenceOrder']
      case 'billing': return sameYear(record) && same(record['studentId'], data['studentId']) && same(record['catalogServiceId'], data['catalogServiceId']) && record['status'] === 'active'
      case 'payments': return sameYear(record) && same(record['reference'], data['reference'])
    }
  })
}
function instantiate(type: ImportType, data: ImportRecord) {
  // Constructors remain the authoritative domain shape and value validation.
  switch (type) {
    case 'academic_disciplines': return new AcademicDiscipline(data as unknown as ConstructorParameters<typeof AcademicDiscipline>[0])
    case 'placement_statuses': return new PlacementStatus(data as unknown as ConstructorParameters<typeof PlacementStatus>[0])
    case 'classes': return new ClassGroup(data as unknown as ConstructorParameters<typeof ClassGroup>[0])
    case 'subjects': return new Subject(data as unknown as ConstructorParameters<typeof Subject>[0])
    case 'students': return new Student(data as unknown as ConstructorParameters<typeof Student>[0])
    case 'guardians': return new Guardian(data as unknown as ConstructorParameters<typeof Guardian>[0])
    case 'teachers': return new Teacher(data as unknown as ConstructorParameters<typeof Teacher>[0])
    case 'staff': return new StaffMember(data as unknown as ConstructorParameters<typeof StaffMember>[0])
    case 'guardian_relationships': return new GuardianStudentLink(data as unknown as ConstructorParameters<typeof GuardianStudentLink>[0])
    case 'teacher_assignments': return new TeacherAssignment(data as unknown as ConstructorParameters<typeof TeacherAssignment>[0])
    case 'chapters': return new SubjectMatter(data as unknown as ConstructorParameters<typeof SubjectMatter>[0])
    default: return undefined
  }
}
export async function prepareImportRow(ctx: ImportBusinessContext, row: ImportRow): Promise<ImportRow> {
  const policy = new ImportAccessPolicy(ctx.base.access)
  await policy.assertType(row.type, true)
  row.dependencies = []
  const incoming = normalizeImportValues(row.type, row.values)
  if (typeof incoming['birthDate'] === 'string') {
    const age = (Date.now() - new Date(incoming['birthDate']).getTime()) / (365.2425 * 24 * 60 * 60 * 1000)
    if (age < 3 || age > 80)
      row.issues.push({ code: 'IMPORT_BIRTH_DATE_REVIEW', column: 'birth_date', severity: 'warning' })
  }
  if (row.generatedCode && isBlankImportValue(incoming['code']))
    incoming['code'] = row.generatedCode
  await ctx.resolveReferences(row, incoming)
  if (row.type === 'teacher_assignments' && incoming['kind'] !== 'homeroom') {
    const offering = await ctx.unique('classSubjects', entity => entity.classGroupId === incoming['classGroupId'] && entity.subjectId === incoming['subjectId'])
    if (offering)
      incoming['classSubjectId'] = offering.id
    else if (!row.dependencies.length)
      fail('IMPORT_OFFERING_NOT_FOUND')
    else
      incoming['classSubjectId'] = `pending:${incoming['classGroupId']}:${incoming['subjectId']}`
    incoming['kind'] ??= 'subject'
  }
  const existing = await matchTarget(ctx, row, incoming)
  if (existing)
    row.targetId = existing.id
  const existingData = existing ? importJson(existing) : {}
  // Projection excludes account ownership, credentials, audit identity and arbitrary internal fields.
  let current: ImportRecord | null = existing ? project(row.type, existing) : null
  if (row.type === 'guardians' && current)
    current['contactMethods'] = importJson(existing)['contactMethods'] ?? []
  if (row.type === 'staff' && existingData['accountKind'] !== undefined && existingData['accountKind'] !== 'human')
    fail('IMPORT_HUMAN_STAFF_REQUIRED')
  if (row.type === 'students' || row.type === 'teachers') {
    const annualKey = row.type === 'students' ? 'studentAcademicYearProfiles' : 'teacherAcademicYearProfiles'
    const personKey = row.type === 'students' ? 'studentId' : 'teacherId'
    const annual = await ctx.unique(annualKey, (entity) => {
      const data = importJson(entity)
      return data[personKey] === row.targetId && entity.academicYearId === ctx.batch.academicYearId
    })
    if (current && annual) {
      const annualData = importJson(annual)
      // Persisted optional fields and proposed nullable fields describe the same unknown value.
      for (const field of row.type === 'students' ? annualStudent : annualTeacher)
        current[field] = annualData[field] ?? null
    }
    if (row.type === 'students' && current) {
      const active = await ctx.unique('enrollments', enrollment => enrollment.studentId === row.targetId && enrollment.academicYearId === ctx.batch.academicYearId && enrollment.status === 'active')
      if (active) {
        current['enrollmentId'] = active.id
        current['classGroupId'] = active.classGroupId
        current['enrolledAt'] = active.enrolledAt.toISOString().slice(0, 10)
      }
    }
  }
  if (row.type === 'payments' && current) {
    current['amount'] = (existingData['amount'] as ImportRecord)?.['amount'] ?? existingData['amount']!
    current['paymentDate'] = text(existingData['paymentDate']).slice(0, 10)
    current['studentId'] = (await ctx.readable('studentYearAccounts', text(existingData['accountId']))).studentId
  }
  const nullable = new Set(IMPORT_TEMPLATES[row.type].columns.filter(col => col.nullable).map(col => col.field!))
  // New records do not inherit Skip, and blank optional cells mean absent at creation.
  const supplied = existing ? incoming : Object.fromEntries(Object.entries(incoming).filter(([, value]) => !isBlankImportValue(value)))
  let proposed = applyImportScalars(row.type === 'guardian_contacts' ? {} : current ?? { id: row.targetId, schoolId: ctx.batch.schoolId, academicYearId: ctx.batch.academicYearId }, supplied, row.type === 'guardian_contacts' ? 'M' : existing ? row.effectiveMode : 'M', nullable)
  if (row.type === 'academic_disciplines' || row.type === 'placement_statuses') {
    if (existing && normalizeImportKey(existingData['code']) !== normalizeImportKey(proposed['code']))
      fail('IMPORT_IMMUTABLE_CODE')
  }
  if (row.type === 'subjects' && !proposed['disciplineId'])
    fail('IMPORT_DISCIPLINE_REQUIRED')
  for (const [field, key] of [['disciplineId', 'academicDisciplines'], ['placementStatusId', 'placementStatuses']] as const) {
    if (proposed[field] && proposed[field] !== current?.[field]) {
      const entry = await ctx.reference(key, proposed[field], row)
      if (entry['isActive'] === false)
        fail('IMPORT_INACTIVE_REFERENCE')
    }
  }
  if (row.type === 'teachers' && 'disciplineIds' in supplied) {
    const previous = listText(current?.['disciplineIds'])
    const next = applyImportCollection(previous, listText(supplied['disciplineIds']), existing ? row.effectiveMode : 'M', true, value => value)
    for (const id of next.filter(id => !previous.includes(id))) {
      if ((await ctx.reference('academicDisciplines', id, row))['isActive'] === false)
        fail('IMPORT_INACTIVE_REFERENCE')
    }
    proposed['disciplineIds'] = next
  }
  if (row.type === 'teachers' && annualTeacher.some(field => field in incoming)) {
    const annual = new TeacherAcademicYearProfile({ ...defined(proposed, annualTeacher), id: `${row.targetId}:annual`, schoolId: ctx.batch.schoolId, teacherId: row.targetId, academicYearId: ctx.batch.academicYearId } as ConstructorParameters<typeof TeacherAcademicYearProfile>[0])
    const normalized = importJson(annual)
    for (const field of annualTeacher)
      proposed[field] = normalized[field] ?? null
  }
  if (row.type === 'students') {
    if (annualStudent.some(field => field in incoming)) {
      const annual = new StudentAcademicYearProfile({ ...defined(proposed, annualStudent), id: `${row.targetId}:annual`, schoolId: ctx.batch.schoolId, studentId: row.targetId, academicYearId: ctx.batch.academicYearId } as ConstructorParameters<typeof StudentAcademicYearProfile>[0])
      const normalized = importJson(annual)
      for (const field of annualStudent)
        proposed[field] = normalized[field] ?? null
    }
    if (proposed['classGroupId'] && proposed['classGroupId'] !== current?.['classGroupId']) {
      proposed['enrolledAt'] = incoming['enrolledAt'] ?? ctx.batch.enrollmentEffectiveDate
      if (!proposed['enrolledAt'])
        fail('IMPORT_ENROLLMENT_DATE_REQUIRED')
    }
    if ('classGroupId' in supplied && !proposed['classGroupId'] && current?.['classGroupId'])
      fail('IMPORT_ENROLLMENT_CLOSE_WORKFLOW_REQUIRED')
  }
  if (row.type === 'guardians') {
    // Empty first names are valid; missing/blank merge inputs still preserve existing names.
    proposed['firstName'] ??= ''
    const old = (current?.['contactMethods'] ?? []) as ImportRecord[]
    let contacts: ImportRecord[] | undefined
    if ('contactMethods' in supplied) {
      if (!Array.isArray(supplied['contactMethods']) && supplied['contactMethods'] !== null)
        fail('IMPORT_CONTACTS_INVALID')
      if (supplied['contactMethods'] !== null || row.effectiveMode === 'O')
        contacts = (supplied['contactMethods'] ?? []) as ImportRecord[]
    }
    for (const field of ['phone', 'email']) {
      if (!isBlankImportValue(supplied[field]))
        (contacts ??= []).push({ type: field, value: supplied[field]!, isPrimary: false, allowsNotifications: false })
    }
    if (contacts) {
      contacts = contacts.map((contact) => {
        const previous = old.find(item => contactKey(item) === contactKey(contact))
        const merged = applyImportScalars(previous ?? {}, contact, existing ? row.effectiveMode : 'M', new Set(['label']))
        return importJson(new GuardianContactMethod(merged as unknown as ConstructorParameters<typeof GuardianContactMethod>[0]))
      })
    }
    proposed['contactMethods'] = applyImportCollection(old, contacts, existing ? row.effectiveMode : 'M', supplied['completeContacts'] === true, contactKey)
    delete proposed['phone']
    delete proposed['email']
    if (!isBlankImportValue(incoming['studentIds'])) {
      const previousLinks: ImportRecord[] = []
      const nextLinks: ImportRecord[] = []
      for (const studentId of listText(incoming['studentIds']).sort()) {
        const previous = await ctx.unique('guardianLinks', link => link.guardianId === row.targetId && link.studentId === studentId)
        const before = previous ? defined(importJson(previous), ['id', 'schoolId', 'guardianId', 'studentId', ...relationshipFields]) : null
        if (before)
          previousLinks.push(before)
        if (existing && row.effectiveMode === 'S') {
          if (before)
            nextLinks.push(before)
          continue
        }
        const relation = applyImportScalars(before ?? { id: `${row.id}:${studentId}`, schoolId: ctx.batch.schoolId, guardianId: row.targetId, studentId }, defined(incoming, relationshipFields), previous ? row.effectiveMode : 'M', new Set(['emergencyContactPriority', 'contactRestrictions', 'notes']))
        const link = new GuardianStudentLink(relation as unknown as ConstructorParameters<typeof GuardianStudentLink>[0])
        if (!row.dependencies.length && existing)
          await ctx.base.access.entity('guardianLinks').assertSave(link, previous)
        nextLinks.push(defined(importJson(link), ['id', 'schoolId', 'guardianId', 'studentId', ...relationshipFields]))
      }
      if (current)
        current['studentRelationships'] = previousLinks
      proposed['studentRelationships'] = nextLinks
    }
  }
  if (row.type === 'guardian_contacts') {
    const owner = existing ? existingData : await ctx.reference('guardians', incoming['guardianId'], row)
    row.targetId = text(owner['id'])
    const old = (owner['contactMethods'] ?? []) as ImportRecord[]
    const previous = old.find(item => contactKey(item) === contactKey(incoming))
    const contactData = applyImportScalars(previous ?? {}, defined(incoming, ['type', 'value', 'label', 'isPrimary', 'allowsNotifications']), previous ? row.effectiveMode : 'M', new Set(['label']))
    const contact = importJson(new GuardianContactMethod(contactData as unknown as ConstructorParameters<typeof GuardianContactMethod>[0]))
    current = previous ? { ...previous, guardianId: row.targetId } : null
    proposed = { ...contact, guardianId: row.targetId }
    if (incoming['completeCollection'] === true)
      proposed['completeCollection'] = true
  }
  if (row.type === 'class_offerings') {
    if (!existing && !row.dependencies.length)
      fail('IMPORT_OFFERING_NOT_FOUND')
    if (typeof proposed['isOffered'] !== 'boolean')
      fail('IMPORT_IS_OFFERED_REQUIRED')
  }
  if (row.type === 'billing') {
    const catalog = await ctx.reference('catalogServices', incoming['catalogServiceId'] ?? current?.['catalogServiceId'], row, data => data['academicYearId'] === ctx.batch.academicYearId)
    if (!existing && catalog['status'] !== 'active')
      fail('IMPORT_INACTIVE_REFERENCE')
    const price = (catalog['defaultPrice'] as ImportRecord)?.['amount'] ?? catalog['defaultPrice']
    if (current) {
      current['acceptedTerms'] = existingData['acceptedTerms']!
      proposed['acceptedTerms'] = existingData['acceptedTerms']!
      if (row.effectiveMode !== 'S' && supplied['priceOverride'] !== undefined && supplied['priceOverride'] !== null && supplied['priceOverride'] !== (existingData['acceptedTerms'] as ImportRecord)?.['price'])
        fail('IMPORT_FINANCIAL_ADJUSTMENT_REQUIRED')
      const charges = (await ctx.list('studentCharges')).filter(charge => charge.enrollmentId === row.targetId)
      if (row.effectiveMode !== 'S' && 'dueDate' in supplied && (!isBlankImportValue(supplied['dueDate']) || row.effectiveMode === 'O') && charges.some(charge => (charge.dueDate?.toISOString().slice(0, 10) ?? null) !== supplied['dueDate']))
        fail('IMPORT_FINANCIAL_ADJUSTMENT_REQUIRED')
      proposed = { ...current }
    }
    else {
      proposed['acceptedTerms'] = importJson(acceptedCatalogTerms(await ctx.readable('catalogServices', text(catalog['id'])), typeof proposed['priceOverride'] === 'number' ? proposed['priceOverride'] : undefined))
      const amount = proposed['priceOverride'] ?? price
      if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0)
        fail('IMPORT_AMOUNT_INVALID')
    }
  }
  if (row.type === 'payments') {
    if (!proposed['reference'] || typeof proposed['amount'] !== 'number' || !Number.isInteger(proposed['amount']) || proposed['amount'] <= 0 || !proposed['paymentDate'] || !Object.values(PaymentMethod).includes(proposed['method'] as PaymentMethod))
      fail('IMPORT_PAYMENT_FIELDS_REQUIRED')
    if (current) {
      current['amount'] = (existingData['amount'] as ImportRecord)?.['amount'] ?? existingData['amount']!
      current['paymentDate'] = text(existingData['paymentDate']).slice(0, 10)
      const account = await ctx.readable('studentYearAccounts', text(existingData['accountId']))
      current['studentId'] = account.studentId
      if (row.effectiveMode !== 'S' && ['studentId', 'amount', 'paymentDate', 'method', 'reference', 'notes'].some(field => field in supplied && (!isBlankImportValue(supplied[field]) || row.effectiveMode === 'O') && (proposed[field] ?? null) !== (current![field] ?? null)))
        fail('IMPORT_FINANCIAL_REVERSAL_REQUIRED')
      if (row.effectiveMode !== 'S' && !isBlankImportValue(supplied['catalogServiceId'])) {
        const settlements = (await ctx.service.financeWorkflow.getAccountStatement({ accountId: account.id })).allocations.filter(allocation => allocation.causedByPaymentId === row.targetId && allocation.kind === 'settle')
        const catalogIds = new Set<string>()
        for (const settlement of settlements) {
          const charge = await ctx.readable('studentCharges', settlement.chargeId)
          const enrollment = await ctx.readable('studentServiceEnrollments', charge.enrollmentId)
          catalogIds.add(enrollment.catalogServiceId)
        }
        if (catalogIds.size !== 1 || !catalogIds.has(text(supplied['catalogServiceId'])))
          fail('IMPORT_FINANCIAL_REVERSAL_REQUIRED')
      }
      proposed = { ...current }
    }
    else if (proposed['catalogServiceId']) {
      const billing = ctx.rows.filter(parent => parent.type === 'billing' && parent.proposed?.['studentId'] === proposed['studentId'] && parent.proposed?.['catalogServiceId'] === proposed['catalogServiceId'])
      for (const parent of billing) {
        row.dependencies.push(parent.id)
        if (parent.outcome === 'blocked' || parent.outcome === 'dependency_blocked')
          fail('IMPORT_DEPENDENCY_BLOCKED')
      }
      if (!billing.length && !await ctx.unique('studentServiceEnrollments', enrollment => enrollment.studentId === proposed['studentId'] && enrollment.catalogServiceId === proposed['catalogServiceId'] && enrollment.academicYearId === ctx.batch.academicYearId && enrollment.status === 'active'))
        fail('IMPORT_BILLING_REQUIRED')
    }
  }
  const entity = instantiate(row.type, proposed)
  if (entity) {
    const normalized = project(row.type, entity)
    proposed = { ...proposed, ...normalized }
    // New dependencies do not exist yet: their writes are authorized again after prerequisite commits.
    if (!row.dependencies.length)
      await ctx.base.access.entity(importResources[row.type]).assertSave(entity as CoreEntityMap[CoreEntityKey], existing)
  }
  row.dependencies = [...new Set(row.dependencies)]
  row.current = current
  row.proposed = proposed
  row.expectedDigest = await digestCommandRequest(current)
  row.outcome = 'pending'
  return row
}
/** Executes only this closed set of named school workflows and authorized entity commands. */
export async function executeImportRow(ctx: ImportBusinessContext, row: ImportRow): Promise<ImportRecord> {
  const service = ctx.service
  const base = ctx.base
  const data = row.proposed!
  const id = row.targetId
  const fields = defined(data, primaryFields(row.type))
  const schoolId = ctx.batch.schoolId
  const academicYearId = ctx.batch.academicYearId
  const result: ImportRecord = { targetId: id }
  if (row.current && row.effectiveMode === 'S')
    return result
  switch (row.type) {
    case 'academic_disciplines':
      await service.academicsWorkflow.configureAcademicDiscipline(new AcademicDiscipline({ ...data, id, schoolId } as ConstructorParameters<typeof AcademicDiscipline>[0]).data)
      break
    case 'placement_statuses':
      await service.academicsWorkflow.configurePlacementStatus(new PlacementStatus({ ...data, id, schoolId } as ConstructorParameters<typeof PlacementStatus>[0]).data)
      break
    case 'classes': {
      const entity = new ClassGroup({ ...data, id, schoolId, academicYearId } as ConstructorParameters<typeof ClassGroup>[0])
      if (row.current)
        await service.setupWorkflow.updateClassGroupConfiguration({ ...fields, classGroupId: id } as Parameters<typeof service.setupWorkflow.updateClassGroupConfiguration>[0])
      else
        await service.setupWorkflow.createClassGroup(entity.data)
      break
    }
    case 'subjects': {
      const entity = new Subject({ ...data, id, schoolId, academicYearId } as ConstructorParameters<typeof Subject>[0])
      if (row.current)
        await service.academicsWorkflow.updateSubject({ ...fields, subjectId: id } as Parameters<typeof service.academicsWorkflow.updateSubject>[0])
      else
        await service.academicsWorkflow.configureSubject(entity.data)
      break
    }
    case 'students': {
      if (row.current) {
        await service.studentWorkflow.updateStudentProfile({ ...fields, studentId: id } as Parameters<typeof service.studentWorkflow.updateStudentProfile>[0])
      }
      else {
        await service.studentWorkflow.registerStudent({ ...new Student({ ...data, id, schoolId } as ConstructorParameters<typeof Student>[0]).data, sendAccountInvitation: false })
        result['studentsRegistered'] = 1
      }
      if (annualStudent.some(field => field in data)) {
        await service.academicsWorkflow.upsertStudentAcademicYearProfile({ ...defined(data, annualStudent), studentId: id, academicYearId } as Parameters<typeof service.academicsWorkflow.upsertStudentAcademicYearProfile>[0])
        result['annualProfilesSaved'] = 1
      }
      if (data['classGroupId'] && data['classGroupId'] !== row.current?.['classGroupId']) {
        if (row.current?.['enrollmentId']) {
          await service.studentWorkflow.transferStudent({ enrollmentId: text(row.current['enrollmentId']), nextEnrollmentId: `${row.operationId}:enrollment`, nextClassGroupId: text(data['classGroupId']), effectiveAt: new Date(`${data['enrolledAt']}T00:00:00.000Z`) })
          result['studentsTransferred'] = 1
        }
        else {
          await service.studentWorkflow.enrollStudent({ id: `${row.operationId}:enrollment`, studentId: id, classGroupId: text(data['classGroupId']), enrolledAt: new Date(`${data['enrolledAt']}T00:00:00.000Z`) })
        }
        result['studentsEnrolled'] = 1
      }
      break
    }
    case 'teachers': {
      if (row.current) {
        const current = await ctx.readable('teachers', id)
        await base.entities.teachers.save(new Teacher({ ...current.data, ...fields } as ConstructorParameters<typeof Teacher>[0]))
      }
      else {
        await service.setupWorkflow.registerTeacher(new Teacher({ ...data, id, schoolId } as ConstructorParameters<typeof Teacher>[0]).data)
      }
      if (annualTeacher.some(field => field in data)) {
        await service.academicsWorkflow.upsertTeacherAcademicYearProfile({ ...defined(data, annualTeacher), teacherId: id, academicYearId } as Parameters<typeof service.academicsWorkflow.upsertTeacherAcademicYearProfile>[0])
        result['annualProfilesSaved'] = 1
      }
      break
    }
    case 'staff': {
      if (row.current) {
        await service.setupWorkflow.updateStaffMemberProfile({ ...fields, staffId: id } as Parameters<typeof service.setupWorkflow.updateStaffMemberProfile>[0])
        if (typeof data['isActive'] === 'boolean')
          await service.setupWorkflow.updateStaffMemberStatus({ staffId: id, isActive: data['isActive'] })
      }
      else {
        await service.setupWorkflow.registerStaffMember({ ...new StaffMember({ ...data, id, schoolId, accountKind: 'human' } as ConstructorParameters<typeof StaffMember>[0]).data, sendAccountInvitation: false })
      }
      break
    }
    case 'guardians': {
      if (row.current)
        await service.studentWorkflow.updateGuardianContactMethods({ ...fields, guardianId: id, contactMethods: data['contactMethods'] } as Parameters<typeof service.studentWorkflow.updateGuardianContactMethods>[0])
      else
        await service.studentWorkflow.registerGuardian({ ...data, id, schoolId, hasAccess: false, sendAccountInvitation: false } as Parameters<typeof service.studentWorkflow.registerGuardian>[0])
      for (const relation of (data['studentRelationships'] ?? []) as ImportRecord[]) {
        const studentId = text(relation['studentId'])
        const previous = await ctx.unique('guardianLinks', link => link.guardianId === id && link.studentId === studentId)
        if (previous) {
          await service.studentWorkflow.updateGuardianStudentLink({ ...relation, guardianId: id, studentId } as Parameters<typeof service.studentWorkflow.updateGuardianStudentLink>[0])
        }
        else {
          await service.studentWorkflow.linkGuardianToStudent({ ...relation, guardianId: id, studentId } as Parameters<typeof service.studentWorkflow.linkGuardianToStudent>[0])
          result['guardianLinksCreated'] = Number(result['guardianLinksCreated'] ?? 0) + 1
        }
      }
      break
    }
    case 'guardian_contacts': {
      const guardian = await ctx.readable('guardians', text(data['guardianId']))
      const contacts = applyImportCollection(importJson(guardian)['contactMethods'] as ImportRecord[], [defined(data, ['type', 'value', 'label', 'isPrimary', 'allowsNotifications'])], row.current ? row.effectiveMode : 'M', false, contactKey)
      await service.studentWorkflow.updateGuardianContactMethods({ guardianId: guardian.id, contactMethods: contacts } as Parameters<typeof service.studentWorkflow.updateGuardianContactMethods>[0])
      break
    }
    case 'guardian_relationships':
      if (row.current) {
        await service.studentWorkflow.updateGuardianStudentLink({ ...fields, guardianId: text(data['guardianId']), studentId: text(data['studentId']) } as Parameters<typeof service.studentWorkflow.updateGuardianStudentLink>[0])
      }
      else {
        await service.studentWorkflow.linkGuardianToStudent(new GuardianStudentLink({ ...data, id, schoolId } as ConstructorParameters<typeof GuardianStudentLink>[0]).data)
        result['guardianLinksCreated'] = 1
      }
      break
    case 'class_offerings': {
      const offering = await ctx.unique('classSubjects', entity => entity.classGroupId === data['classGroupId'] && entity.subjectId === data['subjectId'])
      if (!offering)
        fail('IMPORT_OFFERING_NOT_FOUND')
      await service.academicsWorkflow.setClassSubjectOffered({ classSubjectId: offering.id, isOffered: data['isOffered'] as boolean })
      result['targetId'] = offering.id
      break
    }
    case 'teacher_assignments': {
      const prior = row.current ? (await ctx.readable('teacherAssignments', id)).data : {}
      await base.entities.teacherAssignments.save(new TeacherAssignment({ ...prior, ...fields, id, academicYearId, classSubjectId: data['classSubjectId'] } as ConstructorParameters<typeof TeacherAssignment>[0]))
      break
    }
    case 'chapters': {
      const prior = row.current ? (await ctx.readable('subjectMatters', id)).data : {}
      await service.academicsWorkflow.configureSubjectMatter(new SubjectMatter({ ...prior, ...fields, id } as ConstructorParameters<typeof SubjectMatter>[0]).data)
      break
    }
    case 'billing':
      if (!row.current) {
        await service.financeWorkflow.enrollStudentInService({ id, studentId: text(data['studentId']), catalogServiceId: text(data['catalogServiceId']), ...(typeof data['priceOverride'] === 'number' ? { priceOverride: data['priceOverride'] } : {}), ...(data['dueDate'] ? { dueDate: new Date(`${data['dueDate']}T00:00:00.000Z`) } : {}) })
        result['billingEnrollmentsCreated'] = 1
      }
      break
    case 'payments':
      if (!row.current) {
        let allocation: Parameters<typeof service.financeWorkflow.recordPayment>[0]['allocation'] = { mode: 'account_only' }
        if (data['catalogServiceId']) {
          const enrollment = await ctx.unique('studentServiceEnrollments', entity => entity.studentId === data['studentId'] && entity.catalogServiceId === data['catalogServiceId'] && entity.academicYearId === academicYearId && entity.status === 'active')
          if (!enrollment)
            fail('IMPORT_BILLING_REQUIRED')
          const charge = await ctx.unique('studentCharges', entity => entity.enrollmentId === enrollment.id)
          if (!charge)
            fail('IMPORT_CHARGE_REQUIRED')
          allocation = { mode: 'targeted', targets: [{ chargeId: charge.id, amount: data['amount'] as number }] }
        }
        await service.financeWorkflow.recordPayment({ id, studentId: text(data['studentId']), academicYearId, amount: data['amount'] as number, paymentDate: new Date(`${data['paymentDate']}T00:00:00.000Z`), method: data['method'] as PaymentMethod, reference: text(data['reference']), notes: text(data['notes']) || undefined, allocation })
        result['paymentsPosted'] = 1
      }
      break
  }
  return result
}
/** Reject every requested net-new placement in an over-capacity class, rather than choosing winners by row order. */
export async function validateImportCapacity(ctx: ImportBusinessContext, rows: ImportRow[]): Promise<void> {
  const byClass = new Map<string, ImportRow[]>()
  for (const row of rows) {
    if (row.type !== 'students' || row.outcome !== 'pending' || !row.proposed?.['classGroupId'] || row.current?.['classGroupId'] === row.proposed['classGroupId'] || (row.current && row.effectiveMode === 'S'))
      continue
    const id = text(row.proposed['classGroupId'])
    byClass.set(id, [...byClass.get(id) ?? [], row])
  }
  const enrollments = byClass.size ? await ctx.list('enrollments') : []
  for (const [id, requested] of byClass) {
    let group: ImportRecord
    try {
      group = await ctx.reference('classGroups', id, requested[0]!)
    }
    catch (error) {
      if (!(error instanceof ImportBusinessIssue))
        throw error
      for (const row of requested) {
        row.outcome = error.code === 'IMPORT_DEPENDENCY_BLOCKED' ? 'dependency_blocked' : 'blocked'
        row.issues.push({ code: error.code, column: 'class', severity: 'error' })
      }
      continue
    }
    const capacity = group['capacity']
    if (typeof capacity !== 'number')
      continue
    const existing = new Set(enrollments.filter(entity => entity.classGroupId === id && entity.status === 'active').map(entity => entity.studentId))
    const added = new Set(requested.filter(row => !existing.has(row.targetId)).map(row => row.targetId))
    if (existing.size + added.size > capacity) {
      for (const row of requested) {
        row.outcome = 'blocked'
        row.issues.push({ code: 'IMPORT_CLASS_CAPACITY_CONFLICT', column: 'class', severity: 'error' })
      }
    }
  }
}
