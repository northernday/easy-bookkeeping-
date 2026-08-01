// 迷你趋势线 — Hero 数字下方的 12 月趋势

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface Props {
  data: { month: number; amount: number }[]
  height?: number
  color?: string
}

export default function Sparkline({ data, height = 40, color = 'var(--color-accent)' }: Props) {
  if (data.length === 0) return null

  const chartData = data.map(d => ({
    label: `${d.month}月`,
    amount: d.amount,
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 2, right: 4, left: 4, bottom: 2 }}>
        <Line
          type="monotone"
          dataKey="amount"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
