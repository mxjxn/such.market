-- Migration: 0000_initial_schema.sql
-- Description: Initial database schema for cryptoart-mini-app
-- Created: 2024-03-21

-- Enable necessary extensions
create extension if not exists "uuid-ossp";

-- Collections table
create table collections (
    id uuid primary key default uuid_generate_v4(),
    contract_address text not null unique,
    name text not null,
    token_type text not null check (token_type in ('ERC721', 'ERC1155')),
    total_supply bigint,
    verified boolean default false,
    last_refresh_at timestamp with time zone,
    refresh_cooldown_until timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- NFTs table
create table nfts (
    id uuid primary key default uuid_generate_v4(),
    collection_id uuid references collections(id) on delete cascade,
    token_id text not null,
    title text,
    description text,
    image_url text,
    thumbnail_url text,
    metadata jsonb,
    attributes jsonb,
    media jsonb,
    owner_address text,
    last_owner_check_at timestamp with time zone,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    -- Composite unique constraint to prevent duplicates
    unique(collection_id, token_id)
);

-- Collection traits table for efficient filtering
create table collection_traits (
    id uuid primary key default uuid_generate_v4(),
    collection_id uuid references collections(id) on delete cascade,
    trait_type text not null,
    trait_value text not null,
    token_ids text[] not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    -- Composite unique constraint
    unique(collection_id, trait_type, trait_value)
);

-- Indexes for performance
create index idx_collections_contract_address on collections(contract_address);
create index idx_nfts_collection_id on nfts(collection_id);
create index idx_nfts_token_id on nfts(token_id);
create index idx_nfts_owner_address on nfts(owner_address);
create index idx_collection_traits_collection_id on collection_traits(collection_id);
create index idx_collection_traits_trait_type_value on collection_traits(trait_type, trait_value);

-- Full text search indexes
create index idx_collections_name_fts on collections using gin(to_tsvector('english', name));
create index idx_nfts_title_fts on nfts using gin(to_tsvector('english', title));
create index idx_nfts_description_fts on nfts using gin(to_tsvector('english', description));

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_collections_updated_at
    before update on collections
    for each row
    execute function update_updated_at_column();

create trigger update_nfts_updated_at
    before update on nfts
    for each row
    execute function update_updated_at_column();

create trigger update_collection_traits_updated_at
    before update on collection_traits
    for each row
    execute function update_updated_at_column();

-- Function to handle collection refresh cooldown
create or replace function set_collection_refresh_cooldown()
returns trigger as $$
begin
    new.refresh_cooldown_until = now() + interval '30 minutes';
    return new;
end;
$$ language plpgsql;

-- Trigger for refresh cooldown
create trigger set_collection_refresh_cooldown
    before update of last_refresh_at on collections
    for each row
    when (old.last_refresh_at is distinct from new.last_refresh_at)
    execute function set_collection_refresh_cooldown(); 