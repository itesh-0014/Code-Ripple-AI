export function logPhase5Report(report) {
  if (!report?.aiReview) {
    console.log('\nPhase 5 AI review was not requested.');
    return;
  }

  const review = report.aiReview;

  console.log('\n================ PHASE 5 AI REVIEW ENGINE ================');

  if (review.status === 'failed') {
    console.log('Phase 5 failed safely.');
    console.log(review.error.message);

    if (review.instructions?.length) {
      console.log('\nFix:');
      review.instructions.forEach(instruction => {
        console.log(`- ${instruction}`);
      });
    }

    return;
  }

  console.log(`Model: ${review.model.provider}/${review.model.model}`);
  console.log(`Risk level: ${review.riskLevel}`);
  console.log(`Confidence: ${review.confidence}%`);
  console.log(`Changed files: ${review.changedFiles.length}`);
  console.log(`Affected systems: ${review.affectedSystems.length}`);
  console.log(`Findings: ${review.findings.length}`);
  console.log(`Suggestions: ${review.remediationPlan.length}`);

  console.log('\nSummary:');
  console.log(review.summary);

  console.log('\nAffected Systems:');
  printList(review.affectedSystems);

  console.log('\nTop Findings:');

  if (review.findings.length === 0) {
    console.log('- No concrete AI or deterministic findings.');
  } else {
    review.findings.slice(0, 10).forEach(finding => {
      const location = finding.filePath
        ? ` at ${finding.filePath}${finding.line ? `:${finding.line}` : ''}`
        : '';

      console.log(
        `- [${finding.severity}] ${finding.title}${location}`
      );
      console.log(`  ${finding.description}`);

      if (finding.recommendation) {
        console.log(`  Fix: ${finding.recommendation}`);
      }
    });
  }

  console.log('\nSuggested Remediation:');
  review.remediationPlan.slice(0, 10).forEach(suggestion => {
    console.log(`- [${suggestion.priority}] ${suggestion.title}`);
    suggestion.actions.slice(0, 3).forEach(action => {
      console.log(`  - ${action}`);
    });
  });

  console.log('\nReadable Review Report:\n');
  console.log(review.readableReport);
  console.log('\nPhase 5 complete: architecture-aware AI review generated.');
}

function printList(values) {
  if (!values?.length) {
    console.log('- none');
    return;
  }

  values.slice(0, 12).forEach(value => {
    console.log(`- ${value}`);
  });
}
