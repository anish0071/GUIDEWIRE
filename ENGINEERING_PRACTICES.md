# Project-A — Software Engineering Practices

## 1. Project Structure

### Backend
```
backend/
├── main.py              # App entry point — only mounts routers
├── db.py                # DB engine + session factory
├── models.py            # SQLModel ORM models (single source of truth)
├── routers/             # One file per domain (auth, users, policies, claims, simulate, admin)
│   └── *.py
├── services/            # Business logic layer — routers call services, never DB directly
│   └── *.py
├── ai.py                # Pure scoring math — no DB access
├── trigger.py           # Trigger engine — calls services
├── risk_model.py        # Anomaly/ML models
└── requirements.txt
```

### Frontend
```
frontend/src/
├── api/index.js         # All fetch calls — single source of truth for API
├── pages/               # One file per route/page
├── components/          # Reusable UI components
├── hooks/               # Custom React hooks
├── context/             # Global state (auth, user)
├── App.jsx              # Router only — no logic
├── main.jsx             # React entry
└── theme.css            # Design tokens + utilities
```

---

## 2. Layered Architecture (Backend)

```
HTTP Request
    → Router       (validates input, calls service)
    → Service      (business logic, calls models/DB)
    → Model        (ORM / DB)
```

- **Routers** must NOT contain business logic. They validate input and delegate.
- **Services** must NOT handle HTTP concerns (no HTTPException — raise domain errors).
- **Models** are data shape only — no logic.

---

## 3. Code Principles

### DRY (Don't Repeat Yourself)
- Session DB access only through `get_session` dependency injection.
- Scoring logic lives only in `ai.py` — never duplicated in routers or services.

### Single Responsibility
- Each file/function does one thing.
- `claim_service.py` handles claims. `payout_service.py` handles payouts.

### Explicit over Implicit
- All function parameters typed (Python type hints + Pydantic models).
- All API responses are typed Pydantic response models.

### Fail Fast
- Input validation at the router boundary (Pydantic).
- Domain errors raised immediately in service layer.

---

## 4. Python Conventions

```python
# ✅ Good — typed, docstrings, small functions
def calculate_payout(hourly_income: float, duration: float) -> float:
    """Compute capped payout for a claim duration."""
    return min(hourly_income * duration, DAILY_CAP)

# ❌ Bad — no types, no doc, mixes concerns
def do_stuff(data):
    db.add(Claim(amount=data['income'] * data['dur']))
    db.commit()
```

- Max function length: **30 lines**
- Max file length: **200 lines** (split into modules if exceeded)
- Use `Optional[X]` only where truly optional; default to required
- Constants in UPPER_CASE at module level

---

## 5. React Conventions

```jsx
// ✅ Good — named export, typed props, single responsibility
export function ClaimCard({ claimId, status, amount }) {
  return <div className="claim-card">...</div>
}

// ✅ Good — API calls only in api/index.js
import { fetchClaim } from '../api'

// ❌ Bad — fetch inside component mixed with render logic
fetch('/api/claim').then(...)
```

- Pages = route-level components, no shared logic
- Components = reusable UI, receive data via props
- All API calls in `src/api/index.js`
- All auth state in `src/context/AuthContext.jsx`
- CSS classes named with BEM-like conventions: `.card`, `.card--active`, `.card__title`

---

## 6. API Design Rules

- Endpoints grouped by domain: `/auth/*`, `/users/*`, `/policies/*`, `/claims/*`
- HTTP verbs used correctly: GET=read, POST=create, PATCH=update, DELETE=remove
- All responses return consistent shape: `{ data, error, status }`
- Error codes: 400 (bad input), 401 (unauth), 404 (not found), 422 (validation), 500 (server)
- Auth token passed via `Authorization: Bearer <token>` header — never as query param

---

## 7. Security Rules

- **Never** expose OTP or session token in logs
- **Never** accept `user_id` as a plain query param for protected routes — use session token
- **Never** commit `.env` or `*.db` files to git
- Validate all incoming floats to sane ranges (rain 0–300, temp -20–60, etc.)

---

## 8. Testing Plan

- Unit tests for all `ai.py` scoring functions (pure math, easy to test)
- Integration tests for all router endpoints using FastAPI `TestClient`
- Frontend: at minimum smoke-test each page renders without crash

---

## 9. Git Practices

- Feature branches: `feat/<name>`, Bug fixes: `fix/<name>`
- Commit message format: `feat: add auto-payout on claim approval`
- Never commit: `*.db`, `.env`, `__pycache__/`, `node_modules/`

---

## 10. Definition of Done

A feature is **Done** when:
- [ ] Business logic is in service layer, not router
- [ ] All inputs are validated (Pydantic / type checks)
- [ ] Errors return meaningful HTTP status codes
- [ ] No print() statements — use Python logging
- [ ] No `any` types in frontend props
- [ ] Feature is reachable via the UI (not just via API)
