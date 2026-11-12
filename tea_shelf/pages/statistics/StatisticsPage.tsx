import { List, Text, useState } from "scripting"
import { storage } from "../../core/storage"
import { calculateTeaStatistics } from "../../core/statistics"

export function StatisticsPage() {
  const [statistics, setStatistics] = useState(calculateTeaStatistics(storage.data.teas))

  return <List navigationTitle="统计" navigationBarTitleDisplayMode="inline"
      onAppear={() => setStatistics(calculateTeaStatistics(storage.data.teas))}>
    <Text>茶品数量：{statistics.stockedCount} / {statistics.registeredCount}</Text>
    <Text>未定型茶品数：{statistics.unconfiguredCount}</Text>
    <Text>存茶总量：{statistics.weight}</Text>
    <Text>存茶总值：{statistics.value} 元</Text>
  </List>
}
