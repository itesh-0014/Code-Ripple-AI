import { scoreFile } from './fileScorer.js';

export function prioritizeFiles(state) {
  return (state.changedFiles || [])
    .map(file => scoreFile({ file, state }))
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file));
}

