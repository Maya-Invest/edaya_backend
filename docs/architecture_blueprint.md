# Architecture Blueprint: Core Service & Coordinator Design

This document details the architectural design and phased roadmap for expanding the service layer (`src/services/`) and the unified application facade ([school-headless-app.ts](file:///Users/atoumbre/SoftiLab/maya_school_core/packages/core/src/school-headless-app.ts)).

---

## 1. System Philosophy & Current Architecture

The `maya_school_core` package acts as a decoupled, framework-independent **headless core** employing clean **Hexagonal Architecture** principles:
* **Core Entities (`src/entities/`)**: Pure domain models carrying state and business invariant rules (academics, administration, assessments, scheduling, core, finance).
* **Ports (`src/ports/`)**: Repository and gateway interfaces defining capabilities required by the domain without binding to databases.
* **Services (`src/services/`)**: Use-case orchestrators executing business rules, transacting via repository ports, and mutating entities.
* **Headless Coordinator (`src/school-headless-app.ts`)**: The unified facade class (`SchoolHeadlessApp`) that instantiates all services, injects appropriate repositories, and exposes clean, public API methods.

---

## 2. Identified Architectural Gaps

To establish a fully functional **essential school management system** (not a heavy, complex ERP), we need to implement the following key modules:

### 1. Finance Consolidation (`services/fees/finance-consolidation.ts`)
* **Purpose**: Aggregate student fee schedules, paid installments, and overdue balances to provide school-wide and classroom-wide ledgers.
* **Core Metrics**: Collection rates, outstanding overdue balances, currency-specific revenue ledgers, and cashflow collection trends.

### 2. Lifecycles, Enrollment & Promotions (`services/workspace/promotion.ts`)
* **Purpose**: Manage lifecycle transitions, bulk registrations, active/inactive student statuses, and year-over-year classroom promotion sequences.
* **Guardrails**: Prevent bulk promotion if student grade sheets or report cards in the current classroom are open, or if critical overdue balances remain.

### 3. Behavior & Incident Tracking (`services/behavior/incident.ts`)
* **Purpose**: Orchestrate student behavioral actions, logging incident reports, classifying involvement roles (witness, reporter, subject), and tracking active disciplinary measures.

### 4. Conflict-Free Timetabling (`services/planing/timetable-orchestrator.ts`)
* **Purpose**: Coordinate calendar event generation, timetable slot layouts, recurring session templates, and conflict-detection guardrails.
* **Guardrails**: Block double-booking of teachers or classrooms for overlapping sessions.

### 5. Academic Performance Insights (`services/assessment/academic-insights.ts`)
* **Purpose**: Compute analytical views on grading performance, such as classroom GPA averages, grade boundary distributions, and alert triggers for underperforming cohorts.

---

## 3. Target Modular Directory Structure

```text
packages/core/src/
├── entities/                      # Pure Business Models
├── ports/                         # Database Adapter Ports
├── services/                      # Core Use-Case Services
│   ├── announcement.ts            
│   ├── guardian.ts                
│   ├── assessment/                
│   │   ├── assessment.ts          
│   │   ├── grade.ts               
│   │   ├── module.ts              
│   │   ├── report-card.ts         
│   │   └── academic-insights.ts   # [NEW] Class averages & performance GPA analytics
│   ├── behavior/                  # [NEW] Behavior & Incidents
│   │   └── incident.ts            # [NEW] Incident registry, roles & disciplinary logs
│   ├── fees/                      
│   │   ├── fee.ts                 
│   │   └── finance-consolidation.ts # [NEW] School-wide revenue ledgers & metrics
│   ├── planing/                   # Scheduling & Calendars
│   │   ├── attendance.ts          
│   │   ├── attendance-review.ts   
│   │   ├── deadline.ts            
│   │   ├── session.ts             
│   │   └── timetable-orchestrator.ts # [NEW] Recurring slots & conflict checks
│   └── workspace/                 
│       ├── academic-calendar.ts   
│       ├── classroom.ts           
│       ├── classroom-read.ts      
│       ├── school.ts              
│       ├── school-overview.ts     
│       ├── staff.ts               
│       ├── staff-assignment.ts    
│       ├── student.ts             
│       ├── student-directory.ts   
│       ├── workspace.ts           
│       └── promotion.ts           # [NEW] Bulk rollovers & academic Promotions
└── school-headless-app.ts         # Central Gateway App Coordinator
```

---

## 4. Authorization Strategy

We employ a **hybrid contextual authorization** model at the service level. This isolates identity verification from domain authorization policies:

* **Authentication (Identity)**: Handled by the outer delivery layer (e.g., API router, cookies, or JWT verification in server loaders).
* **Authorization (Business Policies)**: Evaluated directly in the service methods using an injected context representing the calling identity.

```typescript
export interface Actor {
  id: string
  roles: StaffRole[] // e.g. Admin, Principal, Teacher, Student, Guardian
}
```

Every mutation or data read in the service layer requires this `actor` block. The service evaluates authorization by verifying database context (e.g., checking if the actor is mapped as the assigned class teacher in the repositories):

```typescript
// Inside GradeService
const isAssigned = await this.moduleStaffAssignments.isTeacherAssigned({
  moduleId: grade.moduleId,
  staffId: actor.id
})
if (!isAssigned && !actor.roles.includes(StaffRole.Admin)) {
  throw new Error("UNAUTHORIZED: Only the assigned teacher can edit grades.")
}
```

This guarantees:
1. **Developer Proofing**: API routers cannot bypass checks since services enforce rules.
2. **Easy Mocking**: Unit tests pass custom mock actor identities.
3. **System Overrides**: Background scripts run safely by passing a `SystemActor` token.

---

## 5. Proposed Implementation Roadmap

To maintain a clean, stable, and highly verified codebase, implementation will be executed in 5 dedicated phases:

### Phase 1: Finance Consolidation & Performance Ledgers
* **Deliverables**: Create `FinanceConsolidationService`, register it inside the headless coordinator, and construct unit tests verifying school, grade, and classroom-wide metrics.

### Phase 2: Behavioral Incident Management
* **Deliverables**: Establish `IncidentRepository` and `DisciplinaryActionRepository` ports, write `BehaviorService`, and add incident reporting and tracking capabilities to the public facade.

### Phase 3: Lifecycle, Enrollment & Promotion Flow
* **Deliverables**: Write `PromotionService` to handle automated batch operations for roll-over registrations and cohort promotions, complete with safety guard rails.

### Phase 4: Academic Performance Insights
* **Deliverables**: Add statistical tools and alert metrics in `AcademicInsightsService` to power interactive charts and dashboards in the user interface.

### Phase 5: Timetable Orchestrator & Conflict Protection
* **Deliverables**: Deploy `TimetableOrchestratorService` to control timetabling slots, schedule sessions, and protect against double-booking staff or classroom resources.
