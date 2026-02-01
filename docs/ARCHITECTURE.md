# IOU App Architecture Overview

## What Are These Technologies?

### **React** (The UI Library)
- **What it is**: A JavaScript library for building user interfaces
- **What it does**: Lets you create reusable components (like buttons, forms, dashboards) and manage UI state
- **In your app**: All your components (`App.tsx`, `IOUDashboard.tsx`, `AuthForm.tsx`, etc.) are React components

### **Vite** (The Build Tool & Dev Server)
- **What it is**: A fast build tool and development server
- **What it does**: 
  - **Development**: Runs a local server, watches for file changes, hot-reloads your app
  - **Production**: Bundles and optimizes your code for deployment
- **In your app**: When you run `npm run dev`, Vite starts a dev server and serves your React app

### **Next.js** (NOT USED - Was a duplicate)
- **What it is**: A React framework with server-side rendering
- **What it does**: Provides routing, API routes, and server-side features
- **In your app**: ❌ You're NOT using Next.js - those were duplicate folders we removed

## Repository Structure

```
iou-app/
├── index.html              # Entry HTML file (Vite looks for this)
├── vite.config.ts          # Vite configuration
├── package.json            # Dependencies and scripts
│
├── src/                    # Your React application code
│   ├── main.tsx           # Entry point - mounts React app to DOM
│   ├── App.tsx            # Main app component (handles auth, routing)
│   ├── components/        # React components
│   │   ├── AuthForm.tsx   # Login/signup form
│   │   ├── IOUDashboard.tsx  # Main IOU tracking interface
│   │   ├── FriendRequests.tsx # Friend management
│   │   └── ui/            # Reusable UI components (buttons, dialogs, etc.)
│   ├── lib/
│   │   └── supabase.ts    # Supabase client configuration
│   └── hooks/             # Custom React hooks
│
└── supabase/
    └── migrations/        # Database schema SQL files
```

## How It All Works Together

### 1. **When You Run `npm run dev`**

```
npm run dev
    ↓
Vite reads vite.config.ts
    ↓
Vite starts dev server (usually on http://localhost:5173)
    ↓
Vite serves index.html
    ↓
index.html loads /src/main.tsx
    ↓
main.tsx renders <App /> component
    ↓
App.tsx checks for user session via Supabase
    ↓
App shows either:
  - AuthForm (if not logged in)
  - IOUDashboard (if logged in)
```

### 2. **The Flow of Your App**

```
User opens browser
    ↓
index.html loads
    ↓
main.tsx executes → Creates React app
    ↓
App.tsx component renders:
    ├─ Checks Supabase auth session
    ├─ If no session → Shows AuthForm
    ├─ If session but no profile → Prompts for username
    └─ If session + profile → Shows IOUDashboard
    ↓
User interacts with components
    ↓
Components call Supabase client (from lib/supabase.ts)
    ↓
Supabase handles:
    - Authentication (login/signup)
    - Database queries (IOUs, friends, notifications)
    - Real-time subscriptions (live updates)
```

## Supabase Integration

### **What is Supabase?**
Supabase is a Backend-as-a-Service (BaaS) that provides:
- **Authentication**: User login/signup
- **Database**: PostgreSQL database (hosted in the cloud)
- **Real-time**: Live updates when data changes
- **Storage**: File storage (not used in your app)

### **How Your App Uses Supabase**

#### 1. **Authentication** (`src/lib/supabase.ts`)
```typescript
// Creates a Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// In App.tsx:
supabase.auth.getSession()        // Check if user is logged in
supabase.auth.onAuthStateChange() // Listen for login/logout events
```

#### 2. **Database Operations**
Your app queries these tables (defined in `supabase/migrations/`):
- **`profiles`**: User profiles (username, etc.)
- **`friendships`**: Friend relationships
- **`ious`**: IOU records (who owes what)
- **`notifications`**: User notifications

Example from your components:
```typescript
// Get IOUs
const { data } = await supabase
  .from('ious')
  .select('*')
  .eq('from_user_id', userId)

// Create IOU
await supabase
  .from('ious')
  .insert([{ from_user_id, to_user_id, amount, description }])
```

#### 3. **Real-time Subscriptions**
Your app listens for live updates:
```typescript
supabase
  .channel('ious')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ious' })
  .subscribe((payload) => {
    // Update UI when new IOU is created
  })
```

## Environment Variables

Vite reads from `.env` file (you need to create this):
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

These are loaded by `vite.config.ts` and made available as `import.meta.env.VITE_SUPABASE_URL`

## Key Files Explained

### `index.html`
- The single HTML page that loads your React app
- Has `<div id="root">` where React mounts
- Loads `/src/main.tsx` as a module

### `src/main.tsx`
- Entry point for React
- Uses `createRoot()` to mount `<App />` component to the DOM
- Runs once when page loads

### `src/App.tsx`
- Main application component
- Manages authentication state
- Routes between different views (IOUs vs Friends)
- Handles username setup for new users

### `src/lib/supabase.ts`
- Creates and exports the Supabase client
- Configures authentication settings
- Defines TypeScript types for your data models

### `vite.config.ts`
- Configures Vite build tool
- Sets up React plugin
- Configures path aliases (`@` → `./src`)
- Loads environment variables

## Development Workflow

1. **Start dev server**: `npm run dev`
   - Vite watches for file changes
   - Auto-reloads browser when you save

2. **Make changes**: Edit files in `src/`
   - React components update automatically
   - No need to refresh manually

3. **Build for production**: `npm run build`
   - Vite bundles and optimizes code
   - Outputs to `dist/` folder

4. **Preview production build**: `npm run preview`
   - Tests the production build locally

## Summary

- **React**: Builds your UI components
- **Vite**: Serves and builds your app (replaces Create React App)
- **Supabase**: Handles backend (auth + database)
- **TypeScript**: Adds type safety to JavaScript
- **Tailwind CSS**: Styles your components

Your app is a **Single Page Application (SPA)** - all the logic runs in the browser, and it communicates with Supabase's cloud services for data storage and authentication.
