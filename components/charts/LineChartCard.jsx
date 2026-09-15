'use client'
import dynamic from 'next/dynamic'

const Line = dynamic(() => import('react-chartjs-2').then(m => m.Line), { ssr: false })

import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler,
} from 'chart.js'
if (typeof window !== 'undefined') {
  ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)
}

const GRID = '#e2e8f0'
const TEXT = '#94a3b8'

/**
 * @param {string[]} labels
 * @param {number[]} data
 * @param {string} color
 * @param {(v:number)=>string} tickFormat
 */
export default function LineChartCard({ labels = [], data = [], color = '#4f46e5', tickFormat }) {
  const chartData = {
    labels,
    datasets: [{
      data,
      borderColor: color,
      backgroundColor: `${color}1a`, // ~10% opacity, mirrors rgba(...,.1) du vanilla
      tension: 0.35,
      fill: true,
      pointRadius: 3,
    }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: TEXT, font: { size: 9 } }, grid: { color: GRID } },
      y: {
        ticks: { color: TEXT, font: { size: 9 }, ...(tickFormat ? { callback: tickFormat } : {}) },
        grid: { color: GRID },
      },
    },
  }

  return (
    <div className="bar-chart-wrap" style={{ height: 260 }}>
      <Line data={chartData} options={options} />
    </div>
  )
}