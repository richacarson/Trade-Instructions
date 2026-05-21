import { OWNERS } from '../lib/constants'

export default function OwnerSelect({
  value,
  onChange,
  includeAll = false,
  className = '',
}) {
  return (
    <select
      className={`input ${className}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <option value="">{includeAll ? 'All owners' : 'Unassigned'}</option>
      {OWNERS.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  )
}
