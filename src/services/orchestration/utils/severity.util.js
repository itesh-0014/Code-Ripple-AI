export const SEVERITY_RANK = {
  INFO: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export function normalizeSeverity(value) {
  const normalizedValue = String(value || 'info').toUpperCase();

  if (normalizedValue === 'CRITICAL') {
    return 'CRITICAL';
  }

  if (normalizedValue === 'HIGH') {
    return 'HIGH';
  }

  if (normalizedValue === 'MEDIUM') {
    return 'MEDIUM';
  }

  if (normalizedValue === 'LOW') {
    return 'LOW';
  }

  return 'INFO';
}

export function chooseHighestSeverity(values = []) {
  const normalizedValues = values
    .filter(Boolean)
    .map(normalizeSeverity);

  if (normalizedValues.length === 0) {
    return 'INFO';
  }

  return normalizedValues.sort(
    (left, right) => SEVERITY_RANK[right] - SEVERITY_RANK[left]
  )[0];
}
