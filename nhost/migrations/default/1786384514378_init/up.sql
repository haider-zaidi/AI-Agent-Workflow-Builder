-- This migration originated as leftover pg_dump session boilerplate
-- (\restrict/\unrestrict meta-commands, a transaction_timeout setting only
-- valid on Postgres 17+) with no actual schema content. The real schema
-- lives entirely in the 1786384927828_app_schema migration. A harmless no-op
-- statement is kept here (rather than an empty file) because Hasura's
-- migration runner treats a comment-only script as a fatal "empty query".
select 1;
