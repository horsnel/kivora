-- v5.24.5 — device-side push receipt telemetry (survives page close)
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_receipt jsonb;
