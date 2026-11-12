import { List, Text, useEffect, useMemo, useState } from "scripting"
import { storage } from "../../core/storage"
import { formatError } from "../../core/errors"

export function ICloudArchivesPage() {
  const [directories, setDirectories] = useState<string[] | null>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const state = useMemo(() => ({ mounted: true }), [])

  useEffect(() => {
    state.mounted = true
    return () => { state.mounted = false }
  }, [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const names = await storage.listBackupDirectories()
      if (state.mounted) setDirectories(names)
    } catch (error) {
      if (state.mounted) setError(formatError(error))
    } finally {
      if (state.mounted) setLoading(false)
    }
  }

  return <List navigationTitle="icloud存档" navigationBarTitleDisplayMode="inline"
      onAppear={() => { void load() }}>
    {loading ? <Text foregroundStyle="secondaryLabel">正在读取…</Text>
      : error ? <Text foregroundStyle="systemRed">{error}</Text>
      : directories === null ? <Text foregroundStyle="secondaryLabel">iCloud 未启用或不可用</Text>
      : directories.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无 iCloud 存档</Text>
      : directories.map(name => <Text key={name}>{name}</Text>)}
  </List>
}
