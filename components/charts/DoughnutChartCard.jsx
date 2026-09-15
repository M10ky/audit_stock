'use client'
import dynamic from 'next/dynamic'

const Doughnut = dynamic(() => import('react-chartjs-2').then(m => m.Doughnut), { ssr: false })

import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
if (typeof window !== 'undefined') {
  ChartJS.register(ArcElement, Tooltip, Legend)
}

/**
 * @param {string[]} labels
 * @param {number[]} data
 * @param {string[]} colors
 * @param {(ctx:any)=>string} tooltipLabel - optionnel, mirrors le callback "X: YM MGA" du vanilla
 */
export default function DoughnutChartCard({ labels = [], data = [], colors = [], tooltipLabel }) {
  const chartData = {
    labels,
    datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { font: { size: 9 }, boxWidth: 8 } },
      ...(tooltipLabel ? { tooltip: { callbacks: { label: tooltipLabel } } } : {}),
    },
  }

  return (
    <div className="bar-chart-wrap" style={{ height: 260 }}>
      <Doughnut data={chartData} options={options} />
    </div>
  )
}