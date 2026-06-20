# From Service Delivery to Cloud-Native SaaS

## Why I am writing Beyond the SaaS Starter Kit

When an early-stage company contacted me to help design a school-management SaaS, AWS was the expected destination. The initial brief sounded familiar: authentication, dashboards, administrative forms, and a relational database.

The difficult questions appeared during discovery.

Was a school simply an account, or a strict data boundary? Could a teacher see every student, or only students connected to an assigned class? Could a payment be edited like an ordinary record? What happened if enrollment updated one record but failed halfway through the rest of the workflow? How would a small team reproduce data, investigate failures, and operate the platform with confidence?

These were software questions, but I recognized them from an earlier part of my career.

For almost a decade, I led service delivery for telecom operators across West and Central Africa. My work included SLA performance, operational process improvement, and customer-facing delivery. That experience taught me that a service is not successful because it deployed once. It succeeds when people can operate it, understand its failures, change it safely, and restore confidence when something goes wrong.

My move into data engineering, backend systems, protocol architecture, cloud infrastructure, and observability brought me closer to implementation. At Weft Finance, asset safety, transaction atomicity, and operational visibility were architectural requirements. Later cloud and DevOps work showed how Terraform and standardized telemetry could turn operational expectations into repeatable systems.

The startup engagement brought those perspectives together: the service manager asking how a system will behave over time, and the engineer responsible for encoding that behavior in software.

## The first decision was not a framework

AWS could support everything the future platform might need. But the first version did not need every capability of a mature AWS operating model. It needed a small team to deliver a secure product without first becoming a platform organization.

I recommended a Cloudflare-centered production runtime while keeping the API portable across Worker and Node environments. That choice reduced the initial infrastructure surface without making the business core depend on Cloudflare. If the company later developed the scale, controls, and team structure that justified AWS, the Node runtime would provide a conventional migration path.

That decision became one example of the broader principle behind this series: architecture should respond to current product and operational constraints while preserving credible paths for the constraints that may come next.

## Five questions behind the architecture

The first article asks how product realities become software boundaries. It examines the monorepo, modular monolith, portable domain core, adapters, and the difference between cloud-native design and premature distribution.

The second asks when CRUD stops being a safe model. It looks at domain modules, managed entities, explicit commands, business invariants, and atomic workflows.

The third asks why ordinary roles are insufficient for a relationship-heavy, multi-tenant product. It introduces tenant checks, scoped permissions, resource policies, and assurance levels.

The fourth follows one business operation through the delivery system: HTTP validation, actor resolution, domain execution, persistence, OpenAPI generation, the typed client, and integration tests.

The fifth returns to the original AWS target. It considers what should remain intact when the company grows, what infrastructure must change, and when team boundaries genuinely justify separate services.

## What this series is not

This is not a claim that every startup should adopt the final repository structure. An MVP should use the simplest architecture that can test its main assumptions. It is also not an argument that Cloudflare is universally better than AWS, or that commands are always better than CRUD.

The objective is to show the reasoning behind the boundaries: what problem triggered each pattern, what complexity it introduced, and when a simpler solution would be enough.

None of the individual techniques is new. The value is in connecting product modeling, authorization, runtime design, contracts, testing, and operations into one coherent progression for a small TypeScript team.

The first technical article starts with the decision that precedes every package and framework choice: identifying the consequences the product cannot afford to ignore.

