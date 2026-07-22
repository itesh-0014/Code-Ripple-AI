export const PR_SIZE_CLASSIFICATION = Object.freeze({
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE',
});

export const SMART_REVIEW_MODE = Object.freeze({
  FULL_REVIEW: 'FULL REVIEW',
  PRIORITIZED_REVIEW: 'PRIORITIZED REVIEW',
  RISK_FIRST_REVIEW: 'RISK-FIRST REVIEW',
});

export const REVIEW_DEPTH = Object.freeze({
  DEEP: 'DEEP',
  STANDARD: 'STANDARD',
  LIGHT: 'LIGHT',
});

export const PR_SIZE_LIMITS = Object.freeze({
  smallMaxFiles: 10,
  mediumMaxFiles: 30,
});

export function classifyPRSize(changedFileCount = 0) {
  if (changedFileCount <= PR_SIZE_LIMITS.smallMaxFiles) {
    return PR_SIZE_CLASSIFICATION.SMALL;
  }

  if (changedFileCount <= PR_SIZE_LIMITS.mediumMaxFiles) {
    return PR_SIZE_CLASSIFICATION.MEDIUM;
  }

  return PR_SIZE_CLASSIFICATION.LARGE;
}

export function selectReviewMode(prSize) {
  if (prSize === PR_SIZE_CLASSIFICATION.SMALL) {
    return SMART_REVIEW_MODE.FULL_REVIEW;
  }

  if (prSize === PR_SIZE_CLASSIFICATION.MEDIUM) {
    return SMART_REVIEW_MODE.PRIORITIZED_REVIEW;
  }

  return SMART_REVIEW_MODE.RISK_FIRST_REVIEW;
}

