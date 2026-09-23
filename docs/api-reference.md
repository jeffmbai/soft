# API Reference

Base URL: `http://localhost:8000/api`  
Interactive docs: http://localhost:8000/docs

The browser frontend calls these endpoints through the Next.js BFF at `/api/proxy/*`, which attaches the Bearer token from httpOnly cookies.

---

## Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/login` | — | `{ email, password }` → tokens |
| POST | `/auth/refresh` | refresh token | New access token |
| GET | `/auth/me` | Bearer | Current user `{ id, email, name, role }` |

---

## Locations

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/locations` | all | List accessible locations |
| GET | `/locations/overview` | admin | Locations + assigned managers |
| GET | `/locations/managers` | admin | All managers list |
| PUT | `/locations/{id}/managers` | admin | `{ manager_ids: [] }` |

---

## Staff

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/staff` | admin, manager | List with filters: `q`, `skill`, `location_id`, `certification` |
| GET | `/staff/export` | admin, manager | CSV download |
| GET | `/staff/{id}` | admin, manager | Single staff member |
| POST | `/staff` | admin | Create staff |
| PATCH | `/staff/{id}` | admin | Update staff |
| DELETE | `/staff/{id}` | admin | Delete staff |

---

## Scheduling

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/locations/{id}/schedule?week=` | admin, manager, staff | Week grid (staff: published only) |
| POST | `/locations/{id}/shifts` | admin, manager | Create shift |
| PATCH | `/shifts/{id}` | admin, manager | Update shift (requires `version`) |
| DELETE | `/shifts/{id}` | admin, manager | Delete draft shift |
| POST | `/shifts/{id}/assign` | admin, manager | Assign staff |
| POST | `/shifts/{id}/assign/preview` | admin, manager | Preview violations |
| DELETE | `/assignments/{id}` | admin, manager | Unassign |
| POST | `/locations/{id}/weeks/{week}/publish` | admin, manager | Publish week |
| POST | `/locations/{id}/weeks/{week}/unpublish` | admin, manager | Unpublish week |
| GET | `/shifts/{id}/history` | admin, manager | Audit log for shift |

### Shift create/update body (local times)

```json
{
  "required_skill": "server",
  "headcount": 2,
  "local_date": "2026-09-23",
  "local_start_time": "09:00",
  "local_end_time": "17:00"
}
```

---

## Availability and my shifts

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/my/shifts?week=&upcoming=` | staff | Personal schedule with duty info |
| GET | `/me/availability` | staff | Availability windows + exceptions |
| PUT | `/me/availability` | staff | Replace availability |

---

## Swaps and open shifts

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/swap-requests` | all | Scoped swap list |
| GET | `/open-shifts` | all | Approved drops available to claim |
| POST | `/swap-requests` | staff | `{ assignment_id, type, target_user_id? }` |
| POST | `/swap-requests/{id}/accept` | staff | Peer accept |
| POST | `/swap-requests/{id}/approve` | admin, manager | Manager approve |
| POST | `/swap-requests/{id}/cancel` | all | Cancel request |
| POST | `/swap-requests/{id}/claim` | staff | Claim open shift |

---

## Duty

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/duty/floor` | admin, manager | Full floor snapshot |
| GET | `/duty/summary` | admin, manager | Navbar counts |
| POST | `/duty/ws-token` | admin, manager | Short-lived WS JWT |
| POST | `/duty/clock-in` | all | `{ assignment_id }` |
| POST | `/duty/clock-out` | all | `{ assignment_id }` |

### WebSocket

```
WS /api/ws/duty?token=<ws-jwt>
```

Messages: `{ "type": "snapshot", "data": DutyFloorResponse }`

---

## Audit

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/audit` | admin, manager | Cross-location audit list |

Query params: `location_id`, `entity_type`, `limit` (max 200), `offset`

---

## Notifications

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/me/notifications` | all | In-app notifications |
| POST | `/me/notifications/{id}/read` | all | Mark read |
| GET | `/me/notification-preferences` | all | Preferences |
| PATCH | `/me/notification-preferences` | all | Update preferences |

---

## Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | — | `{ status, redis }` |

---

## Common response codes

| Code | Meaning |
| --- | --- |
| 401 | Missing or expired token |
| 403 | Wrong role or location access |
| 409 | Optimistic lock conflict, headcount full, duplicate clock-in |
| 422 | Validation error (Pydantic) |

Assignment preview returns 200 with `{ success: false, violations: [], suggestions: [] }` rather than 4xx for constraint failures.
