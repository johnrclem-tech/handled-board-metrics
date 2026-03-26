# Handled Board Metrics - Project Rules

## UI Component Rules
- **ONLY use ShadCN components and ShadCN Studio blocks** for all UI elements
- Do NOT use raw HTML elements when a ShadCN component exists (buttons, inputs, cards, tables, etc.)
- All components are in `src/components/ui/`
- Use the `cn()` utility from `@/lib/utils` for className merging

## ShadCN Studio
- **License Key**: AF0D706A-7DA6-4334-9F97-E288C0C2C5D1
- **Email**: john@handledcommerce.com
- Use ShadCN Studio blocks when available for complex UI patterns (dashboards, data tables, charts, etc.)

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with ShadCN CSS variables
- **Database**: Neon (Vercel Postgres) with Drizzle ORM
- **Charts**: Recharts
- **Excel Parsing**: xlsx (SheetJS)
- **Icons**: Lucide React

## Database
- Schema is defined in `src/lib/db/schema.ts` using Drizzle ORM
- Database client in `src/lib/db/index.ts`
- Drizzle config in `drizzle.config.ts`
- Connection string via `DATABASE_URL` env var
- Run `npx drizzle-kit push` to apply schema changes
- Run `npx drizzle-kit generate` to generate migrations

## Project Structure
```
src/
  app/              # Next.js app router pages and API routes
    api/            # API endpoints (upload, metrics, uploads)
  components/       # React components
    ui/             # ShadCN UI primitives
  lib/              # Utilities, database, parsers
    db/             # Database schema and client
```

## Data Flow
1. User uploads QuickBooks Excel exports via the Import Data tab
2. Excel files are parsed by `src/lib/excel-parser.ts`
3. Parsed data is stored in Neon Postgres via Drizzle ORM
4. KPI dashboard reads from the database via API routes
5. Future: Direct QuickBooks API integration will replace manual uploads

## Deployment
- Deploy on Vercel
- Add `DATABASE_URL` to Vercel environment variables
- Database provisioned via Vercel Storage (Neon Postgres)
