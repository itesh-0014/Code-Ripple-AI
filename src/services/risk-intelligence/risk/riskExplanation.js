export function generateRiskExplanation({ riskScore, riskLevel, factors = [] }) {
  const contributingFactors = factors
    .filter(factor => factor.score > 0)
    .sort((left, right) => right.score - left.score)
    .flatMap(factor => factor.reasons || [])
    .filter(unique)
    .slice(0, 8);
  const leadFactors = contributingFactors.slice(0, 3);
  const riskExplanation =
    leadFactors.length > 0
      ? `${riskLevel} risk (${riskScore}/10) is driven by ${joinNaturalLanguage(leadFactors)}.`
      : `${riskLevel} risk (${riskScore}/10) was calculated with no material risk factors detected.`;

  return {
    riskExplanation,
    contributingFactors,
  };
}

function joinNaturalLanguage(values) {
  if (values.length === 1) return values[0].toLowerCase();
  if (values.length === 2) return `${values[0].toLowerCase()} and ${values[1].toLowerCase()}`;

  return `${values
    .slice(0, -1)
    .map(value => value.toLowerCase())
    .join(', ')}, and ${values.at(-1).toLowerCase()}`;
}

function unique(value, index, values) {
  return values.indexOf(value) === index;
}
