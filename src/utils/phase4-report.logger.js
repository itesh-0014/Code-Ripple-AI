export function logPhase4Report(report) {
  if (!report?.validation) {
    console.log('\nPhase 4 rule validation was not requested.');
    return;
  }

  const validation = report.validation;

  console.log('\n================ PHASE 4 RULE ENGINE VALIDATION ================');
  console.log(`Rules executed: ${validation.rules.total}`);
  console.log(`Validation targets: ${validation.targets.total}`);
  console.log(`Changed-file targets: ${validation.targets.changedFiles}`);
  console.log(
    `Affected-context targets: ${validation.targets.affectedContextModules}`
  );
  console.log(`Skipped targets: ${validation.targets.skipped.length}`);
  console.log(`Rule execution errors: ${validation.summary.ruleErrorCount}`);
  console.log(`Total findings: ${validation.summary.totalFindings}`);
  console.log(
    `Highest severity: ${validation.summary.highestSeverity || 'none'}`
  );

  console.log('\nFindings by severity:');
  Object.entries(validation.summary.bySeverity).forEach(([severity, count]) => {
    console.log(`- ${severity}: ${count}`);
  });

  console.log('\nFindings by category:');
  const categoryEntries = Object.entries(validation.summary.byCategory);

  if (categoryEntries.length === 0) {
    console.log('- none');
  } else {
    categoryEntries.forEach(([category, count]) => {
      console.log(`- ${category}: ${count}`);
    });
  }

  console.log('\nTop rule findings:');

  if (validation.findings.length === 0) {
    console.log('- No deterministic validation findings detected.');
  } else {
    validation.findings.slice(0, 20).forEach(finding => {
      console.log(
        `- [${finding.severity}] ${finding.ruleId} at ${finding.filePath}:${finding.line}`
      );
      console.log(`  ${finding.message}`);

      if (finding.evidence?.length) {
        console.log(`  Evidence: ${finding.evidence.join('; ')}`);
      }

      if (finding.recommendation) {
        console.log(`  Fix: ${finding.recommendation}`);
      }
    });
  }

  if (validation.targets.skipped.length > 0) {
    console.log('\nSkipped validation targets:');
    validation.targets.skipped.slice(0, 10).forEach(target => {
      console.log(`- ${target.path} (${target.scope}): ${target.reason}`);
    });
  }

  if (validation.ruleErrors.length > 0) {
    console.log('\nRule execution errors:');
    validation.ruleErrors.slice(0, 10).forEach(error => {
      console.log(`- ${error.ruleId} on ${error.filePath}: ${error.message}`);
    });
  }

  console.log('\nPhase 4 complete: deterministic validation report generated.');
}
