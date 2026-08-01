// 首页 Hero 大数字 — 应用唯一的标志性视觉元素
// 使用砖红强调色 #C7493A，全屏仅此一处

interface Props {
  amount: number
  label: string
}

export default function HeroFigure({ amount, label }: Props) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
      <div className="hero-figure">
        ¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div style={{
        fontSize: 14,
        color: 'var(--color-ink-secondary)',
        marginTop: 4,
        letterSpacing: 2,
      }}>
        {label}
      </div>
    </div>
  )
}
