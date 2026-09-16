'use client'
import dynamic from 'next/dynamic'

const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false })

// Enregistrement Chart.js — fait une seule fois, côté client uniquement.
// Mirrors js/reports.js: gc/tc/baseOpts (mêmes couleurs de grille/texte).
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from 'chart.js'
if (typeof window !== 'undefined') {
  ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)
}

const GRID = '#e2e8f0'
const TEXT = '#94a3b8'

/**
 * @param {string[]} labels
 * @param {{label?:string, data:number[], color:string}[]} datasets
 * @param {'x'|'y'} indexAxis - 'y' pour un bar chart horizontal (mirrors indexAxis:'y' du vanilla)
 * @param {boolean} showLegend
 * @param {(v:number)=>string} tickFormat - ex: v => v + 'M'
 */
export default function BarChartCard({
  labels = [], datasets = [], indexAxis = 'x', showLegend = false, tickFormat,
}) {
  const data = {
    labels,
    datasets: datasets.map(d => ({
      label: d.label || '',
      data: d.data,
      backgroundColor: d.color,
      borderRadius: 4,
    })),
  }

  const valueAxis = {
    ticks: { color: TEXT, font: { size: 9 }, ...(tickFormat ? { callback: tickFormat } : {}) },
    grid: { color: GRID },
  }
  const labelAxis = {
    ticks: { color: TEXT, font: { size: indexAxis === 'y' ? 9 : 9 } },
    grid: { display: indexAxis === 'y' ? false : true, color: GRID },
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis,
    plugins: {
      legend: { display: showLegend, labels: { font: { size: 10 }, boxWidth: 9 } },
    },
    scales: indexAxis === 'y'
      ? { x: valueAxis, y: labelAxis }
      : { x: labelAxis, y: valueAxis },
  }

  return (
    <div className="bar-chart-wrap" style={{ height: 220 }}>
      <Bar data={data} options={options} />
    </div>
  )
}