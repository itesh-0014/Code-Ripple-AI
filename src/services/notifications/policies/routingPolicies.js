import { config } from '../../../config/env.js';

const SECURITY_PATTERN = /auth|security|permission|protected|identity|session|token|jwt/i;
const DATABASE_PATTERN = /database|data|storage|schema|migration|model|repository/i;
const FRONTEND_PATTERN = /frontend|ui|component|react|client|browser/i;

export function determineNotificationRoutes(state, routesConfig = config.notifications) {
  const routeKeys = determineRouteKeys(state);
  const configuredRoutes = routeKeys.flatMap(routeKey =>
    normalizeRouteEntries(routesConfig.routes?.[routeKey], routeKey)
  );
  const routes = configuredRoutes.length
    ? configuredRoutes
    : buildDefaultRoutes(routesConfig.defaultWebhooks);

  return deduplicateRoutes(routes.map(route => ({
    ...route,
    webhookUrl: resolveWebhookUrl(route),
  })));
}

export function determineRouteKeys(state) {
  const signals = collectSignals(state);
  const keys = [];

  if (signals.some(signal => SECURITY_PATTERN.test(signal))) keys.push('security');
  if (signals.some(signal => DATABASE_PATTERN.test(signal))) keys.push('backend');
  if (signals.some(signal => FRONTEND_PATTERN.test(signal))) keys.push('frontend');

  if (
    ['HIGH', 'CRITICAL'].includes(
      String(
        state.reviewSummary?.architectureImpact ||
        state.architectureAnalysis?.architecturalRisk ||
        ''
      ).toUpperCase()
    )
  ) {
    keys.push('engineering');
  }

  return keys.length ? [...new Set(keys)] : ['default'];
}

function collectSignals(state) {
  return [
    ...(state.reviewSummary?.affectedSystems || []),
    ...(state.architectureAnalysis?.criticalSystemsAffected || []),
    ...(state.changedFiles || []).map(file => file.filename),
    ...(state.affectedModules || []).map(module =>
      typeof module === 'string' ? module : module.path || module.name
    ),
  ]
    .map(String)
    .filter(Boolean);
}

function normalizeRouteEntries(entries, routeKey) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter(entry => entry && ['slack', 'teams'].includes(entry.provider))
    .map(entry => ({
      ...entry,
      routeKey,
      channel: entry.channel || routeKey,
    }));
}

function buildDefaultRoutes(defaultWebhooks = {}) {
  return Object.entries(defaultWebhooks)
    .filter(([, webhookUrl]) => Boolean(webhookUrl))
    .map(([provider, webhookUrl]) => ({
      provider,
      webhookUrl,
      routeKey: 'default',
      channel: 'default',
    }));
}

function resolveWebhookUrl(route) {
  return route.webhookUrl || (route.webhookEnv ? process.env[route.webhookEnv] : null);
}

function deduplicateRoutes(routes) {
  const seen = new Set();

  return routes.filter(route => {
    const key = [
      route.provider,
      route.webhookUrl || route.webhookEnv || route.channel,
    ].join(':');

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
