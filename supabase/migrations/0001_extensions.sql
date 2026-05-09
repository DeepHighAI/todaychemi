-- supabase/migrations/0001_extensions.sql
create extension if not exists "pgcrypto";
create extension if not exists "vector";
create extension if not exists "pg_cron";
