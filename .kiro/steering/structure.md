# Project Structure

## Root Directory
```
├── .env                    # Environment variables (local)
├── .env.example           # Environment template
├── .env.production        # Production environment
├── package.json           # Dependencies and scripts
├── next.config.ts         # Next.js configuration
├── tsconfig.json          # TypeScript configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── components.json        # shadcn/ui configuration
└── README.md              # Project documentation
```

## Source Code (`src/`)
```
src/
├── app/                   # Next.js App Router
│   ├── api/              # API routes
│   │   ├── meta/         # Meta Ads API endpoints
│   │   ├── clients/      # Client management APIs
│   │   └── debug/        # Development debug APIs
│   ├── dashboard/        # Main dashboard pages
│   │   ├── clients/      # Client management UI
│   │   ├── meta/         # Meta Ads management
│   │   ├── analytics/    # Analytics dashboard
│   │   └── reports/      # Reporting interface
│   └── meta/             # Meta OAuth flow pages
├── components/           # React components
│   ├── ui/              # shadcn/ui components
│   ├── dashboard/       # Dashboard-specific components
│   ├── meta/            # Meta Ads components
│   └── reports/         # Reporting components
├── lib/                 # Utility libraries
│   ├── supabase/        # Database client configuration
│   ├── meta/            # Meta API client and types
│   └── utils.ts         # General utilities
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
└── middleware.ts        # Next.js middleware
```

## Database (`database/`)
```
database/
├── complete-schema.sql        # Full database schema
├── meta-ads-schema.sql       # Meta Ads specific tables
├── fix-rls-policies.sql      # RLS policy fixes
├── check-rls-policies.sql    # RLS verification queries
└── reset-and-create.sql      # Database reset script
```

## Scripts (`scripts/`)
```
scripts/
├── setup.ps1                 # Initial project setup
├── simple-restart.bat        # Quick restart (Windows)
├── restart-system.ps1        # Full system restart
├── system-check.ps1          # Health check script
├── monitor.ps1               # System monitoring
├── check-env.js              # Environment validation
└── README.md                 # Scripts documentation
```

## Documentation (`docs/`)
```
docs/
├── META_INTEGRATION.md       # Complete Meta integration guide
├── SETUP_META_ADS.md        # Meta Ads setup instructions
└── prompt.md                # AI prompt templates
```

## Architecture Patterns

### API Routes
- **Client-specific operations**: Always include `clientId` parameter
- **Authentication**: Use Supabase auth middleware
- **Error handling**: Consistent error response format
- **Validation**: Zod schemas for request validation

### Components
- **UI Components**: Located in `src/components/ui/` (shadcn/ui)
- **Feature Components**: Organized by domain (dashboard, meta, reports)
- **Naming**: PascalCase for components, kebab-case for files
- **Props**: TypeScript interfaces for all component props

### Database Access
- **Client isolation**: All queries filtered by `client_id`
- **RLS policies**: Database-level security enforcement
- **Supabase client**: Use server/client variants appropriately
- **Transactions**: Use for multi-table operations

### File Naming Conventions
- **Pages**: `page.tsx` (App Router convention)
- **API Routes**: `route.ts` (App Router convention)
- **Components**: `component-name.tsx`
- **Utilities**: `kebab-case.ts`
- **Types**: `types.ts` or `index.ts`

### Import Aliases
```typescript
@/*           # src/*
@/components  # src/components
@/lib         # src/lib
@/hooks       # src/hooks
@/types       # src/types
```

## Security Considerations
- **Client Data Isolation**: Every operation must validate client ownership
- **RLS Policies**: Database-level security for all client data
- **Environment Variables**: Never commit sensitive data
- **API Authentication**: Verify user permissions on every request