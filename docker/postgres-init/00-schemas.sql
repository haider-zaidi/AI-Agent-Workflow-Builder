-- The official Nhost postgres image pre-creates these schemas; the vanilla
-- postgres image used here doesn't, so hasura-auth's own migrations (which
-- create everything under `auth`) fail on a fresh database without this.
create extension if not exists pgcrypto;
create schema if not exists auth;
create schema if not exists storage;
