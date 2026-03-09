# DalTime

**Free shift scheduling for nonprofit teams.**

---

## The Problem

Organizations like the YMCA rely heavily on part-time staff. Scheduling dozens of employees across multiple shifts, locations, and availability constraints is a logistical nightmare. Commercial scheduling software costs $3-10+ per user per month — unaffordable for nonprofits operating on tight budgets.

## The Solution

DalTime is a free, open-source shift scheduling web app designed specifically for community organizations. Built on serverless AWS infrastructure, hosting costs are minimal — even with hundreds of users.

### Key Features

- **Multi-organization support** — One platform serves multiple YMCA branches or similar organizations
- **Hierarchical user management** — Org admins → Managers → Employees
- **Manager-driven onboarding** — Employees join via invitation, no self-registration chaos
- **Mobile-friendly** — Staff can check schedules from any device
- **Serverless architecture** — Scales automatically, minimal hosting costs

## Architecture

![DalTime Architecture](docs/architecture/diagram/DalTime%20Architecture.drawio.png)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Angular 21 |
| Backend | AWS SAM + Lambda (Node.js 24) |
| Database | DynamoDB |
| Authentication | AWS Cognito |
| Infrastructure | AWS SAM/CloudFormation |

## User Roles

### Web-Admin
Platform-level administrators who manage all organizations within DalTime. They have access to a full organization list and can click into any organization to view and manage it with the same capabilities as an Org-Admin.

### Org-Admin
Organization administrators (e.g., a YMCA branch director) who manage their own organization. They create manager accounts and generate invite codes for managers to join the application. Org-Admins have full control over all managers within their organization and can click into any manager to view and manage things with the same capabilities as that Manager.

### Manager
Managers create invite codes for employees to join and oversee all employees under them. Key responsibilities include:
- Defining shifts that need to be filled
- Setting scheduling constraints (e.g., max 8 hours/day, 40 hours/week per employee)
- Clicking **"Create Schedule"** to auto-generate a schedule based on employee availability and shift requirements
- Reviewing and approving the generated schedule before publishing it to employees

### Employee
Employees interact with the system to:
- Submit their availability
- View their published schedule
- Post their shifts as available for others to pick up
- Pick up open shifts from other employees

## Getting Started

### Prerequisites

- Node.js 24+
- AWS CLI configured
- AWS SAM CLI
- Docker (for local Lambda testing)

### Local Development

> **Note:** Docker must be running for the backend (SAM uses Docker to emulate Lambda locally).

**VS Code users (Mac):** Run `Tasks: Run Task` → `Start Full Stack` to launch everything automatically via the included `.vscode/tasks.json`. Windows support coming soon.

**Manual setup:**

```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend (requires Docker)
cd backend && sam build && sam local start-api

# Start frontend
cd frontend && npm start
```

## Testing

For our testing approach and guidelines, see [Testing Philosophy](docs/testing-philosophy.md).

| Type | Framework | Location |
|------|-----------|----------|
| Unit (Backend) | Jest | `backend/test/unit/` |
| Unit (Frontend) | Jest | Co-located with each component/service |
| Integration | Jest | `backend/test/integration/` |
| E2E | Robot Framework | `robot/` |

## Contributing

This project is built to help nonprofits. Contributions welcome!

## License

MIT

---

*Built with ❤️ for community organizations by [Dallas LaComb](https://github.com/dallaslacomb).*
Schedule your part-time employees easier with DalTime.
