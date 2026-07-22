import { ruleEngineConfig } from '../../config/rule-engine.config.js';
import { normalizeRepoPath } from '../../utils/repository-path.util.js';
import { parseJavaScriptFile } from './utils/javascript-ast.util.js';
import {
  buildRuleFileContext,
  isJavaScriptLikeFile,
} from './utils/rule-file.util.js';
import { ruleRegistry } from './rule-registry.js';
import { validationReportService } from './validation-report.service.js';

class RuleEngineService {
  validatePullRequest({
    repository,
    scanResult,
    graph,
    impact,
    changedFiles,
    includeAffectedModules = ruleEngineConfig.includeAffectedModules,
    includedRuleCategories = null,
    excludedRuleCategories = [],
    includedRuleIds = null,
    excludedRuleIds = [],
  }) {
    const activeRules = this.resolveActiveRules({
      includedRuleCategories,
      excludedRuleCategories,
      includedRuleIds,
      excludedRuleIds,
    });
    const { targets, skippedTargets } = this.buildValidationTargets({
      scanResult,
      graph,
      impact,
      changedFiles,
      includeAffectedModules,
    });
    const findings = [];
    const ruleErrors = [];

    for (const target of targets) {
      const parseResult = isJavaScriptLikeFile(target.file.path)
        ? parseJavaScriptFile(target.file)
        : {
            ast: null,
            parseError: null,
          };
      const fileContext = buildRuleFileContext({
        file: target.file,
        scope: target.scope,
        changedFile: target.changedFile,
        graphNode: target.graphNode,
        ast: parseResult.ast,
        parseError: parseResult.parseError,
      });

      for (const rule of activeRules) {
        if (rule.appliesTo && !rule.appliesTo(fileContext)) {
          continue;
        }

        let ruleFindings = [];

        try {
          ruleFindings = rule.check(fileContext) || [];
        } catch (error) {
          ruleErrors.push({
            ruleId: rule.id,
            filePath: fileContext.normalizedPath,
            message: error.message,
          });
          continue;
        }

        ruleFindings = ruleFindings.slice(
          0,
          ruleEngineConfig.maxFindingsPerRulePerFile
        );

        findings.push(...ruleFindings);
      }
    }

    return validationReportService.buildReport({
      repository,
      rules: activeRules,
      targets,
      skippedTargets,
      findings,
      ruleErrors,
    });
  }

  resolveActiveRules({
    includedRuleCategories,
    excludedRuleCategories,
    includedRuleIds,
    excludedRuleIds,
  }) {
    const includedCategorySet = Array.isArray(includedRuleCategories)
      ? new Set(includedRuleCategories)
      : null;
    const excludedCategorySet = new Set(excludedRuleCategories || []);
    const includedRuleIdSet = Array.isArray(includedRuleIds)
      ? new Set(includedRuleIds)
      : null;
    const excludedRuleIdSet = new Set(excludedRuleIds || []);

    return ruleRegistry.filter(rule => {
      if (includedCategorySet && !includedCategorySet.has(rule.category)) {
        return false;
      }

      if (excludedCategorySet.has(rule.category)) {
        return false;
      }

      if (includedRuleIdSet && !includedRuleIdSet.has(rule.id)) {
        return false;
      }

      return !excludedRuleIdSet.has(rule.id);
    });
  }

  buildValidationTargets({
    scanResult,
    graph,
    impact,
    changedFiles,
    includeAffectedModules,
  }) {
    const fileByPath = new Map(
      scanResult.files.map(file => [normalizeRepoPath(file.path), file])
    );
    const targetByPath = new Map();
    const skippedTargets = [];

    for (const changedFile of changedFiles) {
      const normalizedPath = normalizeRepoPath(changedFile.filename);
      const scannedFile = fileByPath.get(normalizedPath);

      if (!scannedFile) {
        skippedTargets.push({
          path: normalizedPath,
          scope: 'changed',
          reason: 'file content was not available in the repository scan',
        });
        continue;
      }

      targetByPath.set(normalizedPath, {
        file: scannedFile,
        scope: 'changed',
        changedFile,
        graphNode: graph?.nodes?.get(normalizedPath) || null,
      });
    }

    if (includeAffectedModules) {
      const affectedModules = (impact?.affectedModules || [])
        .slice(0, ruleEngineConfig.maxAffectedValidationTargets);

      for (const affectedModule of affectedModules) {
        const normalizedPath = normalizeRepoPath(affectedModule.path);

        if (targetByPath.has(normalizedPath)) {
          continue;
        }

        const scannedFile = fileByPath.get(normalizedPath);

        if (!scannedFile) {
          skippedTargets.push({
            path: normalizedPath,
            scope: 'affected-context',
            reason: 'affected module content was not available in the repository scan',
          });
          continue;
        }

        targetByPath.set(normalizedPath, {
          file: scannedFile,
          scope: 'affected-context',
          changedFile: null,
          graphNode: graph?.nodes?.get(normalizedPath) || null,
        });
      }
    }

    return {
      targets: [...targetByPath.values()],
      skippedTargets,
    };
  }
}

export const ruleEngineService = new RuleEngineService();
