# Cloudflare Telegram Threshold Alerts

This project now has a cron route that checks today's Cloudflare protection/security events and sends Telegram alerts when a milestone is crossed.

## Route

```text
GET /api/cron/cloudflare-alert
```

The route must be called with one of these secrets:

```text
Authorization: Bearer <CRON_SECRET>
```

or

```text
x-cron-secret: <CRON_SECRET>
```

## Default alert levels

```text
1K, 10K, 20K, 50K, 100K, 200K, 500K, 1M, 2M, 5M, 10M, 20M
```

If Cloudflare jumps from 900 to 12,000 events, the bot sends one alert listing both 1K and 10K as newly crossed levels. Each level is only sent once per Cambodia day.

## ENV

```env
CLOUDFLARE_ALERT_THRESHOLDS="1K,10K,20K,50K,100K,200K,500K,1M,2M,5M,10M,20M"
CLOUDFLARE_ALERT_METRIC="protected"
```

Metric options:

- `protected` = block + managed challenge + challenge-style Cloudflare actions. Recommended default.
- `blocked` = block/managed block/connection close only.
- `bot` = events where Cloudflare source looks bot-related.
- `ddos` = events where Cloudflare source looks DDoS/rate-limit-related.
- `security` = all Cloudflare security events.

## Test

After deployment, run this with the real secret header to send a test message:

```text
/api/cron/cloudflare-alert?test=1
```

To force resend already-crossed thresholds for testing:

```text
/api/cron/cloudflare-alert?force=1
```

## Notes

Cloudflare-blocked traffic may never reach the Next.js app, so this uses Cloudflare GraphQL Analytics, not local middleware logs.
