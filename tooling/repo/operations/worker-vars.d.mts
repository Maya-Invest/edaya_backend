export interface Binding { name: string, type: string, text?: string, [key: string]: unknown }
export interface VariablePlan { changes: { name: string, action: string }[], bindings: Binding[] }
export function workerTarget(target: string, root?: string): string
export function selectedVariables(target: string, root?: string): Record<string, string>
export function planVariableUpdate(bindings: Binding[], values?: Record<string, string>, deletes?: string[], replaceSecrets?: string[], versionId?: string): VariablePlan
export function updateWorkerVariables(options: { accountId?: string, token?: string, worker: string, values?: Record<string, string>, deletes?: string[], replaceSecrets?: string[], dryRun?: boolean, request?: typeof fetch }): Promise<VariablePlan & { worker: string, applied: boolean }>

export interface WorkerCredentials { accountId?: string, token?: string, worker: string, request?: typeof fetch }
export function readWorkerState(options: WorkerCredentials): Promise<{ deployments: { deployments: { id: string, versions: { version_id: string, percentage: number }[] }[] }, versions: { items: { id: string }[] }, bindings: Binding[] }>
