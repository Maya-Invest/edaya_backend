import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  generateTimetablePreview,
  renderTimetablePreview,
} from '../tests/support/timetable-preview-fixture'

const preview = renderTimetablePreview(generateTimetablePreview())

if (process.argv.includes('--stdout')) {
  console.log(preview)
}
else {
  const outputPath = resolve(import.meta.dir, '../../../.data/previews/timetable-preview.md')
  await mkdir(dirname(outputPath), { recursive: true })
  await Bun.write(outputPath, `${preview}\n`)

  console.log(`Wrote the complete three-class timetable to ${outputPath}`)
  console.log(preview.split('\n').slice(-3).join('\n'))
}
