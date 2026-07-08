import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const PlatformOperations = defineOperationFamily({
  registerSchool: {
    id: 'platform.school.register',
    global: true,
    staff: { permission: Permission.PLATFORM_REGISTER_SCHOOL },
  },
})
