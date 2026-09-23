# ShiftSync Documentation

ShiftSync is a multi-location staff scheduling platform built for **Coastal Eats**, a restaurant group operating four sites across US time zones. This documentation describes the product specification, system architecture, technical decisions, and operational workflows.


## Contents

| Document | Description |
| --- | --- |
| [Project Specification](specification.md) | Domain model, actors, functional requirements, non-goals |
| [Architecture](architecture.md) | System topology, layers, data flow, deployment |
| [Technical Decisions](technical-decisions.md) | Rationale for stack, auth, concurrency, live updates, and UI patterns |
| [Workflows](workflows.md) | Flowcharts for scheduling, swaps, duty, auth, and audit |
| [Role Permissions](role-permissions.md) | Route access and capability matrix by role |
| [API Reference](api-reference.md) | REST and WebSocket endpoint summary |
| [Development Guide](development.md) | Local setup, Docker, migrations, seed data, environment variables |
| [Contabo Deployment](deployment-contabo.md) | Shared VPS deploy, CI/CD, TLS, gateway, troubleshooting |

## Quick links

- **Frontend:** http://localhost:3000
- **API:** http://localhost:8000
- **OpenAPI:** http://localhost:8000/docs
- **Health:** http://localhost:8000/health

## Demo credentials

All accounts use password **`password123`**.

| Role | Email |
| --- | --- |
| Admin | admin@coastaleats.com |
| Manager (Pacific) | manager.west@coastaleats.com |
| Manager (Eastern) | manager.east@coastaleats.com |
| Staff | sam@coastaleats.com |
