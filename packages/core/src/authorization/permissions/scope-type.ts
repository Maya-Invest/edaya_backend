/**
 * Where a permission may apply. `course_assignment` maps to class-subject / teaching
 * assignments in the domain model (see StaffAssignment.classSubjectId).
 */
export type ScopeType
  = | 'platform'
    | 'school'
    | 'academic_year'
    | 'class_group'
    | 'subject'
    | 'course_assignment'
    | 'session'
    | 'student'
    | 'student_group'
