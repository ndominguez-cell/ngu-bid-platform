-- ============================================================
-- Estimate takeoff metadata (2026-07-02)
-- Adds a structured `takeoff` column to estimates so the AI takeoff's
-- confidence, assumptions, exclusions, missing documents, and the list of
-- documents actually analyzed can be surfaced in the UI — kept separate from
-- the user-editable `notes` field so human edits never clobber it.
-- Safe to re-run. Run in: Supabase > SQL Editor > New Query > Run All.
-- ============================================================

alter table estimates
  add column if not exists takeoff jsonb not null default '{}'::jsonb;
