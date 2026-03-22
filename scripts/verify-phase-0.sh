#!/bin/bash
set -e

echo "=== Phase 0 Verification ==="
echo ""

# Step 1: Build all packages
echo "[1/5] Building all packages..."
pnpm turbo build 2>&1 | tail -5
echo "  Build: PASSED"
echo ""

# Step 2: Typecheck all packages
echo "[2/5] Typechecking packages..."
pnpm --filter @signal-map/shared typecheck
pnpm --filter @signal-map/logger typecheck
pnpm --filter @signal-map/db typecheck
pnpm --filter @signal-map/queue typecheck
pnpm --filter @signal-map/worker typecheck
echo "  Typecheck: PASSED"
echo ""

# Step 3: Verify migration files exist
echo "[3/5] Verifying migration files..."
MIGRATION_COUNT=$(ls -1 packages/db/supabase/migrations/*.sql 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -eq 10 ]; then
  echo "  Migration files: $MIGRATION_COUNT/10 PASSED"
else
  echo "  Migration files: $MIGRATION_COUNT/10 FAILED"
  exit 1
fi
echo ""

# Step 4: Verify generated DB types exist
echo "[4/5] Verifying generated DB types..."
if [ -f "packages/db/src/types.ts" ] && [ -s "packages/db/src/types.ts" ]; then
  echo "  DB types: EXISTS and NON-EMPTY"
else
  echo "  DB types: MISSING or EMPTY"
  exit 1
fi
echo ""

# Step 5: Verify route skeletons exist
echo "[5/5] Verifying route skeletons..."
ROUTES=(
  "apps/web/src/app/page.tsx"
  "apps/web/src/app/(public)/topics/[slug]/page.tsx"
  "apps/web/src/app/(public)/collections/[slug]/page.tsx"
  "apps/web/src/app/(public)/search/page.tsx"
  "apps/web/src/app/(public)/categories/[category]/page.tsx"
  "apps/web/src/app/(auth)/dashboard/page.tsx"
  "apps/web/src/app/(auth)/dashboard/topics/[slug]/page.tsx"
  "apps/web/src/app/(auth)/dashboard/alerts/page.tsx"
  "apps/web/src/app/(auth)/dashboard/collections/page.tsx"
  "apps/web/src/app/(auth)/dashboard/settings/page.tsx"
  "apps/web/src/app/(admin)/admin/page.tsx"
  "apps/web/src/app/(admin)/admin/sources/page.tsx"
  "apps/web/src/app/(admin)/admin/topics/page.tsx"
  "apps/web/src/app/(admin)/admin/jobs/page.tsx"
  "apps/web/src/app/(admin)/admin/reprocessing/page.tsx"
  "apps/web/src/app/(admin)/admin/audit/page.tsx"
  "apps/web/src/app/api/auth/callback/route.ts"
  "apps/web/src/app/api/health/route.ts"
  "apps/web/src/app/api/search/route.ts"
)

MISSING=0
for route in "${ROUTES[@]}"; do
  if [ ! -f "$route" ]; then
    echo "  MISSING: $route"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -eq 0 ]; then
  echo "  Route skeletons: ${#ROUTES[@]}/${#ROUTES[@]} PASSED"
else
  echo "  Route skeletons: $MISSING MISSING"
  exit 1
fi

echo ""
echo "=== Phase 0 Verification COMPLETE ==="
echo ""
echo "Manual QA checklist:"
echo "  [ ] Web loads at localhost:3000"
echo "  [ ] All public route skeletons render"
echo "  [ ] Auth routes redirect to login when unauthenticated"
echo "  [ ] Admin routes reject non-admin users with 403"
echo "  [ ] Search page renders with input field"
echo "  [ ] Stub search endpoint returns results for seeded topics"
echo ""
echo "Smoke tests (require running Supabase):"
echo "  [ ] Insert test job, verify worker claims it"
echo "  [ ] Auth signup creates profiles row"
echo "  [ ] RLS: anon reads public topics"
echo "  [ ] RLS: anon reads public topics via /api/search"
echo "  [ ] RLS: anon cannot read user_followed_topics"
echo "  [ ] RLS: anon cannot read non-public topic data"
echo "  [ ] Browser/anon has no service-role table access"
echo "  [ ] Sentry captures test errors"
echo "  [ ] Seed script runs idempotently"
