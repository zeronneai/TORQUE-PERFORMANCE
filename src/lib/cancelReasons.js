// Cancellation survey options. Shared by the parent cancel flow, the admin
// "Manage player" modal, and the admin Cancellations report.
// Keys are stored in the DB; change labels freely, never reuse a key for a different meaning.
export const CANCEL_REASONS = [
  { key: 'cost',        label: 'Cost / price' },
  { key: 'schedule',    label: 'Schedule or time conflicts' },
  { key: 'coaching',    label: 'Coaching or training quality' },
  { key: 'facility',    label: 'Facility / location' },
  { key: 'moving',      label: 'Moving away' },
  { key: 'other_sport', label: 'Playing another sport or season' },
  { key: 'results',     label: 'Not seeing results' },
  { key: 'other',       label: 'Other' },
]
export const CANCEL_REASON_LABEL = Object.fromEntries(CANCEL_REASONS.map(r => [r.key, r.label]))
