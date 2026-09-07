// Single source of truth for the current contract version + plan labels.
// Bump CONTRACT_VERSION whenever the contract text changes → every parent is
// required to re-sign the new version for each of their (classifiable) kids.
export const CONTRACT_VERSION = '2026-09';

export const PLAN_LABELS = {
  stand:  'Month-to-Month',
  m6:     '6-Month',
  m12:    '12-Month',
  annual: 'Annual (Lump Sum)',
};
