import type { XlsxRenderer, XlsxRenderInput } from '../ports/xlsx-renderer.ts'
import ExcelJS from 'exceljs'

interface SubjectRow {
  readonly name?: unknown
  readonly kind?: unknown
  readonly average?: unknown
  readonly coefficient?: unknown
  readonly total?: unknown
  readonly rank?: unknown
  readonly appreciation?: unknown
  readonly teacherName?: unknown
}

interface DistributionRow {
  readonly label?: unknown
  readonly count?: unknown
}

interface ReportCardPayload {
  readonly studentName?: unknown
  readonly periodLabel?: unknown
  readonly schoolName?: unknown
  readonly schoolYear?: unknown
  readonly classLabel?: unknown
  readonly matricule?: unknown
  readonly semesterAverage?: unknown
  readonly semesterRank?: unknown
  readonly subjects?: unknown
  readonly classResults?: unknown
  readonly council?: unknown
}

function asPayload(value: unknown): ReportCardPayload {
  if (typeof value === 'object' && value !== null)
    return value as ReportCardPayload
  return {}
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function createExcelJsXlsxRenderer(): XlsxRenderer {
  return {
    async render(input: XlsxRenderInput): Promise<Uint8Array> {
      if (input.templateKey !== 'report-card.v1')
        throw new Error(`No Excel template for ${input.templateKey}`)

      const payload = asPayload(input.payload)
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Edaya Docs'
      workbook.created = new Date()

      const meta = workbook.addWorksheet('Meta', {
        views: [{ state: 'frozen', ySplit: 1 }],
      })
      meta.columns = [
        { header: 'Field', key: 'field', width: 28 },
        { header: 'Value', key: 'value', width: 48 },
      ]
      meta.addRow({ field: 'School', value: text(payload.schoolName, 'Edaya School') })
      meta.addRow({ field: 'School year', value: text(payload.schoolYear) })
      meta.addRow({ field: 'Period', value: text(payload.periodLabel) })
      meta.addRow({ field: 'Student', value: text(payload.studentName) })
      meta.addRow({ field: 'Student ID', value: text(payload.matricule) })
      meta.addRow({ field: 'Class', value: text(payload.classLabel) })
      meta.addRow({ field: 'Semester average', value: text(payload.semesterAverage) })
      meta.addRow({ field: 'Semester rank', value: text(payload.semesterRank) })

      const grades = workbook.addWorksheet('Grades', {
        views: [{ state: 'frozen', ySplit: 1 }],
      })
      grades.columns = [
        { header: 'Discipline', key: 'name', width: 28 },
        { header: 'Kind', key: 'kind', width: 10 },
        { header: 'Average', key: 'average', width: 12 },
        { header: 'Coef', key: 'coefficient', width: 8 },
        { header: 'Total', key: 'total', width: 12 },
        { header: 'Rank', key: 'rank', width: 14 },
        { header: 'Appreciation', key: 'appreciation', width: 16 },
        { header: 'Teacher', key: 'teacherName', width: 22 },
      ]

      const subjects = Array.isArray(payload.subjects) ? payload.subjects as SubjectRow[] : []
      for (const row of subjects) {
        grades.addRow({
          name: text(row.name),
          kind: text(row.kind),
          average: text(row.average),
          coefficient: text(row.coefficient),
          total: text(row.total),
          rank: text(row.rank),
          appreciation: text(row.appreciation),
          teacherName: text(row.teacherName),
        })
      }

      const classResults = typeof payload.classResults === 'object' && payload.classResults !== null
        ? payload.classResults as {
          classAverage?: unknown
          lowestAverage?: unknown
          highestAverage?: unknown
          distribution?: unknown
        }
        : null

      if (classResults) {
        const stats = workbook.addWorksheet('Class results')
        stats.columns = [
          { header: 'Field', key: 'field', width: 28 },
          { header: 'Value', key: 'value', width: 20 },
        ]
        stats.addRow({ field: 'Class average', value: text(classResults.classAverage) })
        stats.addRow({ field: 'Lowest average', value: text(classResults.lowestAverage) })
        stats.addRow({ field: 'Highest average', value: text(classResults.highestAverage) })
        stats.addRow({})
        const distribution = Array.isArray(classResults.distribution)
          ? classResults.distribution as DistributionRow[]
          : []
        for (const bucket of distribution)
          stats.addRow({ field: text(bucket.label), value: text(bucket.count) })
      }

      const council = typeof payload.council === 'object' && payload.council !== null
        ? payload.council as {
          appreciation?: unknown
          homeroomTeacherName?: unknown
          principalName?: unknown
          signedAt?: unknown
        }
        : null

      if (council) {
        meta.addRow({})
        meta.addRow({ field: 'Council appreciation', value: text(council.appreciation) })
        meta.addRow({ field: 'Homeroom teacher', value: text(council.homeroomTeacherName) })
        meta.addRow({ field: 'Principal', value: text(council.principalName) })
        meta.addRow({ field: 'Signed at', value: text(council.signedAt) })
      }

      const buffer = await workbook.xlsx.writeBuffer()
      return buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer)
    },
  }
}
