# CS-14 Smoke / E2E Coverage

This smoke suite validates the conversational Campaign Squad flow locally against Docker.

## Scenarios

- Happy path without client context
- Happy path with client context
- QA loop limit to `needs_manual_intervention`
- Publish failure with failure recorded

## Commands

Run all CS-14 scenarios:

```bash
cd apps/campaign-squad-service
npm run smoke:cs14
```

Run individual scenarios:

```bash
npm run smoke:cs14:happy
npm run smoke:cs14:with-context
npm run smoke:cs14:qa-limit
npm run smoke:cs14:publish-failure
```

## Environment

The script expects the local stack to be running and reads the service role credentials from the root `.env` and the app `.env`.

Default endpoints:

- Campaign Squad service: `http://localhost:4010`
- Dashboard API: `http://localhost:3000/api/campaign-squad`

## QA limit note

The QA loop-limit scenario uses a fixture row in `campaign_squad.campaign_runs` because the current service runtime keeps active run state in memory, which makes forced loop exhaustion non-deterministic from the public API alone. The fixture still exercises the persisted contract and dashboard visibility for `needs_manual_intervention`.
