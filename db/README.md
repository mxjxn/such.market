# Database Setup

This directory contains all database-related files for the cryptoart-mini-app project.

## Structure

- `migrations/`: SQL migration files
  - `0001_seed_initial_data.sql`: Initial seed data
  - `0002_add_user_nft_cache.sql`: Legacy user NFT cache table
  - `0003_create_normalized_ownership_tables.sql`: New normalized ownership system
  - `0004_migrate_existing_ownership_data.sql`: Data migration to normalized tables
  - `0005_remove_user_nft_cache.sql`: Remove legacy table (optional)
- `seed/`: TypeScript seed scripts
- `types/`: Database type definitions
- `OPTIMIZATION_README.md`: Detailed optimization documentation

## Database Schema

The database consists of the following tables:

### Core Tables
- `collections`: Stores NFT collection metadata
- `nfts`: Stores individual NFT data with ownership info
- `collection_traits`: Stores trait data for efficient filtering
- `fc_users`: Stores Farcaster user data

### Normalized Ownership Tables (New)
- `nft_ownership`: Individual NFT ownership tracking
- `user_collections`: Auto-maintained user collection summaries
- `wallet_collection_mapping`: Wallet-to-collection relationships

### Legacy Tables (Deprecated)
- `user_nft_cache`: Legacy caching table (being phased out)

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

This will push all migrations to your Supabase database.

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

## Optimization

This database has been optimized for performance and scalability:

- **Normalized ownership tracking**: Replaces inefficient JSONB storage
- **Automatic triggers**: Maintain data consistency automatically
- **Proper indexing**: Optimized for common query patterns
- **Hierarchical caching**: Redis cache with multiple TTL tiers

See `OPTIMIZATION_README.md` for detailed optimization documentation.

## Type Safety

Database types are automatically generated and maintained in `types/database.types.ts`. These types are used throughout the application for type-safe database operations.

## Monitoring

Use the ownership statistics endpoint to monitor database health:

```bash
curl "https://your-domain.com/api/admin/ownership/stats"
```

This provides real-time statistics about the normalized ownership system. 