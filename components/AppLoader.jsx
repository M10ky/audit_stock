'use client'
import { useEffect, useId, useRef, useState } from 'react'

const MIN_VISIBLE_MS = 520 // anti-flash : laisse le loader respirer même si les données sont instantanées
const EXIT_MS = 260

export default function AppLoader({
  label = 'Initialisation…',
  progress,
  fullscreen = true,
  ready = true,
  onExited,
}) {
  const reactId = useId()
  // ID unique : évite une collision de dégradé si deux loaders sont montés
  const gradientId = `argos-loader-grad-${reactId.replace(/:/g, '')}`
  const onExitedRef = useRef(onExited) // garde le timer de sortie stable si le parent re-render
  const exitStartedRef = useRef(false) // évite que setExiting annule son propre timer
  const [minElapsed, setMinElapsed] = useState(false)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    onExitedRef.current = onExited
  }, [onExited])

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!ready || !minElapsed || exitStartedRef.current) return
    exitStartedRef.current = true
    setExiting(true)
    const timer = setTimeout(() => onExitedRef.current?.(), EXIT_MS)
    return () => clearTimeout(timer)
  }, [ready, minElapsed])

  const pct = Number.isFinite(progress)
    ? Math.max(0, Math.min(100, Math.round(progress)))
    : null
  const shellClass = [
    'argos-loader',
    fullscreen ? 'argos-loader--fullscreen' : '',
    exiting ? 'is-exiting' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={shellClass}
      role="status"
      aria-live="polite"
      aria-atomic={true}
      aria-busy={true}
      aria-label={`Chargement ARGOS : ${label}`}
    >
      <div className="argos-loader__backdrop" aria-hidden="true" />

      <div className="argos-loader__content">
        <div className="argos-loader__mark">
          <svg width="96" height="96" viewBox="0 0 40 40" fill="none" role="img" aria-label="Logo ARGOS">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0b2c46" />
                <stop offset="1" stopColor="#0e3a4f" />
              </linearGradient>
            </defs>
            <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />
            {/* pathLength normalise le tracé SVG pour une animation dasharray stable */}
            <path
              className="argos-loader__eye"
              pathLength="100"
              d="M6.5 20C6.5 20 12 12.5 20 12.5C28 12.5 33.5 20 33.5 20C33.5 20 28 27.5 20 27.5C12 27.5 6.5 20 6.5 20Z"
              stroke="#eafffa"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <circle className="argos-loader__pupil" cx="20" cy="20" r="4.25" fill="#00c9a7" />
          </svg>
        </div>

        <div className="argos-loader__brand" aria-hidden="true">ARGOS</div>
        <div className="argos-loader__label">{label}</div>

        <div
          className={`argos-loader__progress ${pct == null ? 'is-indeterminate' : ''}`}
          role="progressbar"
          aria-label="Progression du chargement"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
          aria-valuetext={pct == null ? 'Progression en cours' : `${pct} %`}
        >
          <span style={pct == null ? undefined : { transform: `scaleX(${pct / 100})` }} />
        </div>
      </div>
    </div>
  )
}
