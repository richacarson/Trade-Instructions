export const OWNERS = [
  'Carson',
  'Dom',
  'Drew',
  'Eric',
  'Gavin',
  'Matthew',
  'Ray Marie',
]

export const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
]

// Everything that is not finished.
export const OPEN_STATUSES = ['open', 'in_progress', 'blocked']

export const statusLabel = (value) =>
  STATUSES.find((s) => s.value === value)?.label ?? value
