import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import type { CategoryAmount } from '@/types/bill'

const RADIAN = Math.PI / 180

// 自定义 Label
function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, categoryName }: any) {
  const radius = outerRadius + 25
  const x = cx + radius * Math.cos(-midAngle * RADIAN)
  const y = cy + radius * Math.sin(-midAngle * RADIAN)
  if (percent < 0.05) return null // 小于 5% 不显示 label

  return (
    <text x={x} y={y} fill="var(--color-ink-secondary)" fontSize={12}
      textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {categoryName} {(percent * 100).toFixed(0)}%
    </text>
  )
}

interface Props {
  data: CategoryAmount[]
}

export default function MonthlyPieChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={data}
          dataKey="amount"
          nameKey="categoryName"
          cx="50%"
          cy="50%"
          outerRadius={100}
          innerRadius={50}
          label={renderLabel}
          labelLine={false}
          stroke="var(--color-chart-surface)"
          strokeWidth={2}
        >
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.color || `var(--cat-other)`}
              style={{ outline: 'none' }}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => `¥${value.toFixed(2)}`}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
          }}
        />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          formatter={(value: string) => (
            <span style={{ color: 'var(--color-ink-secondary)', fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
