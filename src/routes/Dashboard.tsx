import { useEffect, useState } from 'react'
import { DatePicker, Row, Col, Card, Empty, Skeleton, Button, Segmented } from 'antd'
import { useNavigate } from 'react-router-dom'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAppStore } from '@/store/useAppStore'
import { useLedgerStore } from '@/store/useLedgerStore'
import type { MonthlySummary, AnnualSummary, CategoryTrend, DateRangeSummary } from '@/types/bill'
import HeroFigure from '@/components/Charts/HeroFigure'
import MonthlyPieChart from '@/components/Charts/MonthlyPieChart'
import MonthlyBarChart from '@/components/Charts/MonthlyBarChart'
import TrendLineChart from '@/components/Charts/TrendLineChart'
import AnnualBarChart from '@/components/Charts/AnnualBarChart'
import Sparkline from '@/components/Charts/Sparkline'

const { RangePicker } = DatePicker

export default function Dashboard() {
  const navigate = useNavigate()
  const { currentYear, currentMonth, dateMode, dateFrom, dateTo, refreshKey, setMonth, setDateMode, setDateRange } = useAppStore()
  const { activeLedger } = useLedgerStore()
  const [monthlyData, setMonthlyData] = useState<MonthlySummary | null>(null)
  const [rangeData, setRangeData] = useState<DateRangeSummary | null>(null)
  const [annualData, setAnnualData] = useState<AnnualSummary | null>(null)
  const [trends, setTrends] = useState<CategoryTrend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasData, setHasData] = useState(true)

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const lid = activeLedger?.id || 1
      console.log('[Dashboard] fetchData — ledger:', lid, 'year:', currentYear, 'month:', currentMonth, 'mode:', dateMode)

      if (dateMode === 'range' && dateFrom && dateTo) {
        // 自定义日期范围
        const range = await window.electronAPI.getDateRangeSummary(dateFrom, dateTo, lid)
        setRangeData(range)
        setMonthlyData(null)
        setTrends([])

        if (range.totalExpense === 0) {
          setHasData(false)
        } else {
          setHasData(true)
        }
      } else {
        // 月度统计
        const monthly = await window.electronAPI.getMonthlySummary(currentYear, currentMonth, lid)
        const annual = await window.electronAPI.getAnnualSummary(currentYear, lid)
        setMonthlyData(monthly)
        setAnnualData(annual)
        setRangeData(null)
        console.log('[Dashboard] monthly totalExpense:', monthly.totalExpense, 'breakdown:', monthly.categoryBreakdown?.length)

        if (monthly.totalExpense === 0 && annual.totalExpense === 0) {
          setHasData(false)
        } else {
          setHasData(true)
        }

        // 获取各分类趋势
        const cats = await window.electronAPI.getCategories(lid)
        const trendResults: CategoryTrend[] = []
        for (const cat of cats) {
          if (cat.name === '其它') continue
          const trend = await window.electronAPI.getCategoryTrend(cat.id, currentYear, lid)
          if (trend.dataPoints.length > 0) {
            trendResults.push(trend)
          }
        }
        setTrends(trendResults)
      }
    } catch (err) {
      console.error('[Dashboard] fetchData error:', err)
      setHasData(false)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentYear, currentMonth, dateMode, dateFrom, dateTo, activeLedger?.id, refreshKey])

  // 各月总支出数据（用于 Sparkline）
  const monthlyTotals = annualData?.monthlyTrend?.map(m => ({
    month: m.month,
    amount: m.totalExpense
  })) || []

  // 当前显示的支出数据（月结或范围）
  const currentExpense = dateMode === 'range' ? (rangeData?.totalExpense || 0) : (monthlyData?.totalExpense || 0)
  const currentLabel = dateMode === 'range'
    ? `${dateFrom} ~ ${dateTo}`
    : `${currentMonth}月总支出`
  const currentBreakdown = dateMode === 'range' ? (rangeData?.categoryBreakdown || []) : (monthlyData?.categoryBreakdown || [])

  if (isLoading) {
    return (
      <div>
        <Skeleton active paragraph={{ rows: 1 }} />
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={12}><Skeleton active /></Col>
          <Col span={12}><Skeleton active /></Col>
        </Row>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div style={{ textAlign: 'center', paddingTop: 120 }}>
        <Empty description="还没有账单数据">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate('/import')}
          >
            导入账单
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div>
      {/* 日期选择器 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Segmented
            value={dateMode}
            onChange={(val) => setDateMode(val as 'monthly' | 'range')}
            options={[
              { label: '月结', value: 'monthly' },
              { label: '自定义范围', value: 'range' },
            ]}
            style={{ marginRight: 12 }}
          />
          {dateMode === 'monthly' ? (
            <DatePicker
              picker="month"
              value={dayjs(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)}
              onChange={(d) => d && setMonth(d.year(), d.month() + 1)}
              allowClear={false}
              style={{ width: 160 }}
            />
          ) : (
            <RangePicker
              value={dateFrom && dateTo ? [dayjs(dateFrom), dayjs(dateTo)] : null}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange(dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD'))
                }
              }}
              allowClear={false}
              style={{ width: 260 }}
              placeholder={['开始日期', '截止日期']}
            />
          )}
        </Col>
      </Row>

      {/* Hero Figure + Sparkline（仅月结模式显示 Sparkline） */}
      <Card className="chart-card" style={{ marginBottom: 24 }}>
        <HeroFigure
          amount={currentExpense}
          label={currentLabel}
        />
        {dateMode === 'monthly' && monthlyTotals.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Sparkline
              data={monthlyTotals}
              height={40}
              color="var(--color-accent)"
            />
          </div>
        )}
      </Card>

      {/* 饼图 + 柱图 并排 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card className="chart-card" title="分类占比" size="small">
            {currentBreakdown.length > 0 ? (
              <MonthlyPieChart data={currentBreakdown} />
            ) : (
              <Empty description="本时段无支出数据" />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card className="chart-card" title="分类对比" size="small">
            {currentBreakdown.length > 0 ? (
              <MonthlyBarChart data={currentBreakdown} />
            ) : (
              <Empty description="本时段无支出数据" />
            )}
          </Card>
        </Col>
      </Row>

      {/* 分类趋势折线图（仅月结模式） */}
      {dateMode === 'monthly' && trends.length > 0 && (
        <Card className="chart-card" title={`${currentYear}年分类趋势`} style={{ marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {trends.slice(0, 5).map(t => (
              <Col span={12} key={t.categoryId}>
                <TrendLineChart data={t} />
              </Col>
            ))}
          </Row>
        </Card>
      )}

      {/* 年度汇总（仅月结模式） */}
      {dateMode === 'monthly' && annualData && annualData.totalExpense > 0 && (
        <Card className="chart-card" title={`${currentYear}年年度汇总`}>
          <AnnualBarChart data={annualData} />
        </Card>
      )}
    </div>
  )
}
