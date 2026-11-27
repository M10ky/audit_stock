import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'out/**', 'build/**'] },
  ...nextCoreWebVitals,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/static-components': 'off',
    },
  },
]

export default config
