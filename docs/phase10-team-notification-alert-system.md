# Phase 10 - Team Notification and Alert System

## Architecture Design

Phase 10 adds a Notification Agent after GitHub publication. Analysis remains owned
by the existing agents; the notification layer evaluates policy, selects logical
routes, formats provider payloads, publishes webhooks, and records outcomes.

Workflow:

PR Event -> Planner -> Dependency -> Context/Rules -> Review -> Architecture ->
Risk Intelligence -> Smart Review -> Risk Summary -> GitHub Integration ->
Notification Agent -> Complete

## Folder Structure

- `src/services/notifications/slack`: Slack webhook client, formatter, publisher.
- `src/services/notifications/teams`: Teams webhook client, Adaptive Card formatter, publisher.
- `src/services/notifications/policies`: severity policy and system-based routing.
- `src/services/notifications/templates`: critical, high, medium, low-confidence, and architecture templates.
- `src/services/notifications/notificationPublisher.js`: provider dispatch and deduplication.
- `src/services/orchestration/agents/notification.agent.js`: LangGraph agent.

## Policy

- `LOW`: no risk notification.
- `MEDIUM`: optional through `NOTIFICATION_NOTIFY_MEDIUM_RISK`.
- `HIGH`: notify.
- `CRITICAL`: notify immediately.
- Confidence below `NOTIFICATION_LOW_CONFIDENCE_THRESHOLD`: manual-review notice.
- High or critical architecture impact: architecture alert.

`NOTIFICATION_MINIMUM_SEVERITY` can raise or lower the global threshold.

## Routing

Routing is configuration-driven. Signal matching selects logical route keys:

- Authentication and security signals -> `security`
- Database and persistence signals -> `backend`
- UI and client signals -> `frontend`
- High architectural impact -> `engineering`
- Otherwise -> `default`

`NOTIFICATION_ROUTES_JSON` maps those keys to Slack or Teams destinations. Route
entries should use `webhookEnv` to reference a secret environment variable:

```json
{
  "security": [
    {
      "provider": "slack",
      "webhookEnv": "SLACK_SECURITY_WEBHOOK_URL",
      "channel": "security"
    }
  ]
}
```

Catch-all `SLACK_WEBHOOK_URL` and `TEAMS_WEBHOOK_URL` values are used only when
no specific configured route matches.

## Reliability

- Invalid and insecure webhook URLs fail without crashing the review.
- HTTP 429 and transient 5xx responses use bounded exponential retries.
- Request timeouts are configurable.
- Destinations publish independently, allowing partial success.
- A deterministic key suppresses duplicate alerts in the running process for a
  configurable TTL. Production deployments can replace this in-memory store
  with Redis or a database-backed idempotency store.

## State

The LangGraph state and final report include:

- `notificationStatus`
- `notifiedChannels`
- `notificationPayloads`
- `notificationDecision`

## Example

Slack and Teams messages contain repository, PR number, risk score, severity,
affected systems, confidence, summary, and a GitHub PR link. Teams uses an
Adaptive Card payload; Slack uses Block Kit.

## Testing Strategy

- Unit-test policy thresholds and low-confidence behavior.
- Unit-test route selection and environment-based webhook resolution.
- Unit-test Slack Block Kit and Teams Adaptive Card payloads.
- Unit-test retry, invalid URL, partial failure, and duplicate suppression.
- Test the Notification Agent with fake publishers before sandbox webhook tests.
