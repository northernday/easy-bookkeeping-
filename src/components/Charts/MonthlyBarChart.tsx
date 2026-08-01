import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { CategoryAmount } from '@/types/bill'

interface Props {
  data: CategoryAmount[]
}

export default function MonthlyBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid
          strokeDasharray="0"
          stroke="var(--color-gridline)"
          vertical={false}
        />
        <XAxis
          dataKey="categoryName"
          tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
          axisLine={{ stroke: 'var(--color-baseline)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value: number) => `¥${value.toFixed(2)}`}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
          }}
          cursor={{ fill: 'var(--color-gridline)', opacity: 0.5 }}
        />
        <Bar
          dataKey="amount"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          // 使用各分类自己的颜色
          shape={(props: any) => {
            const { x, y, width, height, payload } = props
            const fill = payload.color || 'var(--cat-other)'
            return (
              <rect x={x} y={y} width={width} height={height} fill={fill}
                rx={4} ry={4}
                style={{ clipPath: 'inset(0 0 -4px 0)' }}
              />
            )
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
