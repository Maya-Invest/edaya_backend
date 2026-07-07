import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const QueryOperations = defineOperationFamily({
  overviewRead: {
    id: 'queries.overview.read',
    global: true,
    staff: { permission: Permission.QUERY_OVERVIEW_READ },
  },
  overdueFeesRead: {
    id: 'queries.overdue-fees.read',
    global: true,
    staff: { permission: Permission.QUERY_OVERDUE_FEES_READ },
  },
})
