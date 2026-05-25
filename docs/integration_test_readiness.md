# Integration Test Readiness

This document records the current in-memory integration-test scope for the
nine-module `SchoolHeadlessApp` facade. It replaces roadmap assumptions with
the workflows that are intentionally covered before persistence adapters are
introduced.

## Selected Scope

The initial integration suite covers workflows available through these public
modules:

- `setup`: school, academic year and period, grade level, class group, staff,
  and staff assignment setup.
- `academics`: subject offerings, subject matters, class curriculum mapping,
  and cumulative session progress.
- `scheduling`: period definitions, sessions, and grouped sessions.
- `students`: student enrollment and guardian links.
- `attendance`: session attendance capture and review.
- `assessments`: grade scales, report-card definitions, assessment grading,
  and report-card publication.
- `finance`: student fee assignment, payment and reversal flows, and balances.
- `communications`: targeted announcement publication and delivery state
  recording.
- `queries`: cross-domain screen projections for overview, directories,
  timetable, and attendance review.

## Deferred Scope

These entities and ports remain intentionally outside the initial facade
integration scope:

- Student activities and enrollment in activities.
- Incidents, incident involvement, and disciplinary actions.
- Attachments.
- Resources and resource assignments.
- Automatic recipient resolution for targeted communications. The initial
  scope records explicit announcement targets and explicit delivery results.
- Exams and class exams. Initial report-card testing uses ordinary
  assessments.

The deferred areas should receive public commands and dedicated journeys only
when their workflow contracts are selected, rather than exposing incomplete
facade operations.

## Persistence Gate

The facade now requires an `AtomicExecutionPort` for multi-write operations.
Curriculum-progress recording, payment recording, and payment reversal execute
inside that boundary, with in-memory failure tests verifying rollback.

The base repository behavior contract is reusable for later database adapters.
Each persistence adapter must implement `AtomicExecutionPort` using its actual
transaction mechanism and run both the contract suite and the public workflow
journeys before being adopted.
