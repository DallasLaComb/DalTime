You are a technical writer and context architect.

Help me produce a high-quality CONTEXT.md file for the following topic inside my project.
The file will be read by an LLM (and optionally human engineers) to quickly understand
full intent, constraints, and background — without noise or missing critical detail.

## Project & Topic

- Project: shift-scheduler
- Topic / Feature / Module: cognito authentication
- One-sentence summary: Role based authentication using AWS Cognito for serverless web app: s3, cloudfront, api gateway, lambda(node.js), dynamodb.

## Raw Input
4 Roles:
-WebAdmin: This will be developers / maintainers. The idea is WebAdmins will manage all the orginaztions. This includes, creating, modfying, and deleting organizations. Should also be able to see all orgs data to help debug issues that they are having.
-OrgAdmin: Created by a WebAdmin only. The idea of an OrgAdmin is to manage your organization. Example scope would be MeridenYMCA, you can be an OrgAdmin of. There can be more than one OrgAdmin... OrgAdmins can control the managers and employees in their org...
-Manager: Gets invited by an OrgAdmin. The Manager role will be able to invite employees. Say what availability they need. See employees availbility. Creates schedules. See the schedule. Get notified when employees swap shifts.
-Employee: Get invited by a manager usually. Should be able to send their availabilty, see their schedule, swap shifts with other employees.



## Decisions Already Made

Using Amazon Cognito because the rest of the web app is serverless. Some custom attributes that I have are manager_id(Only added to employees to see who their manager is), org_id(Added to every user type except WebAdmin as they will be managing all orgs), user_type(WebAdmin,OrgAdmin,Employee,Manager)

## Constraints

Using Amazon Cognito, Angular, API Gateway, Lambdas, and DynamoDB. Each user that isn't a WebAdmin should be limited to the scope of their Orgs data. Using cognitos self hosted login page.
---

Produce a CONTEXT.md covering ALL sections below. Omit a section only if genuinely not applicable, and say so.

1. **Purpose / Goal** — what we're achieving and why it matters
2. **Scope** — in-scope and explicitly out-of-scope
3. **Current State** — what exists today, the starting point
4. **Desired State** — what "done" looks like (end state, not steps)
5. **Constraints** — tech, product, legal, compatibility, hard limits
6. **Non-Goals / Anti-Requirements** — what we're intentionally NOT doing and why
7. **Key Domain Concepts / Glossary** — terms with specific or overloaded meaning here
8. **Relevant Architecture / Components** — how this fits the larger system, data flow
9. **Important Files, Folders, Entry Points** — what to read first
10. **External Dependencies and Integrations** — services, APIs, packages; what breaks if unavailable
11. **Known Pitfalls / Gotchas / Failure Modes** — lessons learned, easy-to-miss edge cases
12. **Decisions Already Made + Rationale** — settled decisions, rejected alternatives, and why
13. **Acceptance Criteria / Success Metrics** — measurable definition of done
14. **Open Questions** — undecided items with owner and blocker

## Output Format

- Markdown with `##` section headings and bullet lists
- Frontmatter at the top:
  ```
  ---
  topic: {FEATURE_OR_TOPIC}
  project: {PROJECT_NAME}
  created: {DATE}
  status: draft | review | stable
  ---
  ```
- End with an empty `## Revision Notes` section

## Before Writing

Ask me for clarification if any of the following are missing:
1. Tech stack or cloud provider is unknown
2. Desired state cannot be inferred
3. No acceptance criteria provided
4. Decisions listed without rationale
5. Scope boundary is ambiguous

Ask those questions first, then produce the file.
