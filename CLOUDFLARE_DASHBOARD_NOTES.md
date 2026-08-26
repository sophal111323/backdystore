# Cloudflare Bot / DDoS Protection Counters

This update adds Cloudflare Security Events to the admin home dashboard and the daily Telegram report.

## What it shows

- Origin Requests / 1d: requests that reached the Next.js app and were logged in `RequestLog`.
- Cloudflare Protected / 1d: Cloudflare security events with blocking or challenge actions.
- Blocked: events with block-like actions.
- Challenged: events with challenge-like actions.
- Bot-related: events from bot-related Cloudflare sources.
- DDoS / Rate-limit: events from DDoS or rate-limit-related Cloudflare sources.
- Top actions, top sources, top IPs, top paths, and latest sampled events.

## Required env variables

```env
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_ZONE_ID=""
```

Create a Cloudflare API token with read-only analytics/security permissions, then paste it into Vercel/Render environment variables.

## Important note

Cloudflare blocks some traffic at the edge before it reaches your app, so your own database cannot count those blocked requests by itself. This update uses Cloudflare GraphQL Analytics API to read Cloudflare-side security events.

Cloudflare Security Events are events, not always a perfect one-request count. One HTTP request can trigger more than one security event.
