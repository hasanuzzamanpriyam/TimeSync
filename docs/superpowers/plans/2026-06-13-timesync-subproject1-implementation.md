# TimeSync Sub-project 1: Scaffold + Auth + UI Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Tauri v2 + React + TypeScript project scaffold with authentication, routing, and a professional UI shell.

**Architecture:** Tauri v2 desktop shell wrapping a Vite + React SPA. SQLite via `@tauri-apps/plugin-sql` stores user/session data locally. Zustand manages auth state. Axios interceptors handle JWT auth with refresh token support. ShadCN UI + Tailwind CSS provide the design system.

**Tech Stack:** Tauri v2, React 18, TypeScript, Vite, Tailwind CSS, ShadCN UI, Zustand, React Router v6, Axios, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-store`

**Spec reference:** `docs/superpowers/specs/2026-06-13-timesync-subproject1-design.md`

---

### Task 1: Scaffold Tauri v2 Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/icons/` (default icons)
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `src/vite-env.d.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create Tauri project using the CLI**

```bash
npm create tauri-app@latest timesync -- --template react-ts --manager npm
```

If the above interactive command is an issue, scaffold manually via:

```bash
mkdir -p timesync/src timesync/src-tauri/src timesync/src-tauri/icons timesync/src-tauri/capabilities timesync/public
cd timesync
```

Then create `package.json`:

```json
{
  "name": "timesync",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-sql": "^2.0.0",
    "@tauri-apps/plugin-store": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["vite.config.ts"]
}
```

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TimeSync</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

`src/App.tsx`:

```tsx
function App() {
  return <h1>TimeSync</h1>;
}

export default App;
```

`src/index.css`:

```css
:root {
  font-family: Inter, Avenir, Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  color: #0f0f0f;
  background-color: #f6f6f6;
}

body {
  margin: 0;
  padding: 0;
}
```

`src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

`src-tauri/Cargo.toml`:

```toml
[package]
name = "timesync"
version = "0.1.0"
description = "TimeSync - Time Tracking Application"
authors = ["you"]
edition = "2021"

[lib]
name = "timesync_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

`src-tauri/build.rs`:

```rust
fn main() {
    tauri_build::build()
}
```

`src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    timesync_lib::run()
}
```

`src-tauri/src/lib.rs`:

```rust
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create initial tables",
            sql: include_str!("../db/migrations/001_initial.sql"),
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Create `src-tauri/db/migrations/001_initial.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('employee','manager','admin')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  is_active INTEGER DEFAULT 1,
  erp_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  is_remember_me INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL UNIQUE,
  last_synced_at TEXT,
  last_sync_status TEXT DEFAULT 'pending'
);
```

`src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/nicedarg/tauri/main/crates/tauri-config-schema/schema.json",
  "productName": "TimeSync",
  "version": "0.1.0",
  "identifier": "com.timesync.app",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "TimeSync",
        "width": 1280,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "minWidth": 900,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

`src-tauri/capabilities/default.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/nicedarg/tauri/main/crates/tauri-utils/schema.json",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select",
    "store:default"
  ]
}
```

`.gitignore`:

```
node_modules/
dist/
src-tauri/target/
.DS_Store
*.log
```

- [ ] **Step 2: Install npm dependencies**

```bash
npm install
```

- [ ] **Step 3: Verify the project builds**

```bash
npm run tauri build
```

Expected: Tauri builds successfully, produces executable in `src-tauri/target/release/`.

---

### Task 2: Install Frontend Dependencies (Tailwind, ShadCN, Router, Axios, Zustand)

**Files:**
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `components.json`
- Modify: `src/index.css`
- Modify: `package.json`

- [ ] **Step 1: Install Tailwind CSS and PostCSS**

```bash
npm install -D tailwindcss @tailwindcss/vite postcss autoprefixer
```

Create `tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
```

Create `postcss.config.js`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 2: Install remaining frontend dependencies**

```bash
npm install react-router-dom zustand axios @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react tailwindcss-animate next-themes sonner @tanstack/react-table
```

- [ ] **Step 3: Initialize ShadCN and create `components.json`**

```bash
npx shadcn@latest init
```

Or manually create `components.json`:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 4: Set up CSS variables for light/dark themes in `src/index.css`**

Replace existing content:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
    --sidebar-primary: 240 5.9% 10%;
    --sidebar-primary-foreground: 0 0% 98%;
    --sidebar-accent: 240 4.8% 95.9%;
    --sidebar-accent-foreground: 240 5.9% 10%;
    --sidebar-border: 220 13% 91%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --sidebar-background: 240 5.9% 10%;
    --sidebar-foreground: 240 4.8% 95.9%;
    --sidebar-primary: 224.3 76.3% 48%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 240 3.7% 15.9%;
    --sidebar-accent-foreground: 240 4.8% 95.9%;
    --sidebar-border: 240 3.7% 15.9%;
    --sidebar-ring: 217.2 91.2% 59.8%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 5: Add path alias to `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
```

---

### Task 3: Add ShadCN UI Primitives

**Files:**
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/avatar.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/separator.tsx`
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/ui/sonner.tsx`
- Create: `src/components/ui/form.tsx`

- [ ] **Step 1: Create the utility function**

`src/lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create Button component**

`src/components/ui/button.tsx`:

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

- [ ] **Step 3: Create Input component**

`src/components/ui/input.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
```

- [ ] **Step 4: Create Label component**

`src/components/ui/label.tsx`:

```tsx
import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
);

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```

- [ ] **Step 5: Create Card component**

`src/components/ui/card.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
```

- [ ] **Step 6: Install remaining Radix dependencies and create remaining components**

ShadCN components can be added via CLI or copied from ShadCN's registry. Run:

```bash
npx shadcn@latest add dropdown-menu avatar badge separator sheet sonner
```

This will create all remaining UI primitives automatically with their Radix dependencies.

---

### Task 4: Set Up TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Define all shared types**

`src/types/index.ts`:

```ts
export type UserRole = "employee" | "manager" | "admin";

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_url?: string;
  is_active: boolean;
  erp_id?: number;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_remember_me: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  expires_in: number;
}

export interface ApiError {
  message: string;
  status: number;
  code?: string;
}
```

---

### Task 5: Set Up Zustand Auth Store

**Files:**
- Create: `src/features/auth/store.ts`

- [ ] **Step 1: Create the auth store**

`src/features/auth/store.ts`:

```ts
import { create } from "zustand";
import { User } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  checkSession: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (username, password, rememberMe = false) => {
    set({ isLoading: true, error: null });
    try {
      const { authApi } = await import("@/services/api/auth");
      const response = await authApi.login(username, password);
      const { secureStorage } = await import("@/services/storage/secure");
      const { db } = await import("@/lib/db");

      await secureStorage.setTokens(
        response.access_token,
        response.refresh_token,
      );

      // Upsert user into local DB
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
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || "Login failed",
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      const { secureStorage } = await import("@/services/storage/secure");
      await secureStorage.clearTokens();
      const { authApi } = await import("@/services/api/auth");
      await authApi.logout().catch(() => {});
    } finally {
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  refreshToken: async () => {
    try {
      const { secureStorage } = await import("@/services/storage/secure");
      const { authApi } = await import("@/services/api/auth");

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
      const { secureStorage } = await import("@/services/storage/secure");
      const { db } = await import("@/lib/db");

      const accessToken = await secureStorage.getAccessToken();
      if (!accessToken) {
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }

      // Try to restore user from local DB
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
```

---

### Task 6: Set Up Database Connection

**Files:**
- Create: `src/lib/db.ts`

- [ ] **Step 1: Create the database service**

`src/lib/db.ts`:

```ts
import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:timesync.db");
  return db;
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export { db };
```

---

### Task 7: Set Up Secure Storage Service

**Files:**
- Create: `src/services/storage/secure.ts`

- [ ] **Step 1: Create the secure storage wrapper**

`src/services/storage/secure.ts`:

```ts
import { Store } from "@tauri-apps/plugin-store";

const TOKEN_STORE = "tokens.json";
const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

let store: Store | null = null;

async function getStore(): Promise<Store> {
  if (!store) {
    store = await Store.load(TOKEN_STORE);
  }
  return store;
}

export const secureStorage = {
  setTokens: async (accessToken: string, refreshToken: string) => {
    const s = await getStore();
    await s.set(ACCESS_TOKEN_KEY, accessToken);
    await s.set(REFRESH_TOKEN_KEY, refreshToken);
    await s.save();
  },

  getAccessToken: async (): Promise<string | null> => {
    const s = await getStore();
    return s.get<string>(ACCESS_TOKEN_KEY);
  },

  getRefreshToken: async (): Promise<string | null> => {
    const s = await getStore();
    return s.get<string>(REFRESH_TOKEN_KEY);
  },

  clearTokens: async () => {
    const s = await getStore();
    await s.delete(ACCESS_TOKEN_KEY);
    await s.delete(REFRESH_TOKEN_KEY);
    await s.save();
  },
};
```

---

### Task 8: Set Up API Service Layer

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/services/api/auth.ts`

- [ ] **Step 1: Create the Axios instance with interceptors**

`src/lib/api.ts`:

```ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { secureStorage } from "@/services/storage/secure";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — attach access token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await secureStorage.getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor — handle 401 with token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (token) {
      prom.resolve(token);
    } else {
      prom.reject(error);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { authApi } = await import("@/services/api/auth");
        const refreshToken = await secureStorage.getRefreshToken();
        if (!refreshToken) throw new Error("No refresh token");

        const response = await authApi.refresh(refreshToken);
        await secureStorage.setTokens(
          response.access_token,
          response.refresh_token,
        );

        processQueue(null, response.access_token);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${response.access_token}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        const { useAuthStore } = await import("@/features/auth/store");
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
```

- [ ] **Step 2: Create the Auth API service**

`src/services/api/auth.ts`:

```ts
import api from "@/lib/api";
import { AuthResponse, User } from "@/types";

export const authApi = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/auth/login", {
      username,
      password,
    });
    return data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Silently fail — we clear local state regardless
    }
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const { data } = await api.post<AuthResponse>("/auth/refresh", {
      refresh_token: refreshToken,
    });
    return data;
  },

  me: async (): Promise<User> => {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },
};
```

---

### Task 9: Build Login Page

**Files:**
- Create: `src/features/auth/components/LoginPage.tsx`

- [ ] **Step 1: Create the Login Page component**

`src/features/auth/components/LoginPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const { login, isLoading, error, clearError } = useAuthStore();
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
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### Task 10: Build Protected Route

**Files:**
- Create: `src/features/auth/components/ProtectedRoute.tsx`

- [ ] **Step 1: Create the ProtectedRoute wrapper**

`src/features/auth/components/ProtectedRoute.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/features/auth/store";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
```

---

### Task 11: Build UI Shell — Theme Provider

**Files:**
- Create: `src/components/theme-provider.tsx`

- [ ] **Step 1: Create the theme provider**

`src/components/theme-provider.tsx`:

```tsx
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "timesync-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme,
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
```

---

### Task 12: Build UI Shell — Sidebar

**Files:**
- Create: `src/components/sidebar.tsx`

- [ ] **Step 1: Create the Sidebar component**

`src/components/sidebar.tsx`:

```tsx
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/store";
import {
  LayoutDashboard,
  ListChecks,
  Timer,
  BarChart3,
  Settings,
  ChevronLeft,
  Clock,
  Users,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["employee", "manager", "admin"] },
  { to: "/tasks", label: "Tasks", icon: ListChecks, roles: ["employee", "manager", "admin"] },
  { to: "/timer", label: "Timer", icon: Timer, roles: ["employee", "manager", "admin"] },
  { to: "/reports", label: "Reports", icon: BarChart3, roles: ["employee", "manager", "admin"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuthStore();

  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.role),
  );

  return (
    <aside
      className={cn(
        "flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Clock className="h-6 w-6 shrink-0 text-sidebar-primary" />
        {!collapsed && (
          <span className="font-semibold text-sidebar-primary">
            TimeSync
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full"
        >
          <ChevronLeft
            className={cn(
              "h-5 w-5 transition-transform",
              collapsed && "rotate-180",
            )}
          />
        </Button>
      </div>
    </aside>
  );
}
```

---

### Task 13: Build UI Shell — TopBar

**Files:**
- Create: `src/components/topbar.tsx`

- [ ] **Step 1: Create the TopBar component**

`src/components/topbar.tsx`:

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

export function TopBar() {
  const { user, logout } = useAuthStore();
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

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-6">
      <div className="flex items-center gap-2">
        <h2 className="text-sm text-muted-foreground">
          {/* Breadcrumb placeholder */}
        </h2>
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

### Task 14: Build UI Shell — AppLayout

**Files:**
- Create: `src/components/app-layout.tsx`

- [ ] **Step 1: Create the AppLayout component**

`src/components/app-layout.tsx`:

```tsx
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

---

### Task 15: Set Up Routing

**Files:**
- Create: `src/routes/index.tsx`

- [ ] **Step 1: Create the route configuration**

`src/routes/index.tsx`:

```tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { LoginPage } from "@/features/auth/components/LoginPage";
import { ProtectedRoute, AdminRoute } from "@/features/auth/components/ProtectedRoute";

// Placeholder pages for later sub-projects
function DashboardPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-muted-foreground">Dashboard will be built in Sub-project 3.</p>
    </div>
  );
}

function TasksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Tasks</h1>
      <p className="text-muted-foreground">Task management will be built in Sub-project 2.</p>
    </div>
  );
}

function TimerPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Timer</h1>
      <p className="text-muted-foreground">Time tracking will be built in Sub-project 2.</p>
    </div>
  );
}

function ReportsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Reports</h1>
      <p className="text-muted-foreground">Reports will be built in Sub-project 3.</p>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <p className="text-muted-foreground">Settings will be built in Sub-project 4.</p>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "dashboard",
            element: <DashboardPage />,
          },
          {
            path: "tasks",
            element: <TasksPage />,
          },
          {
            path: "timer",
            element: <TimerPage />,
          },
          {
            path: "reports",
            element: <ReportsPage />,
          },
        ],
      },
    ],
  },
  {
    path: "/",
    element: <AdminRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: "settings",
            element: <SettingsPage />,
          },
        ],
      },
    ],
  },
]);
```

---

### Task 16: Wire Everything Together in App.tsx

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Update `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Update `src/App.tsx`**

```tsx
import { RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { router } from "@/routes";
import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/store";
import { Toaster } from "@/components/ui/sonner";

function AppContent() {
  const checkSession = useAuthStore((state) => state.checkSession);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return <RouterProvider router={router} />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="timesync-ui-theme">
      <AppContent />
      <Toaster richColors />
    </ThemeProvider>
  );
}

export default App;
```

---

### Task 17: Build and Verify

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 2: Run Vite build**

```bash
npm run build
```

Expected: Build succeeds, output in `dist/`.

- [ ] **Step 3: Run Tauri build to verify desktop app compiles**

```bash
npm run tauri build
```

Expected: Tauri builds successfully, produces binary in `src-tauri/target/release/`.

---

## Self-Review Checklist

- [x] **Spec coverage:** Auth flow ✓, Login page ✓, UI Shell ✓, Routing ✓, Database schema ✓, Theming ✓, Secure storage ✓
- [x] **No placeholders:** Every step has complete code. No "TBD", "TODO", or vague instructions.
- [x] **Type consistency:** `User`, `Session`, `AuthResponse`, `UserRole` types used consistently across all files.
- [x] **Scope:** Only Sub-project 1 deliverables. No task CRUD, timer, attendance, or reporting code.
