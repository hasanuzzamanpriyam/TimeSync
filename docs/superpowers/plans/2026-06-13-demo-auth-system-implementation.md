# Demo Auth System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dual-mode auth (ERP + local SQLite fallback) with demo user pre-seeding, registration, and bcrypt password hashing.

**Architecture:** Rust Tauri commands handle all password hashing and local auth (using `bcrypt`, `rusqlite`, `uuid`). The Zustand auth store gains an `authMode` toggle (`auto`/`demo`/`erp`) and a `register` action. Migration v4 adds `password_hash` column to the `users` table. Two pre-seeded demo users (`admin`/`admin`, `user`/`user`) are inserted on startup.

**Tech Stack:** Tauri v2 (Rust), React 18 + shadcn/ui + Zustand, bcrypt 0.16, rusqlite 0.31, uuid 1

---

### Task 1: Add Rust Dependencies + Migration v4

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Create: `src-tauri/db/migrations/004_add_password_hash.sql`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add deps to Cargo.toml**

```
- [ ] **Step 1: Add deps to Cargo.toml**

```toml
# After the serde_json line, add:
bcrypt = "0.16"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
```

- [ ] **Step 2: Create migration v4 SQL**

Create `src-tauri/db/migrations/004_add_password_hash.sql`:

```sql
ALTER TABLE users ADD COLUMN password_hash TEXT;
```

- [ ] **Step 3: Register migration v4 in lib.rs**

Edit `src-tauri/src/lib.rs`. Add migration v4 to the migrations vec:

```rust
Migration {
    version: 4,
    description: "add password_hash column to users",
    sql: include_str!("../db/migrations/004_add_password_hash.sql"),
    kind: MigrationKind::Up,
},
```

---

### Task 2: Add Rust Auth Commands + Pre-seed Hook

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write the full lib.rs with auth commands**

Replace `src-tauri/src/lib.rs` content:

```rust
use rusqlite::Connection;
use serde::Serialize;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize)]
struct UserJson {
    id: i64,
    username: String,
    email: String,
    full_name: String,
    role: String,
    is_active: bool,
}

#[derive(Serialize)]
struct LoginResult {
    user: UserJson,
    session_token: String,
}

fn get_db_path(app_handle: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_dir.join("timesync.db"))
}

#[tauri::command]
fn hash_password(password: String) -> Result<String, String> {
    bcrypt::hash(&password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())
}

#[tauri::command]
fn verify_password(password: String, hash: String) -> Result<bool, String> {
    bcrypt::verify(&password, &hash).map_err(|e| e.to_string())
}

#[tauri::command]
fn register_local_user(
    app_handle: tauri::AppHandle,
    username: String,
    email: String,
    password: String,
    full_name: String,
) -> Result<LoginResult, String> {
    let db_path = get_db_path(&app_handle)?;
    let conn = Connection::open(&db_path).map_err(|e| format!("DB open error: {}", e))?;

    let password_hash =
        bcrypt::hash(&password, bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
    let session_token = uuid::Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO users (username, email, role, full_name, is_active, password_hash) VALUES (?1, ?2, 'user', ?3, 1, ?4)",
        rusqlite::params![username, email, full_name, password_hash],
    )
    .map_err(|e| format!("Failed to create user: {}", e))?;

    let user_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO sessions (user_id, access_token, refresh_token, expires_at, is_remember_me) VALUES (?1, ?2, ?2, '2099-12-31 23:59:59', 1)",
        rusqlite::params![user_id, session_token],
    )
    .map_err(|e| format!("Failed to create session: {}", e))?;

    let user = UserJson {
        id: user_id,
        username,
        email,
        full_name,
        role: "user".to_string(),
        is_active: true,
    };

    Ok(LoginResult {
        user,
        session_token,
    })
}

#[tauri::command]
fn login_local_user(
    app_handle: tauri::AppHandle,
    username: String,
    password: String,
) -> Result<Option<LoginResult>, String> {
    let db_path = get_db_path(&app_handle)?;
    let conn = Connection::open(&db_path).map_err(|e| format!("DB open error: {}", e))?;

    let result = conn
        .query_row(
            "SELECT id, username, email, full_name, role, is_active, password_hash FROM users WHERE username = ?1 AND is_active = 1",
            rusqlite::params![username],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, bool>(5)?,
                    row.get::<_, Option<String>>(6)?,
                ))
            },
        );

    match result {
        Ok((id, uname, email, full_name, role, is_active, pw_hash_opt)) => {
            let pw_hash = match pw_hash_opt {
                Some(h) => h,
                None => return Ok(None),
            };

            let valid =
                bcrypt::verify(&password, &pw_hash).map_err(|e| e.to_string())?;
            if !valid {
                return Ok(None);
            }

            let session_token = uuid::Uuid::new_v4().to_string();

            conn.execute(
                "INSERT INTO sessions (user_id, access_token, refresh_token, expires_at, is_remember_me) VALUES (?1, ?2, ?2, '2099-12-31 23:59:59', 1)",
                rusqlite::params![id, session_token],
            )
            .map_err(|e| format!("Failed to create session: {}", e))?;

            Ok(Some(LoginResult {
                user: UserJson {
                    id,
                    username: uname,
                    email,
                    full_name,
                    role,
                    is_active,
                },
                session_token,
            }))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("DB query error: {}", e)),
    }
}

#[tauri::command]
fn seed_demo_users(app_handle: tauri::AppHandle) -> Result<(), String> {
    let db_path = get_db_path(&app_handle)?;
    let conn = Connection::open(&db_path).map_err(|e| format!("DB open error: {}", e))?;

    let admin_hash =
        bcrypt::hash("admin", bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;
    let user_hash =
        bcrypt::hash("user", bcrypt::DEFAULT_COST).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR IGNORE INTO users (username, email, role, full_name, is_active, password_hash) VALUES ('admin', 'admin@timesync.local', 'admin', 'Administrator', 1, ?1)",
        rusqlite::params![admin_hash],
    )
    .map_err(|e| format!("Failed to seed admin: {}", e))?;

    conn.execute(
        "INSERT OR IGNORE INTO users (username, email, role, full_name, is_active, password_hash) VALUES ('user', 'user@timesync.local', 'user', 'Demo User', 1, ?1)",
        rusqlite::params![user_hash],
    )
    .map_err(|e| format!("Failed to seed user: {}", e))?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../db/migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create tasks, time_entries, activity_logs tables",
            sql: include_str!("../db/migrations/002_tasks_timer.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create sync_queue table",
            sql: include_str!("../db/migrations/003_sync.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add password_hash column to users",
            sql: include_str!("../db/migrations/004_add_password_hash.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:timesync.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            if let Err(e) = seed_demo_users(app.handle()) {
                eprintln!("Failed to seed demo users: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            hash_password,
            verify_password,
            register_local_user,
            login_local_user,
            seed_demo_users,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### Task 3: Modify Auth Store - Dual Mode + Register

**Files:**
- Modify: `src/features/auth/store.ts`

- [ ] **Step 1: Write the updated store.ts**

```typescript
import { create } from "zustand";
import { User } from "@/types";
import { authApi } from "@/services/api/auth";
import { secureStorage } from "@/services/storage/secure";
import { initDatabase } from "@/lib/db";
import { invoke } from "@tauri-apps/api/core";

type AuthMode = "auto" | "demo" | "erp";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  authMode: AuthMode;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  checkSession: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
  register: (username: string, email: string, password: string, fullName: string) => Promise<void>;
  switchMode: (mode: AuthMode) => void;
}

interface LoginResult {
  user: User;
  session_token: string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  authMode: "auto",

  login: async (username, password, _rememberMe = false) => {
    set({ isLoading: true, error: null });
    const { authMode } = get();

    try {
      if (authMode === "erp") {
        await loginViaErp(username, password, set);
        return;
      }

      if (authMode === "demo") {
        await loginViaLocal(username, password, set);
        return;
      }

      // auto mode: try ERP, fall back to local
      try {
        await loginViaErp(username, password, set);
      } catch {
        await loginViaLocal(username, password, set);
      }
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || "Login failed",
      });
      throw err;
    }
  },

  register: async (username, email, password, fullName) => {
    set({ isLoading: true, error: null });
    try {
      const result = await invoke<LoginResult>("register_local_user", {
        username,
        email,
        password,
        fullName,
      });

      await secureStorage.setTokens(result.session_token, result.session_token);

      const db = await initDatabase();
      await db.execute(
        `INSERT OR REPLACE INTO users (id, username, email, role, full_name, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))`,
        [
          result.user.id,
          result.user.username,
          result.user.email,
          result.user.role,
          result.user.full_name,
          result.user.is_active ? 1 : 0,
        ],
      );

      set({
        user: result.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      // Best-effort ERP registration
      try {
        const { authApi } = await import("@/services/api/auth");
        await authApi.register(username, email, password, fullName);
      } catch {
        // Non-blocking
      }
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || "Registration failed",
      });
      throw err;
    }
  },

  switchMode: (mode) => {
    set({ authMode: mode });
    get().logout();
  },

  logout: async () => {
    try {
      await secureStorage.clearTokens();
      await authApi.logout();
    } catch {
      // ignore
    } finally {
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  refreshToken: async () => {
    try {
      const currentRefreshToken = await secureStorage.getRefreshToken();
      if (!currentRefreshToken) throw new Error("No refresh token");

      const response = await authApi.refresh(currentRefreshToken);
      await secureStorage.setTokens(
        response.access_token,
        response.refresh_token,
      );
    } catch {
      await get().logout();
    }
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const accessToken = await secureStorage.getAccessToken();
      if (!accessToken) {
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }

      const db = await initDatabase();
      const result = await db.select<Record<string, any>[]>(
        "SELECT u.* FROM users u INNER JOIN sessions s ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1",
      );

      if (result.length > 0) {
        const row = result[0];
        set({
          user: {
            id: row.id,
            username: row.username,
            email: row.email,
            role: row.role,
            full_name: row.full_name,
            avatar_url: row.avatar_url ?? undefined,
            is_active: row.is_active === 1,
            erp_id: row.erp_id ?? undefined,
            created_at: row.created_at,
            updated_at: row.updated_at,
          },
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false, isAuthenticated: false, user: null });
      }
    } catch {
      set({ isLoading: false, isAuthenticated: false, user: null });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  clearError: () => set({ error: null }),
}));

async function loginViaErp(
  username: string,
  password: string,
  set: (state: Partial<AuthState>) => void,
): Promise<void> {
  const response = await authApi.login(username, password);
  const db = await initDatabase();

  await secureStorage.setTokens(
    response.access_token,
    response.refresh_token,
  );

  await db.execute(
    `INSERT OR REPLACE INTO users (id, username, email, role, full_name, avatar_url, is_active, erp_id, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, datetime('now'))`,
    [
      response.user.id,
      response.user.username,
      response.user.email,
      response.user.role,
      response.user.full_name,
      response.user.avatar_url ?? null,
      response.user.is_active ? 1 : 0,
      response.user.erp_id ?? null,
    ],
  );

  set({
    user: response.user,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}

async function loginViaLocal(
  username: string,
  password: string,
  set: (state: Partial<AuthState>) => void,
): Promise<void> {
  const result = await invoke<LoginResult | null>("login_local_user", {
    username,
    password,
  });

  if (!result) {
    throw new Error("Invalid username or password");
  }

  await secureStorage.setTokens(result.session_token, result.session_token);

  const db = await initDatabase();
  await db.execute(
    `INSERT OR REPLACE INTO users (id, username, email, role, full_name, is_active, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, datetime('now'))`,
    [
      result.user.id,
      result.user.username,
      result.user.email,
      result.user.role,
      result.user.full_name,
      result.user.is_active ? 1 : 0,
    ],
  );

  set({
    user: result.user,
    isAuthenticated: true,
    isLoading: false,
    error: null,
  });
}
```

- [ ] **Step 2: Add register method to authApi**

Edit `src/services/api/auth.ts`:

```typescript
register: async (
  username: string,
  email: string,
  password: string,
  fullName: string,
): Promise<void> => {
  await api.post("/auth/register", {
    username,
    email,
    password,
    full_name: fullName,
  });
},
```

Add this method before the closing `}` of the `authApi` object.

---

### Task 4: Create RegisterPage

**Files:**
- Create: `src/features/auth/components/RegisterPage.tsx`

- [ ] **Step 1: Write RegisterPage component**

```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Clock } from "lucide-react";

export function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const validate = (): boolean => {
    if (username.length < 3 || username.length > 32) {
      setValidationError("Username must be 3-32 characters");
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setValidationError("Username can only contain letters, numbers, and underscores");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError("Invalid email address");
      return false;
    }
    if (fullName.length < 1 || fullName.length > 128) {
      setValidationError("Full name must be 1-128 characters");
      return false;
    }
    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters");
      return false;
    }
    if (password !== confirmPassword) {
      setValidationError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError("");
    if (!validate()) return;

    try {
      await register(username, email, password, fullName);
      navigate("/dashboard");
    } catch {
      // error is set in store
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            Register for a new account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="myusername"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {(validationError || error) && (
              <p className="text-sm text-destructive">
                {validationError || error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Task 5: Modify LoginPage - Mode Toggle + Register Link

**Files:**
- Modify: `src/features/auth/components/LoginPage.tsx`

- [ ] **Step 1: Update LoginPage with mode toggle and register link**

```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Clock } from "lucide-react";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const { login, isLoading, error, clearError, authMode, switchMode } =
    useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await login(username, password, rememberMe);
      navigate("/dashboard");
    } catch {
      // error is set in store
    }
  };

  const modeLabel = {
    auto: "Auto (ERP → Demo)",
    demo: "Demo",
    erp: "ERP",
  };

  const nextMode: Record<string, "demo" | "erp" | "auto"> = {
    auto: "demo",
    demo: "erp",
    erp: "auto",
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">TimeSync</CardTitle>
          <CardDescription>
            Sign in to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username or Email</Label>
              <Input
                id="username"
                type="text"
                placeholder="username@example.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-gray-300"
              />
              <Label htmlFor="remember" className="text-sm font-normal">
                Remember me
              </Label>
            </div>
            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-6 px-2"
                onClick={() => switchMode(nextMode[authMode])}
                disabled={isLoading}
              >
                Mode: {modeLabel[authMode]}
              </Button>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary hover:underline">
              Create one
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Task 6: Add /register Route

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Import and add route**

Add import at the top:
```tsx
import { RegisterPage } from "@/features/auth/components/RegisterPage";
```

Add the route entry, right after the `/login` route:
```tsx
{
  path: "/register",
  element: <RegisterPage />,
},
```

---

### Task 7: TopBar Mode Indicator Badge

**Files:**
- Modify: `src/components/topbar.tsx`

- [ ] **Step 1: Add mode indicator to TopBar**

Update the `TopBar` component. Add mode import and badge:

```tsx
import { useAuthStore } from "@/features/auth/store";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sun,
  Moon,
  LogOut,
  User,
  Bell,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export function TopBar() {
  const { user, logout, authMode } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const modeBadgeVariant: Record<string, "outline" | "secondary" | "default"> = {
    demo: "secondary",
    erp: "default",
    auto: "outline",
  };

  const modeBadgeLabel: Record<string, string> = {
    demo: "Demo",
    erp: "ERP",
    auto: "Auto",
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        {authMode && (
          <Badge variant={modeBadgeVariant[authMode]} className="text-[10px] px-1.5 py-0 h-5">
            {modeBadgeLabel[authMode]}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user?.full_name}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {user?.role}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              className="text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

---

### Self-Review

**1. Spec coverage:**
- [x] Rust deps (bcrypt, rusqlite, uuid) — Task 1
- [x] Migration v4 (password_hash column) — Task 1
- [x] Tauri commands (hash_password, verify_password, register_local_user, login_local_user, seed_demo_users) — Task 2
- [x] Pre-seeded demo users (admin/admin, user/user) — Task 2 setup hook
- [x] Dual-mode auth store (authMode, login, register, switchMode) — Task 3
- [x] Modified LoginPage (mode toggle, register link) — Task 5
- [x] New RegisterPage — Task 4
- [x] /register route — Task 6
- [x] TopBar mode indicator badge — Task 7
- [x] authApi.register method — Task 3 Step 2

**2. Placeholder scan:** No TBDs, TODOs, or vague steps. All code is concrete and complete.

**3. Type consistency:**
- `LoginResult` in Rust matches `LoginResult` interface in TS (user, session_token)
- `UserJson` in Rust matches `User` interface in TS (id, username, email, full_name, role, is_active)
- `register_local_user` command signature matches invoke call in store
- `login_local_user` command returns `Option<LoginResult>` matching the store's null check
- `AuthMode` type (`auto`|`demo`|`erp`) consistent across store, LoginPage, TopBar
- `switchMode` takes the same mode strings it reads back
- Badge variants match mode values consistently
