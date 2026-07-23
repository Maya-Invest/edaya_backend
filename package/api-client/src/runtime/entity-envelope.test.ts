import { describe, expect, test } from 'bun:test'
import { unwrapEntity, unwrapEntityList } from './entity-envelope'

describe('unwrapEntity', () => {
	test('prefers plain data.sectionResults over class-shaped siblings', () => {
		const unwrapped = unwrapEntity<{
			id: string
			overallAverage: number
			sectionResults: Array<{
				sectionId: string
				subResults: Array<{ classSubjectId: string, average: number }>
			}>
		}>({
			data: {
				id: 'rc-1',
				overallAverage: 16.7,
				sectionResults: [{
					sectionId: 'sec-root',
					subResults: [{ classSubjectId: 'cs-math', average: 15 }],
				}],
			},
			sectionResults: [{
				data: {
					sectionId: 'sec-root',
					subResults: [{ classSubjectId: 'cs-math', average: 15 }],
				},
				subResults: [{
					data: { classSubjectId: 'cs-math', average: 15 },
					subResults: [],
				}],
			}],
		})

		expect(unwrapped.id).toBe('rc-1')
		expect(unwrapped.overallAverage).toBe(16.7)
		expect(unwrapped.sectionResults[0]?.subResults[0]?.classSubjectId).toBe('cs-math')
	})

	test('unwrapEntityList maps each entry', () => {
		const rows = unwrapEntityList<{ id: string }>([
			{ data: { id: 'a' } },
			{ data: { id: 'b' } },
		])
		expect(rows.map(row => row.id)).toEqual(['a', 'b'])
	})
})
