import { HStack, List, Spacer, Text, useState } from "scripting"
import { storage } from "../../core/storage"
import { calculateTeaStatistics } from "../../core/statistics"

function StatisticRow({ label, value }: { label: string, value: string }) {
  return <HStack spacing={12} frame={{ maxWidth: "infinity" }}>
    <Text>{label}</Text>
    <Spacer />
    <Text multilineTextAlignment="trailing">{value}</Text>
  </HStack>
}

export function StatisticsPage() {
  const [statistics, setStatistics] = useState(calculateTeaStatistics(storage.data.teas))

  return <List navigationTitle="统计" navigationBarTitleDisplayMode="inline"
      onAppear={() => setStatistics(calculateTeaStatistics(storage.data.teas))}>
    <StatisticRow label="茶品数量" value={`${statistics.stockedCount} / ${statistics.registeredCount}`} />
    <StatisticRow label="未定型茶品数" value={String(statistics.unconfiguredCount)} />
    <StatisticRow label="存茶总量" value={statistics.weight} />
    <StatisticRow label="存茶总值" value={`${statistics.value} 元`} />
  </List>
}
