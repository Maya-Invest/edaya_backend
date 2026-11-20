#!/usr/bin/env python3
"""Reproduce source references and validate this audit; never changes runtime code.

python3 docs/sprints/permission-scoping-audit/audit.py --write
python3 docs/sprints/permission-scoping-audit/audit.py --check
python3 docs/sprints/permission-scoping-audit/audit.py --check --baseline
Reference counts are lexical evidence, NOT executed coverage or policy reachability.
"""
import argparse
import hashlib
import json
import re
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parents[2]
ROOT = BACKEND.parent
ENUM = "edaya_backend/package/domain-core/src/domain/permissions/permission.ts"
SCOPES = "edaya_backend/package/domain-core/src/domain/permissions/permission-scopes.ts"
REPOS = ["edaya_backend", "edaya_frontend", "edaya_mobile"]
CONTEXT_SOURCES = [
    "edaya_backend/package/domain-service/src/capabilities/access-control/resolve-staff-profile-grants.ts",
    "edaya_backend/package/domain-authorization/src/access/grant-administration.ts",
    "edaya_backend/package/adaptor-postgres/src/lib/resource-access-scope.ts",
    "edaya_backend/package/domain-core/src/domain/permissions/grant-scope.ts",
    "edaya_backend/package/domain-core/src/domain/permissions/authority-scope.ts",
    "edaya_backend/package/domain-core/src/domain/academics/class-subject.ts",
    "edaya_backend/package/domain-core/src/domain/academics/grade-level-subject.ts",
    "edaya_backend/package/domain-core/src/domain/platform/platform-user.ts",
    "edaya_backend/package/domain-service/src/services/entities/managed-entity-service.ts",
    "edaya_frontend/apps/webapp/src/lib/api/assessments-data.ts",
    "edaya_frontend/apps/webapp/src/lib/api/grant-scopes.ts",
    "edaya_frontend/apps/webapp/src/lib/permission-check.ts",
    "edaya_frontend/apps/webapp/src/lib/api/staff-assignment-permissions.ts",
    "edaya_mobile/packages/edaya_api_client/lib/src/effective_grants.dart",
    "edaya_mobile/packages/edaya_api_client/lib/src/school_client.dart",
    "edaya_mobile/apps/teacher/lib/live/entity_queries.dart",
    "edaya_mobile/apps/guardian/lib/features/inbox/inbox_controller.dart",
]


def collect():
    names = re.findall(r"^  ([A-Z][A-Z0-9_]+) = ", (ROOT / ENUM).read_text(), re.M)
    assert len(names) == len(set(names))
    pattern = re.compile(r"\b(?:" + "|".join(names) + r")\b")
    paths = subprocess.check_output([
        "rg", "--files", *REPOS, "-g", "*.ts", "-g", "*.svelte", "-g", "*.dart",
        "-g", "*.json", "-g", "*.sql",
    ], cwd=ROOT, text=True).splitlines()
    refs = {name: defaultdict(list) for name in names}
    hashes = {}
    for path in sorted(paths):
        if any(part in path for part in ["/docs/", "/spec/", "/build/", "/dist/"]):
            continue
        try:
            content = (ROOT / path).read_bytes()
            lines = content.decode().splitlines()
        except (OSError, UnicodeError):
            continue
        if any(p in path for p in ["/tests/", "/test/", "/integration_tests/"]) or ".test." in path:
            category = "test"
        elif any(p in path for p in ["/generated/", "/api/schema", "/api-client/", "/api_client/"]) or path.endswith(".g.dart") or "openapi" in path or "schema.json" in path:
            category = "generated-contract"
        elif "/tooling/" in path:
            category = "tooling-seed"
        elif "/permissions/" in path or path.endswith(("/permission-labels.ts", "/lib/permissions.ts", "/default-access-roles.ts")):
            category = "catalog-preset"
        elif path.startswith("edaya_frontend"):
            category = "frontend"
        elif path.startswith("edaya_mobile"):
            category = "mobile"
        elif "/drizzle/" in path:
            category = "migration"
        else:
            category = "backend-source"
        matched = False
        for number, line in enumerate(lines, 1):
            for name in set(pattern.findall(line)):
                refs[name][(category, path)].append(number)
                matched = True
        if matched:
            hashes[path] = hashlib.sha256(content).hexdigest()
    catalog = ROOT / "edaya_backend/package/domain-core/src/domain/permissions/permission-catalog.ts"
    if catalog.exists():
        entries = re.findall(r"\[Permission\.([A-Z0-9_]+)\]: (unscoped|scoped|review|platform)\((?:'([^']+)')?\)", catalog.read_text())
        assert {name for name, _, _ in entries} == set(names), "Reinspect changed canonical catalog before refreshing the audit"
        grains = {name: "platform" if mode == "platform" else grain
                  for name, mode, grain in entries if mode in {"scoped", "platform"}}
        exceptions = {name for name, mode, _ in entries if mode == "review"}
    else:
        grains = dict(re.findall(r"\[Permission\.([A-Z0-9_]+)\]: '([^']+)'", (ROOT / SCOPES).read_text()))
        grant_source = (ROOT / "edaya_backend/package/domain-core/src/domain/permissions/grant-scope.ts").read_text()
        backend_exceptions = re.search(r"const reviewPermission = \[([^]]+)\]", grant_source)
        assert backend_exceptions, "Reinspect changed scope validator before refreshing the audit"
        exceptions = set(re.findall(r"Permission\.([A-Z0-9_]+)", backend_exceptions.group(1)))
    web_source = (ROOT / "edaya_frontend/apps/webapp/src/lib/api/grant-scopes.ts").read_text()
    web_exceptions = re.search(r"if \(\[([^]]+)\]\.includes\(entry.permission\)\)", web_source)
    assert web_exceptions, "Reinspect changed frontend scope mapping before refreshing the audit"
    assert exceptions == set(re.findall(r"'([A-Z0-9_]+)'", web_exceptions.group(1))), "Current frontend/backend exception lists differ"
    rows = []
    for name in names:
        references = [{"category": category, "path": path, "lines": numbers}
                      for (category, path), numbers in sorted(refs[name].items())]
        counts = Counter()
        for ref in references:
            counts[ref["category"]] += len(ref["lines"])
        declared = grains.get(name, "none")
        selectable = ["school", "class_group"] if name in exceptions else ([] if declared == "platform" else ["school" if declared == "none" else declared])
        rows.append({"permission": name, "declared_scope": declared, "selectable_scopes": selectable,
                     "staff_assignable_now": declared != "platform", "reference_counts": dict(sorted(counts.items())),
                     "references": references})
    for path in CONTEXT_SOURCES:
        hashes[path] = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
    return {"method": "Exact enum tokens including digits; lexical references grouped by path, not runtime coverage.",
            "permission_count": len(names), "permissions": rows, "context_sources": CONTEXT_SOURCES,
            "source_sha256": dict(sorted(hashes.items()))}


def link(path, line=None):
    from os.path import relpath
    target = relpath(ROOT / path, HERE)
    return target + (f"#L{line}" if line else "")


def render(matrix, inventory):
    by_name = {row["permission"]: row for row in inventory["permissions"]}
    lines = ["# Permission decision matrix", "",
             "Status: target catalog implemented locally; see [runtime cutover](runtime-cutover.md). Current-behavior columns preserve the frozen pre-implementation source inspection, not an executed access test.", "",
             f"Coverage: **{inventory['permission_count']} existing identifiers**, plus **{sum(row['origin'] == 'new' for row in matrix)} proposal-only identifiers** (including rename destinations and withdrawn names from the first draft). Only rows with target metadata are active capabilities.",
             "",
             "Start with the [reduced catalog and separation cases](reduced-catalog.md). Read [scope semantics and dependencies](target-specification.md), [findings and assumptions](README.md), and the [implementation/acceptance plan](implementation-plan.md) with this matrix. The complete structured rows are in [permission-matrix.json](permission-matrix.json).",
             "",
             "Scope codes: N unscoped; C grade/class; S grade/grade-subject/class/class-subject; L grade/class/student; T grade/class/class-subject/activity; G grade; A activity; R relationship-only; P platform; — no surviving action (see successor rows where applicable). Exact selections, all-grain behavior, and dependencies are specified in the target specification. Availability lists assignment mechanisms, not role-based runtime authority. Service/S2S restrictions are separate from staff assignment eligibility.",
             "",
             "Every retained/new row uses the baseline tenant/year/status/delegation cases plus its explicit allow/deny case. Retired rows must reject the removed identifier. Evidence links go to inspected source; per-permission frontend, tests, presets, and generated-contract references are retained in [source inventory](evidence/source-inventory.json).", ""]
    family = None
    families = dict.fromkeys(row['family'] for row in matrix)
    for row in [row for family_name in families for row in matrix if row['family'] == family_name]:
        if row["family"] != family:
            family = row["family"]
            lines.extend([f"## {family}", "", "| Permission / current behavior | Decision and rationale | Target availability / scope | Supporting reads / semantics | Allowed / denied acceptance | Impact |", "|---|---|---|---|---|---|"])
        source = by_name.get(row["permission"])
        evidence = []
        if source:
            refs = [r for r in source["references"] if r["category"] == "backend-source"]
            for ref in refs[:2]:
                evidence.append(f"[{Path(ref['path']).stem}]({link(ref['path'], ref['lines'][0])})")
            if not evidence:
                evidence.append("No direct backend-source token; see inventory and retirement evidence")
            current = f"Catalog: {source['declared_scope']}; selectable: {', '.join(source['selectable_scopes']) or 'not staff-selectable'}. "
        else:
            current = "Proposed identifier. "
        cells = [f"**{row['permission']}** — {current}{row['current_behavior']} {'; '.join(evidence)}",
                 f"{row['decision']} → {', '.join(row['targets']) or 'removed'}. {row['rationale']}",
                 f"{row['availability']}; **{row['scope']}**. {row['intended_users']}",
                 f"{row['dependencies']}; {row['scope_semantics']}",
                 f"Allow: {row['allow']}. Deny: {row['deny']}. [{row['scenario']}]",
                 row['impact'] + "; " + row['assumption']]
        lines.append("| " + " | ".join(str(cell).replace("|", "/").replace("\n", " ") for cell in cells) + " |")
    return "\n".join(lines) + "\n"


def render_catalog(matrix, consolidation):
    active = [row for row in matrix if row['target_catalog']]
    staff = [row for row in active if row['target_catalog']['staffAssignable']]
    baseline_staff = sum(row['staffAssignable'] for row in consolidation['baseline'])
    platform = [row for row in active if row['scope'] == 'P']
    intrinsic = [row for row in active if row['scope'] == 'R']
    lines = ["# Reduced permission catalog", "",
             "Status: **implemented locally**; see [runtime cutover](runtime-cutover.md) for verification and release boundaries.", "",
             f"**{len(staff)} staff-assignable permissions, down from {baseline_staff}** in the first proposal ({baseline_staff - len(staff)} fewer, {(baseline_staff - len(staff)) / baseline_staff:.1%}). The full target has **{len(active)} capabilities**: {len(staff)} staff, {len(platform)} platform and {len(intrinsic)} intrinsic relationship capabilities. The original audited runtime declared 127 permissions; the local runtime now uses this reduced catalog.", "",
             "These are actual catalog consolidations. Profiles remain bundles. Manage includes the listed routine operations but supplies only bounded workflow reads; View grants full permitted browse access separately. State, author, ownership, relationship, assurance and complete-target checks still apply. No hidden CRUD permissions or automatic read-implication graph are introduced.", "",
             "Each case below names a person who needs the capability while lacking a neighboring capability. These are explicit business assumptions (A01–A18), not observations from live usage. Revalidate these separation cases during staging workflow acceptance; any revision must update the catalog, policies and matrix together.", "",
             "Scope: **N** unscoped; **C** grade/class; **S** grade/grade-subject/class/class-subject; **L** grade/class/student; **T** grade/class/class-subject/activity; **G** grade; **A** activity; **R** relationship-derived; **P** platform. Resource scopes require a compatible target or explicit All; empty grants no access. Full semantics and operation boundaries are in [the target specification](target-specification.md).", "",
             "## Staff catalog", "",
             "| Area | Permissions |", "|---|---:|"]
    families = dict.fromkeys(row['family'] for row in staff)
    for family in families:
        lines.append(f"| {family} | {sum(row['family'] == family for row in staff)} |")
    lines.extend([f"| **Total** | **{len(staff)}** |", ""])
    for family in families:
        lines.extend([f"### {family}", "", "| Capability and identifier | Scope | Why it remains separate |", "|---|---|---|"])
        for row in staff:
            if row['family'] == family:
                lines.append(f"| **{row['review']['label']}** — `{row['permission']}` | {row['scope']} | {row['review']['separation_case']} |")
        lines.append("")
    for title, rows in [("Platform catalog", platform), ("Intrinsic access — absent from staff permission pickers", intrinsic)]:
        lines.extend([f"## {title}", "", "| Capability and identifier | Boundary |", "|---|---|"])
        for row in rows:
            lines.append(f"| **{row['review']['label']}** — `{row['permission']}` | {row['review']['separation_case']} |")
        lines.append("")
    lines.extend(["## Consolidations from the first proposal", "",
                  "Names on the left include proposed names that never existed in runtime. Every existing runtime identifier still has its own disposition in the [full matrix](permission-matrix.md). No automatic grant migration is implied.", "",
                  "| Previous proposal capabilities | Revised capability | Decision |", "|---|---|---|"])
    for group in consolidation['groups']:
        sources = ", ".join(f"`{source}`" for source in group['sources'])
        lines.append(f"| {sources} | `{group['target']}` | {group['reason']} |")
    lines.extend(["", "## Review and implementation gate", "",
                  "Review the retained View/Manage boundaries, capture-versus-maintenance duties, independent review/publication, unplaced-record creation and platform maintenance breadth. In particular, A07 still proposes a publisher handoff after comment approval; A16 approves broader routine maintenance; A17 validates the remaining specialist/observer workflows; A18 preserves portal/job operations and delegated authority.", "",
                  "The [matrix](permission-matrix.md), [exact metadata](permission-matrix.json), [technical specification](target-specification.md), and [ordered backlog with SC-01–SC-28](implementation-plan.md) describe the same target. Runtime implementation and development/staging permission resets follow review. Production deployment and unrelated data deletion remain outside scope.", ""])
    return "\n".join(lines)


def validate(matrix, inventory, consolidation, *, baseline=False):
    specification = (HERE / "target-specification.md").read_text()
    plan = (HERE / "implementation-plan.md").read_text()
    overview = (HERE / "README.md").read_text()
    kinds = {"N": [], "C": ["grade_level", "class_group"],
             "S": ["grade_level", "grade_level_subject", "class_group", "class_subject"],
             "L": ["grade_level", "class_group", "student"],
             "T": ["grade_level", "class_group", "class_subject", "activity"],
             "G": ["grade_level"], "A": ["activity"], "R": [], "P": []}
    names = {r["permission"] for r in inventory["permissions"]}
    original = [r["permission"] for r in matrix if r["origin"] == "existing"]
    assert set(original) == names and len(original) == len(names), "Missing or duplicate enum rows"
    all_names = [r["permission"] for r in matrix]
    assert len(all_names) == len(set(all_names)), "Duplicate matrix identifier"
    retained = {r["permission"] for r in matrix if r["permission"] in r["targets"]}
    by_name = {r['permission']: r for r in matrix}
    assert f"{len(matrix)} decision rows" in overview
    assert f"**{len(retained)} active identifiers**" in overview
    assert f"all {len(retained)} active target actions" in specification
    baseline = consolidation['baseline']
    assert len(baseline) == len({row['permission'] for row in baseline})
    destinations = {row['permission']: row['permission'] for row in baseline}
    for rename in consolidation.get('renames', []):
        assert rename['source'] in destinations and rename['target'] in retained
        assert rename['reason']
        destinations[rename['source']] = rename['target']
    merged_sources = set()
    for group in consolidation['groups']:
        assert group['target'] in retained
        assert group['scope'] == by_name[group['target']]['scope']
        assert len(group['sources']) >= 2
        assert group['reason'] and group['allow'] and group['deny']
        for source in group['sources']:
            assert source in destinations and source not in merged_sources
            merged_sources.add(source)
            destinations[source] = group['target']
    assert set(destinations.values()) == retained, "Previous proposal has an unmapped capability"
    assert len(retained) == len(baseline) - sum(len(group['sources']) - 1 for group in consolidation['groups'])
    for name in retained:
        assert set(by_name[name]['consolidates']) == {source for source, target in destinations.items() if target == name}
        assert by_name[name]['review']['label'] and len(by_name[name]['review']['separation_case']) > 50
    # Target documents must not accidentally keep superseded permission names.
    removed = set(all_names) - retained
    for name, content in [('specification', specification), ('plan', plan)]:
        tokens = set(re.findall(r'\b[A-Z][A-Z0-9_]+\b', content))
        assert not tokens & removed, (name, 'obsolete target names', sorted(tokens & removed))
    for case in ['SC-25', 'SC-26', 'SC-27', 'SC-28']:
        assert case in plan
    for row in matrix:
        for field in ["permission", "family", "origin", "current_behavior", "intended_users", "availability", "decision", "scope", "scope_semantics", "dependencies", "allow", "deny", "impact", "rationale", "scenario", "assumption"]:
            assert row.get(field), (row["permission"], field)
        assert row["decision"] in ["Keep", "Rename", "Merge", "Split", "Retire", "Add"]
        assert row["scope"] in ["N", "C", "S", "L", "T", "G", "A", "R", "P", "—"]
        assert all(target in retained for target in row["targets"]), (row["permission"], "dangling target")
        assert row["origin"] != "new" or row["permission"] not in names
        assert row["scenario"] in plan, (row["permission"], "missing scenario")
        assert row["assumption"] in overview, (row["permission"], "missing assumption")
        for dependency in re.findall(r'\bD-[a-z-]+\b', row['dependencies']):
            assert dependency in specification, (row["permission"], "missing dependency", dependency)
        if row["permission"] in retained:
            metadata = row["target_catalog"]
            for field in ['rationale', 'allow', 'deny', 'dependencies', 'availability']:
                tokens = set(re.findall(r'\b[A-Z][A-Z0-9_]+\b', row[field]))
                assert not tokens & removed, (row['permission'], field, 'obsolete target names', sorted(tokens & removed))
            assert isinstance(metadata["staffAssignable"], bool)
            assert isinstance(metadata["serviceAccountAssignable"], bool)
            assert metadata["s2sAccess"] in ["none", "read", "write"]
            mode = metadata["scopePolicy"]["mode"]
            assert mode in ["none", "resources", "relationship", "platform"]
            assert mode == ({'N': 'none', 'R': 'relationship', 'P': 'platform'}.get(row['scope'], 'resources'))
            if mode == "resources":
                assert metadata["scopePolicy"]["allowedKinds"]
                assert "school" not in metadata["scopePolicy"]["allowedKinds"]
                assert metadata["scopePolicy"]["allowedKinds"] == kinds[row["scope"]]
            if mode in ["relationship", "platform"]:
                assert not metadata["staffAssignable"] and not metadata["assignmentTargets"]
                assert not metadata["serviceAccountAssignable"] and metadata["s2sAccess"] == "none"
            assert metadata["staffAssignable"] == (mode in ["none", "resources"])
            assert len(metadata["assignmentTargets"]) == len(set(metadata["assignmentTargets"]))
            assert not metadata["assignmentTargets"] or mode == "resources"
            assert not metadata["serviceAccountAssignable"] or (metadata["staffAssignable"] and not metadata["humanOnly"])
            assert metadata["minimumAssurance"] in ["standard", "verified", "strong"]
        else:
            assert row["target_catalog"] is None
    for doc in HERE.glob("*.md"):
        for target in re.findall(r"\]\(([^)]+)\)", doc.read_text()):
            if "://" in target or target.startswith("#"):
                continue
            clean = target.split("#")[0].replace("%20", " ")
            assert (doc.parent / clean).exists(), (doc.name, target)
            if "#L" in target and not baseline:
                line = int(target.split("#L")[1])
                assert 0 < line <= len((doc.parent / clean).read_text().splitlines()), (doc.name, target)
    for path in HERE.rglob("*"):
        if path.is_file() and path.suffix in [".py", ".json", ".md"]:
            content = path.read_text()
            assert content.endswith("\n"), (path.name, "missing final newline")
            assert all(line == line.rstrip() for line in content.splitlines()), (path.name, "trailing whitespace")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Refresh audit evidence and rendered matrix only")
    parser.add_argument("--check", action="store_true", help="Verify evidence freshness, coverage, targets, and document links")
    parser.add_argument("--baseline", action="store_true", help="Validate documents against the frozen audit snapshot; does not verify current source freshness")
    args = parser.parse_args()
    if args.baseline and (not args.check or args.write):
        parser.error("--baseline requires --check and cannot be combined with --write")
    inventory = json.loads((HERE / "evidence/source-inventory.json").read_text()) if args.baseline else collect()
    matrix = json.loads((HERE / "permission-matrix.json").read_text())
    consolidation = json.loads((HERE / "consolidations.json").read_text())
    rendered = render(matrix, inventory)
    catalog = render_catalog(matrix, consolidation)
    serialized = json.dumps(inventory, indent=2) + "\n"
    if args.write:
        (HERE / "evidence").mkdir(exist_ok=True)
        (HERE / "evidence/source-inventory.json").write_text(serialized)
        (HERE / "permission-matrix.md").write_text(rendered)
        (HERE / "reduced-catalog.md").write_text(catalog)
    if args.check:
        assert (HERE / "evidence/source-inventory.json").read_text() == serialized, "Source inventory is stale"
        assert (HERE / "permission-matrix.md").read_text() == rendered, "Rendered matrix is stale"
        assert (HERE / "reduced-catalog.md").read_text() == catalog, "Reduced catalog is stale"
    validate(matrix, inventory, consolidation, baseline=args.baseline)
    print(json.dumps({"existing": inventory["permission_count"], "proposed_identifiers": sum(r["origin"] == "new" for r in matrix),
                      "active_target_actions": sum(r["target_catalog"] is not None for r in matrix),
                      "staff_assignable_target_actions": sum(bool(r["target_catalog"] and r["target_catalog"]["staffAssignable"]) for r in matrix),
                      "previous_target_actions": len(consolidation['baseline']),
                      "consolidation_groups": len(consolidation['groups']),
                      "dispositions": dict(Counter(r["decision"] for r in matrix)), "referenced_files": len(inventory["source_sha256"]),
                      "source_verification": "frozen audit snapshot" if args.baseline else "current working tree",
                      "validation": "passed"}, indent=2))


if __name__ == "__main__":
    main()
