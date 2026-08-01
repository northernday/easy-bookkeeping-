import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { CategoryTrend } from '@/types/bill'
import { CATEGORY_COLORS } from '@/constants/categories'

interface Props {
  data: CategoryTrend
}

export default function TrendLineChart({ data }: Props) {
  const color = CATEGORY_COLORS[data.categoryName] || 'var(--cat-other)'
  const chartData = data.dataPoints.map(d => ({
    month: `${d.month}月`,
    amount: d.amount,
  }))

  return (
    <div>
      <div style={{
        fontSize: 13,
        fontWeight: 500,
        color: 'var(--color-ink-secondary)',
        marginBottom: 8,
        paddingLeft: 4,
        borderLeft: `3px solid ${color}`,
      }}>
        {data.categoryName}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="0" stroke="var(--color-gridline)" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
            axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
            axisLine={false} tickLine={false} width={50}
            tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value: number) => `¥${value.toFixed(2)}`}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 4, fill: color, stroke: 'var(--color-surface)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color, stroke: 'var(--color-surface)', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
