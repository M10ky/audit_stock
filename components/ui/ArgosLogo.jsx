// components/ui/ArgosLogo.jsx
'use client'

/**
 * Logo ARGOS — monogramme "œil" (référence au gardien aux cent yeux),
 * cohérent avec un produit de supervision de stock. Deux modes :
 * - par défaut : badge dégradé navy → teal (usage sur fond clair/carte)
 * - monochrome : trait blanc plein, sans fond (usage sur fond déjà coloré, ex. bouton teal)
 */
export default function ArgosLogo({ size = 40, monochrome = false, className = '' }) {
  const gradId = 'argosGrad'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="ARGOS"
    >
      {!monochrome && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0b2c46" />
              <stop offset="1" stopColor="#0e3a4f" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="11" fill={`url(#${gradId})`} />
        </>
      )}
      <path
        d="M6.5 20C6.5 20 12 12.5 20 12.5C28 12.5 33.5 20 33.5 20C33.5 20 28 27.5 20 27.5C12 27.5 6.5 20 6.5 20Z"
        stroke={monochrome ? '#ffffff' : '#eafffa'}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20" r="4.25" fill={monochrome ? '#ffffff' : '#00c9a7'} />
    </svg>
  )
}