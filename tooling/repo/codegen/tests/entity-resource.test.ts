import { expect, test } from 'bun:test'
import { EntityResource } from '../templates/runtime/entity-resource'
import type { Transport } from '../templates/runtime/transport'

const none = { create: false, update: false, delete: false, batchCreate: false, batchUpdate: false, batchDelete: false }

test('command-owned resources reject every generic mutation before network access', async () => {
	let requests = 0
	const transport: Transport = { request: async <T>() => {
		requests++
		return {} as T
	} }
	const resource = new EntityResource(transport, 'payments', none)
	await expect(resource.save({ id: 'payment' })).rejects.toThrow('domain command')
	expect(() => resource.delete({ id: 'payment' })).toThrow('domain command')
	expect(() => resource.batchSave({ entities: [] })).toThrow('domain command')
	expect(() => resource.batchDelete({ ids: ['payment'] })).toThrow('domain command')
	expect(requests).toBe(0)
})

test('delete permission does not imply save or batch permission; upsert requires both create and update', async () => {
	const requests: string[] = []
	const transport: Transport = { request: async <T>(_method: string, path: string) => {
		requests.push(path)
		return {} as T
	} }
	const resource = new EntityResource(transport, 'custom-allocation', { ...none, create: true, delete: true })
	await expect(resource.save({ id: 'existing' })).rejects.toThrow('domain command')
	await resource.delete({ id: 'existing' })
	expect(() => resource.batchDelete({ ids: ['existing'] })).toThrow('domain command')
	expect(requests).toEqual(['/core/entities/custom-allocation/delete'])
})
