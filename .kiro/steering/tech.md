# Technology Stack

## Core Framework
- **Next.js 16.0.7** - React framework with App Router
- **React 19** - UI library with latest features
- **TypeScript 5** - Type-safe development

## ⚠️ Next.js 15/16 Breaking Changes
- `createClient()` do Supabase é **assíncrono** - SEMPRE use `await`
- `cookies()` é assíncrono - use `await cookies()`
- Todas as funções de server-side precisam de `await` para acessar headers/cookies
- `middleware.ts` está deprecated - usar `proxy` no lugar (Next.js 16+)

## Database & Backend
- **Supabase** - PostgreSQL database with built-in auth
- **Row Level Security (RLS)** - Database-level security policies
- **Supabase Auth** - Authentication and user management

## UI & Styling
- **Tailwind CSS 3.4** - Utility-first CSS framework
- **shadcn/ui** - Component library (New York style)
- **Radix UI** - Headless UI primitives
- **Lucide React** - Icon library
- **Recharts** - Data visualization

## External APIs
- **Meta Marketing API** - Facebook Ads integration
- **Facebook Business SDK** - Node.js SDK for Meta APIs
- **Google APIs** - Google Ads integration

## Development Tools
- **pnpm** - Package manager
- **ESLint** - Code linting
- **PostCSS** - CSS processing

## Common Commands

### Development
```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm lint             # Run ESLint
```

### Project Scripts
```bash
pnpm setup            # Initial project setup (PowerShell)
pnpm restart          # Quick restart (batch)
pnpm restart-full     # Full system restart (PowerShell)
pnpm check            # System health check
pnpm check-env        # Validate environment variables
pnpm monitor          # Monitor system status
```

### Database
- Use Supabase SQL Editor for schema changes
- Execute `database/complete-schema.sql` for full setup
- Apply RLS policies from `database/` folder

## Environment Variables
Required variables in `.env`:
- `META_APP_ID`, `META_APP_SECRET` - Meta API credentials
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase config
- `NEXT_PUBLIC_APP_URL` - Application URL for OAuth callbacks