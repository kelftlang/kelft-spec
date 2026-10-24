export const updateBranch = 'automation/update-compiler-spec';
export const botEmail = '41898282+github-actions[bot]@users.noreply.github.com';
export const generatedInput = name => name === 'compiler-source.json' || name === '.publication.json' || /^(spec|compiler-inputs)\//.test(name);
export function assertAutomationBranch(authors, paths) {
  // An already merged branch has no remaining commits and can safely be reused.
  if (authors.some(author => author !== botEmail)) throw new Error('Automation branch has human changes; review it before retrying.');
  if (paths.some(name => !generatedInput(name))) throw new Error('Automation branch contains unexpected files.');
}
