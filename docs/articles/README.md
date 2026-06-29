# Beyond the SaaS Starter Kit

## Series premise

Most TypeScript SaaS guides end after authentication, billing, database access, and deployment. This series starts where those guides stop. A personal prologue introduces the journey from telecom service delivery to cloud-native architecture; five focused technical articles then examine how a small team can evolve a CRUD product into a secure and maintainable vertical SaaS, and how that architecture changes when the organization grows and moves to AWS.

The perspective is shaped by a transition from telecom service delivery and SLA ownership to software, cloud infrastructure, and observability. The central argument is that cloud-native architecture is not only about where software runs. It is about making boundaries, failure modes, operational ownership, and change safety explicit.

The series does not present the final repository as a universal template. Each article explains the pressure behind a decision, the useful pattern that emerged, the complexity it introduced, and when a smaller solution would be enough.

## Intended audience

- Technical founders designing their first substantial B2B SaaS
- Senior TypeScript engineers moving beyond framework-centered architecture
- Platform and operations engineers moving closer to product development
- Small teams building vertical products with complex authorization and workflows

## Publication plan

| Week | Edition | Primary question |
| --- | --- | --- |
| 1 | Prologue: From Service Delivery to Cloud-Native SaaS | Why did an AWS-targeted startup engagement lead to this architecture and series? |
| 2 | Let Product Constraints Design Your Software Boundaries | How should product and operational constraints shape a SaaS architecture? |
| 3 | Beyond CRUD: Modeling a Real SaaS Domain | When does generic CRUD stop being a safe product model? |
| 4 | Authorization Beyond Roles | How do we enforce access based on tenant, scope, and real relationships? |
| 5 | From Domain Operation to Tested API Contract | How do we expose and verify the architecture end to end? |
| 6 | What If the Team Grows and the SaaS Moves to AWS? | Which boundaries survive, which components change, and when should the modular monolith be split? |

The prologue targets 600-800 words. Technical editions target approximately 700-1,100 words. Each technical article includes one diagram; Articles 2-4 include short code examples where implementation detail strengthens the argument.

## Drafts

0. [Prologue: From Service Delivery to Cloud-Native SaaS](./00-prologue-from-service-delivery-to-cloud-native-saas.md)
1. [Let Product Constraints Design Your Software Boundaries](./01-product-constraints-to-software-boundaries.md)
2. [Beyond CRUD: Modeling a Real SaaS Domain](./02-beyond-crud-modeling-a-real-saas-domain.md)
3. [Authorization Beyond Roles](./03-authorization-beyond-roles.md)
4. [From Domain Operation to Tested API Contract](./04-from-domain-operation-to-tested-api-contract.md)
5. [What If the Team Grows and the SaaS Moves to AWS?](./05-what-if-the-team-grows-and-the-saas-moves-to-aws.md)
