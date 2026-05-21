export const OWNERS = ['Eric', 'Ray Marie', 'Matthew', 'Carson', 'Drew', 'Dom']

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
