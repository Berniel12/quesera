-- Enable RLS on oracle_rate_limits for defense in depth
-- Only service role should access this table (no permissive policies)
alter table oracle_rate_limits enable row level security;
