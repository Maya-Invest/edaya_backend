#!/usr/bin/env bun
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../apps/webapp/src/lib/components/school')

const moves: Record<string, string> = {
  'drawer-types.ts': 'shared',
  'drawer-constants.ts': 'shared',
  'DetailDrawer.svelte': 'shared',
  'DrawerActionBar.svelte': 'shared',
  'DrawerEmptyState.svelte': 'shared',
  'DrawerField.svelte': 'shared',
  'ScopeChipSelector.svelte': 'shared',
  'StudentAvatar.svelte': 'shared',
  'SchoolStudentsView.svelte': 'students',
  'StudentsView.svelte': 'students',
  'StudentTabs.svelte': 'students',
  'StudentProfileEditModal.svelte': 'students',
  'StudentReportCardPanel.svelte': 'students',
  'StudentGradeEntryModal.svelte': 'students',
  'StudentGuardianLinkModal.svelte': 'students',
  'StudentIncidentModal.svelte': 'students',
  'StudentNoteModal.svelte': 'students',
  'StudentAbsenceModal.svelte': 'students',
  'ChangeClassButton.svelte': 'students',
  'GuardiansView.svelte': 'guardians',
  'GuardianDetail.svelte': 'guardians',
  'GuardianForm.svelte': 'guardians',
  'GuardianEditModal.svelte': 'guardians',
  'HomeworkView.svelte': 'academics',
  'EvaluationsView.svelte': 'academics',
  'EvaluationForm.svelte': 'academics',
  'SubjectsView.svelte': 'academics',
  'SubjectForm.svelte': 'academics',
  'SubjectGroup.svelte': 'academics',
  'SubjectChaptersRow.svelte': 'academics',
  'ClassGroupsView.svelte': 'academics',
  'ClassReportCardsView.svelte': 'academics',
  'TeachingLogView.svelte': 'academics',
  'ConfigSubjectsView.svelte': 'academics',
  'LevelDetail.svelte': 'academics',
  'DeadlineDetail.svelte': 'academics',
  'PlanningView.svelte': 'scheduling',
  'PlanningForm.svelte': 'scheduling',
  'AttendanceFlow.svelte': 'scheduling',
  'SchoolCalendarView.svelte': 'scheduling',
  'ResourcesView.svelte': 'scheduling',
  'FinanceView.svelte': 'finance',
  'PaymentsView.svelte': 'finance',
  'BillingDetail.svelte': 'finance',
  'FeeForm.svelte': 'finance',
  'AcademicAdminView.svelte': 'configuration',
  'GradeScalesView.svelte': 'configuration',
  'RolesMatrixView.svelte': 'configuration',
  'RoleDetail.svelte': 'configuration',
  'PeopleView.svelte': 'configuration',
  'StaffForm.svelte': 'configuration',
  'StaffPermissionsBlock.svelte': 'configuration',
  'ReportCardDefinitionsView.svelte': 'configuration',
  'ReportCardDefinitionDetail.svelte': 'configuration',
  'ReportCardResultDetail.svelte': 'configuration',
  'ActivitiesView.svelte': 'school-life',
  'ActivityDetail.svelte': 'school-life',
  'SchoolEventsView.svelte': 'school-life',
  'SchoolYearEventForm.svelte': 'school-life',
  'IncidentDetail.svelte': 'school-life',
  'EducatorDashboardView.svelte': 'school-life',
}

const fileToFolder = new Map<string, string>()
for (const [file, folder] of Object.entries(moves)) {
  fileToFolder.set(file, folder)
}

for (const folder of new Set(Object.values(moves))) {
  mkdirSync(join(root, folder), { recursive: true })
}

for (const [file, folder] of Object.entries(moves)) {
  const from = join(root, file)
  const to = join(root, folder, file)
  renameSync(from, to)
}

function relativeImportPath(fromFolder: string, targetFile: string): string {
  const targetFolder = fileToFolder.get(targetFile) ?? fromFolder
  if (fromFolder === targetFolder) {
    return `./${targetFile}`
  }
  return `../${targetFolder}/${targetFile}`
}

function rewriteSchoolFile(path: string, folder: string) {
  let content = readFileSync(path, 'utf8')

  content = content.replaceAll(
    /from '\.\/(drawer-types)'/g,
    `from '${relativeImportPath(folder, 'drawer-types.ts')}'`,
  )
  content = content.replaceAll(
    /from '\.\/(drawer-constants)'/g,
    `from '${relativeImportPath(folder, 'drawer-constants.ts')}'`,
  )

  for (const [file] of Object.entries(moves)) {
    const svelteTarget = file.endsWith('.svelte') ? file : null
    const tsTarget = file.endsWith('.ts') ? file : null

    if (svelteTarget) {
      const pattern = new RegExp(`from '\\./${svelteTarget.replace('.', '\\.')}'`, 'g')
      content = content.replace(pattern, `from '${relativeImportPath(folder, svelteTarget)}'`)
    }

    if (tsTarget) {
      const pattern = new RegExp(`from '\\./${tsTarget.replace('.', '\\.')}'`, 'g')
      content = content.replace(pattern, `from '${relativeImportPath(folder, tsTarget)}'`)
    }
  }

  writeFileSync(path, content)
}

for (const folder of readdirSync(root, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue
  const folderPath = join(root, folder.name)
  for (const entry of readdirSync(folderPath, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (!/\.(svelte|ts)$/.test(entry.name)) continue
    rewriteSchoolFile(join(folderPath, entry.name), folder.name)
  }
}

const webappRoot = join(import.meta.dirname, '../apps/webapp')
function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.svelte-kit') continue
      files.push(...walk(full))
      continue
    }
    if (/\.(svelte|ts)$/.test(entry.name)) files.push(full)
  }
  return files
}

for (const file of walk(webappRoot)) {
  let content = readFileSync(file, 'utf8')
  let changed = false

  for (const [name, folder] of Object.entries(moves)) {
    const base = name.replace(/\.(svelte|ts)$/, '')
    const ext = name.endsWith('.svelte') ? '.svelte' : ''
    const tsExt = name.endsWith('.ts') ? '' : ''

    const svelteFrom = `$lib/components/school/${base}${ext || '.svelte'}`
    const svelteTo = `$lib/components/school/${folder}/${base}${ext || '.svelte'}`
    if (content.includes(svelteFrom)) {
      content = content.replaceAll(svelteFrom, svelteTo)
      changed = true
    }

    if (name.endsWith('.ts')) {
      const tsFrom = `$lib/components/school/${name}`
      const tsTo = `$lib/components/school/${folder}/${name}`
      if (content.includes(tsFrom)) {
        content = content.replaceAll(tsFrom, tsTo)
        changed = true
      }
    }
  }

  if (changed) writeFileSync(file, content)
}

console.log('Reorganized school components into domain folders.')
