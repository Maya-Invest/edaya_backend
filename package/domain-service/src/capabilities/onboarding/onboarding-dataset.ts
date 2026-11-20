import { gradeScaleSchema, shortNameSchema } from '@edaya/core'
import { z } from 'zod'

const text = z.string().trim().min(1)
const order = z.number().int().positive()
const catalogEntry = z.object({ code: text, name: text }).strict()
const subject = z.object({
  code: text,
  name: text,
  shortName: shortNameSchema,
  disciplineCode: text,
  categoryCode: text,
  coefficient: z.number().finite().positive(),
  isOptional: z.boolean(),
  chapters: z.array(z.object({ code: text, title: text, order }).strict()),
  reportModuleCode: text.optional(),
  reportOrder: z.number().int().nonnegative(),
}).strict()
const moduleSchema = z.object({
  code: text,
  name: text,
  order,
  weightingMode: z.enum(['subject_coefficients', 'explicit']),
  explicitWeight: z.number().finite().positive().optional(),
}).strict().refine(value => (value.weightingMode === 'explicit') === (value.explicitWeight !== undefined), 'Explicit weighting requires a weight; coefficient weighting must not have one')
const level = z.object({
  id: text,
  code: text,
  name: text,
  shortLabel: text,
  order,
  examYear: z.boolean().optional(),
  examName: text.optional(),
  subjects: z.array(subject).min(1),
  reportModules: z.array(moduleSchema),
  gradingPolicy: z.object({ gradeScaleCode: text, mode: z.enum(['numeric-first', 'mention-first']), aggregateLabel: text, passThreshold: z.number().finite().nonnegative() }).strict(),
}).strict()
export const onboardingGradeLevelSchema = level
export const onboardingTemplateManifestSchema = z.object({
  id: text,
  label: text,
  description: text,
  cycle: text,
  calendarProfileCode: text,
  reportPresentation: z.object({ includeSummary: z.boolean(), includeComments: z.boolean() }).strict(),
  gradeLevels: z.array(z.object({ file: text }).strict()).min(1),
}).strict()
const scale = z.object({
  code: text,
  name: text,
  minScore: z.literal(0),
  maxScore: z.number().finite().positive(),
  decimalPlaces: z.number().int().min(0).max(3),
  roundingMode: z.enum(['nearest', 'truncate']),
  intervalConvention: z.literal('continuous'),
  ranges: z.array(z.object({ code: text, minScore: z.number().finite(), maxScore: z.number().finite(), label: text, points: z.number().finite().nonnegative().optional() }).strict()).min(1),
}).strict().superRefine((value, ctx) => {
  const parsed = gradeScaleSchema.safeParse({ ...value, id: value.code, schoolId: 'dataset', ranges: value.ranges.map(range => ({ id: range.code, letter: range.code, minScore: range.minScore, maxScore: range.maxScore, interpretation: range.label, gpaValue: range.points })) })
  if (!parsed.success) {
    for (const issue of parsed.error.issues) ctx.addIssue({ ...issue, path: issue.path })
  }
})
const envelope = {
  id: text,
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  schemaVersion: z.literal(1),
  countryCode: z.enum(['CI', 'FR']),
  disciplines: z.array(catalogEntry).min(1),
  subjectCategories: z.array(catalogEntry).min(1),
  gradeScales: z.array(scale).min(1),
  calendarProfiles: z.array(z.object({ code: text, periodType: z.enum(['trimester', 'semester']), periods: z.array(z.object({ code: text, name: text, weight: z.number().finite().positive() }).strict()).min(1) }).strict()).min(1),
}
export const onboardingDatasetManifestSchema = z.object({ ...envelope, templates: z.array(onboardingTemplateManifestSchema).min(1) }).strict()
export const onboardingDatasetSchema = z.object({ ...envelope, templates: z.array(onboardingTemplateManifestSchema.omit({ gradeLevels: true }).extend({ gradeLevels: z.array(level).min(1) })).min(1) }).strict().superRefine((data, ctx) => {
  const fail = (path: (string | number)[], message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message })
  const unique = (rows: { code?: string, id?: string }[], path: (string | number)[], key: 'code' | 'id' = 'code') => {
    const seen = new Set<string>()
    rows.forEach((row, index) => {
      const value = row[key]!
      if (seen.has(value.toUpperCase()))
        fail([...path, index, key], `Duplicate ${key}: ${value}`)
      seen.add(value.toUpperCase())
    })
  }
  for (const key of ['disciplines', 'subjectCategories', 'gradeScales', 'calendarProfiles'] as const) unique(data[key], [key])
  unique(data.templates, ['templates'], 'id')
  const allLevels = new Set<string>()
  data.calendarProfiles.forEach((profile, i) => unique(profile.periods, ['calendarProfiles', i, 'periods']))
  data.templates.forEach((template, ti) => {
    const tp = ['templates', ti]
    if (!data.calendarProfiles.some(row => row.code === template.calendarProfileCode))
      fail([...tp, 'calendarProfileCode'], 'Unknown calendar profile')
    unique(template.gradeLevels, [...tp, 'gradeLevels'])
    const levelOrders = new Set<number>()
    template.gradeLevels.forEach((grade, gi) => {
      const gp = [...tp, 'gradeLevels', gi]
      if (allLevels.has(grade.id))
        fail([...gp, 'id'], `Duplicate level ID: ${grade.id}`)
      allLevels.add(grade.id)
      if (grade.id !== `${template.id}:${grade.code}`)
        fail([...gp, 'id'], 'Level identity must match template:code')
      if (levelOrders.has(grade.order))
        fail([...gp, 'order'], 'Duplicate level order')
      levelOrders.add(grade.order)
      unique(grade.subjects, [...gp, 'subjects'])
      unique(grade.reportModules, [...gp, 'reportModules'])
      const moduleOrders = new Set<number>()
      grade.reportModules.forEach((row, i) => {
        if (moduleOrders.has(row.order))
          fail([...gp, 'reportModules', i, 'order'], 'Duplicate module order')
        moduleOrders.add(row.order)
      })
      const gradingScale = data.gradeScales.find(row => row.code === grade.gradingPolicy.gradeScaleCode)
      if (!gradingScale) {
        fail([...gp, 'gradingPolicy'], 'Unknown grade scale')
      }
      else {
        if (grade.gradingPolicy.passThreshold > gradingScale.maxScore)
          fail([...gp, 'gradingPolicy', 'passThreshold'], 'Passing threshold exceeds scale')
        if (grade.gradingPolicy.mode === 'mention-first' && gradingScale.ranges.some(row => row.points === undefined))
          fail([...gp, 'gradingPolicy'], 'Mention-first grading requires points on every range')
      }
      const reportOrders = new Set<string>()
      grade.subjects.forEach((row, si) => {
        const sp = [...gp, 'subjects', si]
        if (!data.disciplines.some(item => item.code === row.disciplineCode))
          fail([...sp, 'disciplineCode'], 'Unknown discipline')
        if (!data.subjectCategories.some(item => item.code === row.categoryCode))
          fail([...sp, 'categoryCode'], 'Unknown category')
        if (row.reportModuleCode && !grade.reportModules.some(item => item.code === row.reportModuleCode))
          fail([...sp, 'reportModuleCode'], 'Unknown module in this level')
        const key = `${row.reportModuleCode ?? ''}:${row.reportOrder}`
        if (reportOrders.has(key))
          fail([...sp, 'reportOrder'], 'Duplicate subject report order in group')
        reportOrders.add(key)
        unique(row.chapters, [...sp, 'chapters'])
        const orders = new Set<number>()
        row.chapters.forEach((chapter, ci) => {
          if (orders.has(chapter.order))
            fail([...sp, 'chapters', ci, 'order'], 'Duplicate chapter order')
          orders.add(chapter.order)
        })
      })
    })
  })
})
export type OnboardingDataset = z.infer<typeof onboardingDatasetSchema>
export type OnboardingDatasetGradeLevel = z.infer<typeof onboardingGradeLevelSchema>
