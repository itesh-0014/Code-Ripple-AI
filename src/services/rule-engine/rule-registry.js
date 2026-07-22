import { backendRules } from './rules/backend.rules.js';
import { frontendRules } from './rules/frontend.rules.js';
import { generalRules } from './rules/general.rules.js';

export const ruleRegistry = [
  ...backendRules,
  ...frontendRules,
  ...generalRules,
];

export function getRuleCatalog() {
  return ruleRegistry.map(rule => ({
    id: rule.id,
    name: rule.name,
    category: rule.category,
    severity: rule.severity,
    description: rule.description,
    recommendation: rule.recommendation,
  }));
}
