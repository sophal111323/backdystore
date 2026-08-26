# Step 5 — Dynamic Website Data + Auto Refresh

This step keeps JASMINTOPUP connected to the same backend/database used by the future Flutter admin app.

## What changed

- Added cached public data helpers with Next.js cache tags:
  - `lib/publicData.ts`
  - `lib/publicVersion.ts`
- Added public data version endpoint:
  - `GET /api/public/version?scope=home`
  - `GET /api/public/version?scope=game&slug=mobile-legends`
  - `GET /api/public/version?scope=faq`
  - `GET /api/public/version?scope=settings`
  - `GET /api/public/version?scope=order&orderNumber=RT-XXXXXX`
- Added client-side polling refresh component:
  - `components/PublicDataRefresh.tsx`
- Homepage, game detail page, FAQ page, root layout, announcement bar, footer and maintenance gate now receive updates through dynamic database reads, cache tags, and polling refresh.
- Public API cache headers are now shorter/dynamic for customer-visible data.
- Admin revalidation now revalidates public paths, root layout and cache tags after admin updates.

## Expected behavior

When admin updates games, products, banners, FAQ, settings, announcement, maintenance mode or support links:

1. Admin API updates PostgreSQL through Prisma.
2. Admin API writes audit log.
3. Admin API calls `revalidateAdminChange(...)`.
4. Next.js revalidates the related paths/tags.
5. Open public pages poll `/api/public/version` and call `router.refresh()` when data changes.
6. Customer-facing website shows the latest data without editing website files.

## Test checklist

1. Run:
   ```bash
   npm install
   npx prisma generate
   npm run dev
   ```

2. Open homepage in browser.
3. Log in to admin.
4. Edit a banner or disable a game.
5. Keep homepage open and wait around 15 seconds.
6. Homepage should refresh its server data automatically.
7. Edit announcement or maintenance mode in admin.
8. Public pages should pick up settings changes within around 10–20 seconds.

## Environment

Optional:

```env
PUBLIC_DATA_REVALIDATE_SECONDS="10"
```

Lower values make customer pages update faster but can increase database/cache activity.
