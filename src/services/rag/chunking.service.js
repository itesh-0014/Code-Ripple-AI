import path from 'path';
import { ragConfig } from '../../config/rag.config.js';
import { createStableHash } from '../../utils/hash.util.js';
import {
  classifyModuleLayer,
  getRepoExtension,
  isSourceFile,
  normalizeRepoPath,
} from '../../utils/repository-path.util.js';

class ChunkingService {
  chunkFiles({ files, graph, repositoryKey }) {
    return files.flatMap(file =>
      this.chunkFile({
        file,
        graphNode: graph?.nodes?.get(normalizeRepoPath(file.path)),
        repositoryKey,
      })
    );
  }

  chunkFile({ file, graphNode, repositoryKey }) {
    const normalizedPath = normalizeRepoPath(file.path);
    const content = normalizeLineEndings(file.content || '');

    if (!content.trim()) {
      return [];
    }

    const lines = content.split('\n');
    const ranges = isSourceFile(normalizedPath)
      ? this.buildCodeRanges(lines)
      : this.buildWindowRanges(lines);

    const fileHash = createStableHash(content, 16);

    return ranges
      .map((range, index) =>
        this.buildChunk({
          file,
          normalizedPath,
          graphNode,
          repositoryKey,
          fileHash,
          lines,
          range,
          index,
        })
      )
      .filter(chunk => chunk.rawContent.trim().length > 0)
      .filter(
        chunk =>
          chunk.rawContent.trim().length >=
            ragConfig.chunking.minChunkCharacters || lines.length <= 20
      );
  }

  buildCodeRanges(lines) {
    if (lines.length <= ragConfig.chunking.maxLines) {
      return [{ start: 0, end: lines.length - 1 }];
    }

    const boundaries = this.findCodeBoundaries(lines);
    const sections = boundaries.map((start, index) => ({
      start,
      end: (boundaries[index + 1] || lines.length) - 1,
    }));

    const ranges = [];
    let currentRange = null;

    for (const section of sections) {
      if (this.rangeLength(section) > ragConfig.chunking.maxLines) {
        if (currentRange) {
          ranges.push(currentRange);
          currentRange = null;
        }

        ranges.push(...this.splitLargeRange(section));
        continue;
      }

      if (!currentRange) {
        currentRange = { ...section };
        continue;
      }

      const combinedRange = {
        start: currentRange.start,
        end: section.end,
      };

      if (this.rangeLength(combinedRange) <= ragConfig.chunking.maxLines) {
        currentRange = combinedRange;
        continue;
      }

      ranges.push(currentRange);
      currentRange = { ...section };
    }

    if (currentRange) {
      ranges.push(currentRange);
    }

    return this.applyOverlap(ranges, lines.length);
  }

  buildWindowRanges(lines) {
    if (lines.length <= ragConfig.chunking.maxLines) {
      return [{ start: 0, end: lines.length - 1 }];
    }

    const ranges = [];
    const step = Math.max(
      1,
      ragConfig.chunking.maxLines - ragConfig.chunking.overlapLines
    );

    for (let start = 0; start < lines.length; start += step) {
      const end = Math.min(start + ragConfig.chunking.maxLines - 1, lines.length - 1);
      ranges.push({ start, end });

      if (end >= lines.length - 1) {
        break;
      }
    }

    return ranges;
  }

  findCodeBoundaries(lines) {
    const boundaries = new Set([0]);

    lines.forEach((line, index) => {
      if (isCodeBoundary(line)) {
        boundaries.add(index);
      }
    });

    return [...boundaries].sort((a, b) => a - b);
  }

  splitLargeRange(range) {
    const ranges = [];
    const step = Math.max(
      1,
      ragConfig.chunking.maxLines - ragConfig.chunking.overlapLines
    );

    for (let start = range.start; start <= range.end; start += step) {
      const end = Math.min(start + ragConfig.chunking.maxLines - 1, range.end);
      ranges.push({ start, end });

      if (end >= range.end) {
        break;
      }
    }

    return ranges;
  }

  applyOverlap(ranges, totalLines) {
    return ranges.map((range, index) => {
      if (index === 0) {
        return range;
      }

      return {
        start: Math.max(0, range.start - ragConfig.chunking.overlapLines),
        end: Math.min(totalLines - 1, range.end),
      };
    });
  }

  rangeLength(range) {
    return range.end - range.start + 1;
  }

  buildChunk({
    file,
    normalizedPath,
    graphNode,
    repositoryKey,
    fileHash,
    lines,
    range,
    index,
  }) {
    const rawContent = lines.slice(range.start, range.end + 1).join('\n');
    const extension = getRepoExtension(normalizedPath);
    const symbols = extractSymbols(rawContent);
    const chunkType = classifyChunkType({
      filePath: normalizedPath,
      rawContent,
      extension,
    });
    const lineStart = range.start + 1;
    const lineEnd = range.end + 1;
    const id = createStableHash(
      `${repositoryKey}:${normalizedPath}:${lineStart}:${lineEnd}:${fileHash}:${index}`,
      40
    );

    const metadata = {
      path: normalizedPath,
      fileName: path.posix.basename(normalizedPath),
      extension: extension || 'none',
      layer: classifyModuleLayer(normalizedPath),
      chunkType,
      chunkIndex: index,
      lineStart,
      lineEnd,
      size: file.size || rawContent.length,
      fileHash,
      symbolsJson: JSON.stringify(symbols),
      importSourcesJson: JSON.stringify(
        graphNode?.imports?.map(item => item.source) || []
      ),
      exportedNamesJson: JSON.stringify(
        graphNode?.exports?.map(item => item.name) || []
      ),
      dependenciesJson: JSON.stringify(graphNode?.dependencies || []),
      dependentsJson: JSON.stringify(graphNode?.dependents || []),
    };

    const embeddingText = buildEmbeddingText({
      normalizedPath,
      metadata,
      symbols,
      rawContent,
    });

    return {
      id,
      rawContent,
      embeddingText,
      metadata,
    };
  }
}

function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function isCodeBoundary(line) {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return false;
  }

  return [
    /^(export\s+)?(default\s+)?(async\s+)?function\s+[A-Za-z0-9_$]+/,
    /^(export\s+)?(default\s+)?class\s+[A-Za-z0-9_$]+/,
    /^(export\s+)?(const|let|var)\s+[A-Za-z0-9_$]+\s*=/,
    /^(router|app)\.(get|post|put|patch|delete|use)\s*\(/,
    /^module\.exports\s*=/,
    /^exports\.[A-Za-z0-9_$]+\s*=/,
  ].some(pattern => pattern.test(trimmedLine));
}

function extractSymbols(content) {
  const symbols = new Set();
  const symbolPatterns = [
    /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
    /\b(?:export\s+)?(?:default\s+)?class\s+([A-Za-z0-9_$]+)/g,
    /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/g,
    /\b(?:router|app)\.(get|post|put|patch|delete|use)\s*\(\s*['"`]([^'"`]+)/g,
    /\bmodule\.exports\s*=\s*([A-Za-z0-9_$]+)/g,
    /\bexports\.([A-Za-z0-9_$]+)\s*=/g,
  ];

  for (const pattern of symbolPatterns) {
    for (const match of content.matchAll(pattern)) {
      symbols.add(match[2] || match[1]);
    }
  }

  return [...symbols].slice(0, 20);
}

function classifyChunkType({ filePath, rawContent, extension }) {
  const lowerPath = filePath.toLowerCase();

  if (extension === '.md') {
    return 'documentation';
  }

  if (extension === '.json' || extension === '.yml' || extension === '.yaml') {
    return 'configuration';
  }

  if (extension === '.css' || extension === '.scss' || extension === '.html') {
    return 'frontend-asset';
  }

  if (/(route|routes)/.test(lowerPath) || /\b(router|app)\./.test(rawContent)) {
    return 'route';
  }

  if (/(middleware)/.test(lowerPath)) {
    return 'middleware';
  }

  if (/(controller|controllers)/.test(lowerPath)) {
    return 'controller';
  }

  if (/(service|services)/.test(lowerPath)) {
    return 'service';
  }

  if (/(model|schema|database|db)/.test(lowerPath)) {
    return 'data-model';
  }

  if (/(util|utils|helper|helpers|lib)/.test(lowerPath)) {
    return 'utility';
  }

  return 'code';
}

function buildEmbeddingText({ normalizedPath, metadata, symbols, rawContent }) {
  return [
    `File: ${normalizedPath}`,
    `Layer: ${metadata.layer}`,
    `Chunk type: ${metadata.chunkType}`,
    symbols.length ? `Symbols: ${symbols.join(', ')}` : null,
    `Lines: ${metadata.lineStart}-${metadata.lineEnd}`,
    '',
    rawContent,
  ]
    .filter(Boolean)
    .join('\n');
}

export const chunkingService = new ChunkingService();
