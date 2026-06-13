# Demo Auth System — Design Spec

**Date:** 2026-06-13
**App:** TimeSync (Tauri v2 + React)

## Overview

Add a self-contained demo login + registration system that works alongside the existing ERP-dependent auth. When the ERP backend is unreachable, the app falls back to local SQLite-based authentication with bcrypt-hashed passwords stored in the `users` table.

## Architecture

### Dual-Mode Auth Flow

```
User submits credentials
        │
        ▼
  ┌─────────────────┐
  │  Try ERP login   │───── ERP available ───▶ ERP session (existing flow)
  │  (existing API)  │
  └────────┬────────┘
           │ ERP unreachable
           ▼
  ┌─────────────────┐
  │  Try local login  │───── credentials valid ───▶ Local demo session
  │  (Rust command)   │
  └────────┬────────┘
           │ Invalid
           ▼
      Show error
```

## 1. Rust Backend Changes

### 1.1 Cargo.toml

Add dependency:
```toml
bcrypt = "0.16"
```

### 1.2 New Tauri Commands

All commands in `src-tauri/src/lib.rs`:

| Command | Input | Output | Behavior |
|---|---|---|---|
| `hash_password` | `password: String` | `Result<String, String>` | bcrypt hash, cost 12 |
| `verify_password` | `password: String, hash: String` | `Result<bool, String>` | Compare plaintext vs stored hash |
| `register_local_user` | `username, email, password, full_name: String` | `Result<UserJson, String>` | Hash pw, INSERT into `users`, create session, return user + session token |
| `login_local_user` | `username, password: String` | `Result<Option<LoginResult>, String>` | Find user by username, verify hash, create session row, return user + token |
| `seed_demo_users` | `app_handle: AppHandle` | `Result<(), String>` | Called from `.setup()`. Insert admin + demo user if they don't exist |

### 1.3 LoginResult Struct (Rust)

```rust
struct LoginResult {
    user: UserJson,
    session_token: String,
}

struct UserJson {
    id: i64,
    username: String,
    email: String,
    full_name: String,
    role: String,
    is_active: bool,
}
```

### 1.4 Pre-seeded Demo Users

Created in `seed_demo_users` on every app startup (uses `INSERT OR IGNORE`):

| username | password | role | full_name | email |
|---|---|---|---|---|
| `admin` | `admin` | `admin` | Administrator | admin@timesync.local |
| `user` | `user` | `user` | Demo User | user@timesync.local |

### 1.5 Session Management (Local)

Local sessions use a UUID v4 as the `session_token`, stored in the existing `sessions` table. The `access_token` column stores the UUID. Local sessions have `expires_at = NULL` (no expiry for demo).

### 1.6 Setup Hook

In `tauri::Builder::default().setup(|app| { ... })`:
1. Run `seed_demo_users(app.handle())` to ensure demo users exist
2. This runs after the SQL plugin is initialized and migrations are applied

## 2. Database Changes

### 2.1 Migration v4

```sql
ALTER TABLE users ADD COLUMN password_hash TEXT;
```

Migrations defined in `src-tauri/src/lib.rs`, append to the existing migrations vec.

## 3. Frontend Changes

### 3.1 Auth Store (`src/features/auth/store.ts`)

**New state:**
```typescript
interface AuthState {
  // existing state...
  authMode: 'auto' | 'demo' | 'erp';
}
```

**`authMode` behavior:**
- `auto` (default): Try ERP first, fall back to local SQLite on network error
- `demo`: Force local SQLite auth only
- `erp`: Force ERP auth only

**Modified `login` action:**
```typescript
login: async (username: string, password: string) => {
  if (authMode === 'erp') {
    return loginViaErp(username, password);
  }
  if (authMode === 'demo') {
    return loginViaLocal(username, password);
  }
  // auto mode: try ERP, fall back to local
  const erpResult = await tryLoginViaErp(username, password);
  if (erpResult.success) return erpResult;
  return loginViaLocal(username, password);
}
```

**Modified `checkSession` action:**
- Check both secure store (ERP tokens) and local sessions table
- Restore whichever is valid

**New `register` action:**
```typescript
register: async (username, email, password, fullName) => {
  // 1. Register locally via Rust command
  const localResult = await invoke('register_local_user', { ... });
  // 2. Best-effort ERP registration
  try {
    await registerViaErp(username, email, password, fullName);
  } catch { /* non-blocking */ }
  // 3. Auto-login
  set({ user: localResult.user, sessionToken: localResult.session_token });
}
```

**New `switchMode` action:**
```typescript
switchMode: (mode: 'auto' | 'demo' | 'erp') => {
  set({ authMode: mode });
  // logout if switching modes
  logout();
}
```

### 3.2 Login Page Changes

File: `src/features/auth/components/LoginPage.tsx`

- Add a small mode indicator below the form: "Demo Mode" / "ERP Mode" / "Auto (ERP→Demo)"
- Add a toggle button to switch modes
- Keep existing login form unchanged
- Add "Create account" link pointing to `/register`
- On login failure in auto mode, show which backends were tried

### 3.3 New Register Page

File: `src/features/auth/components/RegisterPage.tsx`

```
┌──────────────────────────────┐
│         Create Account        │
│                              │
│  Username     [____________] │
│  Email        [____________] │
│  Full Name    [____________] │
│  Password     [____________] │
│  Confirm Pw   [____________] │
│                              │
│  [Create Account]            │
│                              │
│  Already have an account?    │
│  Sign in                     │
└──────────────────────────────┘
```

**Validation rules:**
- Username: 3-32 chars, alphanumeric + underscore
- Email: valid email format
- Full Name: 1-128 chars
- Password: min 6 chars
- Confirm Password: must match

**States:** idle → loading → success (redirect) / error (show message)

Uses existing shadcn/ui primitives: Card, Input, Label, Button, Separator.

### 3.4 New Route

In `src/routes/index.tsx`:
```typescript
{ path: "/register", element: <RegisterPage /> }
```

Place it before the catch-all `/` route. Public access (no auth required).

### 3.5 Demo Mode Indicator

Add a small badge to the TopBar component showing current mode:
- "Demo Mode" badge when using local auth
- "ERP" badge when using ERP auth
- Badge is subtle (small text, muted color)

## 4. File Change Summary

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Add `bcrypt` dependency |
| `src-tauri/src/lib.rs` | Add migrations v4, 5 new Tauri commands, setup hook |
| `src/features/auth/store.ts` | Add dual-mode, register action, switchMode |
| `src/features/auth/components/LoginPage.tsx` | Mode toggle, fallback logic, register link |
| `src/features/auth/components/RegisterPage.tsx` | New file — registration form |
| `src/routes/index.tsx` | Add `/register` route |
| `src/components/topbar.tsx` | Add mode indicator badge |
| `src-tauri/db/migrations/004_add_password_hash.sql` | New migration file |

No new npm dependencies. No new shadcn/ui components needed.

## 5. Error Handling

- **ERP unreachable**: Log warning, continue with local auth. Toast notification: "ERP server unreachable — using demo mode"
- **Registration fails locally**: Return error from Rust command, show in form
- **Registration succeeds locally but ERP fails**: Toast "Local account created — ERP sync failed", proceed with login
- **Login invalid (both modes)**: Generic "Invalid username or password" error
