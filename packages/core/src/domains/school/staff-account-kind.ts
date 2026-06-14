export type StaffAccountKind = 'human' | 'service'

export const STAFF_ACCOUNT_KINDS = ['human', 'service'] as const satisfies readonly StaffAccountKind[]
