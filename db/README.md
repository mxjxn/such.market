# Database Setup

This directory contains all database-related files for the cryptoart-mini-app project.

## Structure

- `migrations/`: SQL migration files
  - `0000_initial_schema.sql`: Initial database schema
  - `0001_seed_initial_data.sql`: Initial seed data
- `seed/`: TypeScript seed scripts
- `types/`: Database type definitions

## Setup

1. Create a Supabase project through Vercel
2. Get your database connection string from Supabase
3. Add the following to your `.env.local`:
   ```
   DATABASE_URL=your_supabase_connection_string
   ```

## Running Migrations

Migrations are automatically run during deployment through Vercel. To run them locally:

```bash
pnpm db:migrate
```

## Seeding Data

To seed the database with initial data:

```bash
pnpm db:seed
```

## Development

When making database changes:

1. Create a new migration file in `migrations/` with the next sequential number
2. Update the types in `types/database.types.ts`
3. Test the migration locally
4. Commit and push - migrations will run automatically on deployment

## Database Schema

The database consists of three main tables:

- `collections`: Stores NFT collection metadata
- `nfts`: Stores individual NFT data
- `collection_traits`: Stores trait data for efficient filtering

See `migrations/0000_initial_schema.sql` for the complete schema. 