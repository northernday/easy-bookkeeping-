// 预设分类种子数据（与 electron/ipc/database.ts 中的 seed 保持一致）
import type { Category } from '@/types/bill'

export const PRESET_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: '游戏', icon: 'PlayCircleOutlined',   color: '#2a78d6', is_preset: 1, sort_order: 1 },
  { name: '医疗', icon: 'MedicineBoxOutlined', color: '#eb6834', is_preset: 1, sort_order: 2 },
  { name: '教育', icon: 'ReadOutlined',      color: '#1baf7a', is_preset: 1, sort_order: 3 },
  { name: '旅行', icon: 'CompassOutlined',   color: '#eda100', is_preset: 1, sort_order: 4 },
  { name: '日用', icon: 'ShoppingCartOutlined', color: '#e87ba4', is_preset: 1, sort_order: 5 },
  { name: '其它', icon: 'EllipsisOutlined', color: '#008300', is_preset: 1, sort_order: 6 },
]

// 分类颜色映射（用于图表和标签）
export const CATEGORY_COLORS: Record<string, string> = {
  '游戏': '#2a78d6',
  '医疗': '#eb6834',
  '教育': '#1baf7a',
  '旅行': '#eda100',
  '日用': '#e87ba4',
  '其它': '#008300',
}
