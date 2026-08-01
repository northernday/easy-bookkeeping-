import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { AnnualSummary } from '@/types/bill'
import { CATEGORY_COLORS } from '@/constants/categories'

interface Props {
  data: AnnualSummary
}

export default function AnnualBarChart({ data }: Props) {
  // 构建分组柱图数据：每月各分类金额
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const mData = data.monthlyTrend.find(t => t.month === m)
    const row: any = { month: `${m}月` }
    if (mData) {
      mData.categoryBreakdown.forEach(c => {
        row[c.categoryName] = c.amount
      })
    }
    return row
  })

  const categoryNames = [...new Set(
    data.categoryBreakdown.map(c => c.categoryName)
  )]

  if (months.every(m => Object.keys(m).length <= 1)) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-ink-muted)' }}>
        暂无足够数据生成年度汇总图
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={months} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="0" stroke="var(--color-gridline)" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
          axisLine={{ stroke: 'var(--color-baseline)' }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'var(--color-ink-muted)' }}
          axisLine={false} tickLine={false}
          tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(value: number, name: string) => [`¥${value.toFixed(2)}`, name]}
          contentStyle={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
          }}
        />
        <Legend
          formatter={(value: string) => (
            <span style={{ color: 'var(--color-ink-secondary)', fontSize: 12 }}>{value}</span>
          )}
        />
        {categoryNames.map(name => (
          <Bar key={name} dataKey={name} stackId="a"
            fill={CATEGORY_COLORS[name] || 'var(--cat-other)'}
            maxBarSize={24}
            radius={0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
