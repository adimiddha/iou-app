# IOU Tracker App

A React + Vite application for tracking IOUs (favors) with friends - beers, rides, meals, and more.

## Tech Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Backend**: Supabase (Authentication & Database)
- **Styling**: Tailwind CSS

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the result.

## Environment Variables

Create a `.env` file in the root directory with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Project Structure

```
src/
├── components/        # React components
│   ├── AuthForm.tsx
│   ├── IOUDashboard.tsx
│   ├── FriendRequests.tsx
│   └── ui/           # UI component library
├── lib/              # Utilities and Supabase client
├── hooks/            # Custom React hooks
└── App.tsx           # Main application component
```
