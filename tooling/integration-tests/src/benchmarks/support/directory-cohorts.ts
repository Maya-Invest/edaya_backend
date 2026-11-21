import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

/** Shared class size, placements and marks for the native read benchmarks. */
export async function seedDirectoryCohorts(db: { execute: (query: SQL) => Promise<unknown> }, id: (key: string) => string, size: number) {
  await db.execute(sql`insert into class_groups (id,school_id,academic_year_id,grade_level_id,name,short_name,created_at)
    select ${id('cohort-')}||i,${id('school')},${id('year')},${id('grade')},'Class '||i,'C'||i,now() from generate_series(1,${Math.ceil(size / 30)}) i`)
  await db.execute(sql`insert into students (id,school_id,first_name,last_name,status,created_at)
    select ${id('pupil-')}||i,${id('school')},'Student',i::text,'active',now() from generate_series(1,${size}) i`)
  await db.execute(sql`insert into student_class_enrollments (id,student_id,class_group_id,academic_year_id,enrollment_index,status,enrolled_at,created_at)
    select ${id('placement-')}||i,${id('pupil-')}||i,${id('cohort-')}||((i-1)/30+1),${id('year')},1,'active','2026-01-01',now() from generate_series(1,${size}) i`)
  await db.execute(sql`insert into class_subjects (id,class_group_id,subject_id,coefficient,is_offered,completed_percentage,created_at)
    select ${id('subject-')}||i,${id('cohort-')}||i,${id('math')},1,true,0,now() from generate_series(1,${Math.ceil(size / 30)}) i`)
  await db.execute(sql`insert into assessments (id,class_group_id,class_subject_id,period_id,title,kind,max_score,coefficient,starts_at,ends_at,marks_status,marks_review,created_at)
    select ${id('quiz-')}||i,${id('cohort-')}||i,${id('subject-')}||i,${id('period')},'Quiz','quiz',20,1,'2026-02-01','2026-02-01 01:00','submitted',
      jsonb_build_object('rosterStudentIds',(select jsonb_agg(student_id) from student_class_enrollments where class_group_id=${id('cohort-')}||i),'editedBySubjectIds','[]'::jsonb,'history','[]'::jsonb),now() from generate_series(1,${Math.ceil(size / 30)}) i`)
  await db.execute(sql`insert into assessment_results (id,student_id,assessment_id,score,designation,created_at)
    select ${id('score-')}||i,${id('pupil-')}||i,${id('quiz-')}||((i-1)/30+1),12.75,'scored',now() from generate_series(1,${size}) i`)
}
