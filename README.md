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

| Role | Description |
|------|-------------|
| **Web-Admin** | Platform administrators (developers) |
| **ORG-Admin** | Organization administrator (e.g., Meriden YMCA director) |
| **Manager** | Shift managers who create schedules and invite employees |
| **Employee** | Staff members who view their schedules |

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
