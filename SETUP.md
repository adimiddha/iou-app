# Setup Guide for IOU App

## Prerequisites

You need Node.js installed (you have v25.2.1 ✅)

## Step 1: Install Dependencies

Run this command in your terminal from the project root:

```bash
npm install
```

**If npm install fails or times out, try:**
- Check your internet connection
- Try: `npm install --legacy-peer-deps`
- Or: `npm install --no-optional`
- If still failing, try: `npm install --verbose` to see detailed logs

**Expected output:** You should see packages being downloaded and a `node_modules/` folder created.

## Step 2: Create Environment File (Optional but Recommended)

Create a `.env` file in the root directory:

```bash
touch .env
```

Add your Supabase credentials (if you have them):

```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**Note:** Your `supabase.ts` file has fallback values hardcoded, so the app will work without `.env`, but it's better practice to use environment variables.

## Step 3: Run the Development Server

Once dependencies are installed, run:

```bash
npm run dev
```

**Expected output:**
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open `http://localhost:5173/` in your browser.

## Troubleshooting

### "vite: command not found"
- **Cause:** Dependencies not installed
- **Fix:** Run `npm install` first

### npm install fails/times out
- Check internet connection
- Try: `npm install --legacy-peer-deps`
- Try: `npm cache clean --force` then `npm install`
- Check if you're behind a corporate firewall/proxy

### Port 5173 already in use
- Kill the process using that port, or
- Run: `npm run dev -- --port 3000` to use a different port

### Module not found errors
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

## What Gets Installed

When you run `npm install`, it installs:

**Dependencies (runtime):**
- `react` & `react-dom` - UI framework
- `@supabase/supabase-js` - Supabase client
- `lucide-react` - Icons

**Dev Dependencies (build tools):**
- `vite` - Build tool and dev server
- `typescript` - Type checking
- `tailwindcss` - CSS framework
- `@vitejs/plugin-react` - React support for Vite

All these go into the `node_modules/` folder.
