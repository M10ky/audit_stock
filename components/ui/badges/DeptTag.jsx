// // TODO: Phase 3 — DeptTag
// export default function DeptTag() { return null }

export default function DeptTag({ dept }) {
  if (dept === 'IT') return <span className="badge badge-it">IT</span>
  return <span className="badge badge-fin">Finance</span>
}