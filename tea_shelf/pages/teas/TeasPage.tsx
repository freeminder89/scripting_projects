import {
  Button, LazyVGrid, NavigationLink, ScrollView, Text, VStack, useEffect, useMemo, useState,
} from "scripting"
import { storage } from "../../core/storage"
import type { Tea } from "../../core/storage"
import { TeaEditorPage } from "./TeaEditorPage"

export function TeasPage() {
  const [teas, setTeas] = useState<Tea[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const state = useMemo(() => ({ mounted: true }), [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const next = await storage.listTeas()
      if (state.mounted) {
        setTeas(next)
        setReady(true)
      }
    } catch {
      if (state.mounted) setError("读取茶品失败，原有数据未被修改，请重试。")
    } finally {
      if (state.mounted) setLoading(false)
    }
  }

  useEffect(() => {
    state.mounted = true
    return () => { state.mounted = false }
  }, [])

  function saved(tea: Tea) {
    if (!state.mounted) return
    setTeas(previous => previous.some(item => item.id === tea.id)
      ? previous.map(item => item.id === tea.id ? tea : item) : [...previous, tea])
  }

  return <ScrollView
      navigationTitle="茶品管理"
      navigationBarTitleDisplayMode="inline"
      onAppear={() => { void load() }}
      toolbar={{ topBarTrailing: <NavigationLink title="新增茶品" disabled={!ready || loading}
          destination={<TeaEditorPage onSaved={saved} />} /> }}
  >
    <VStack alignment="leading" spacing={16} padding={16}>
      {loading ? <Text foregroundStyle="secondaryLabel">正在读取…</Text> : null}
      {error ? <VStack alignment="leading">
        <Text foregroundStyle="systemRed">{error}</Text>
        <Button title="重试" action={() => { void load() }} />
      </VStack> : null}
      {ready && !loading && teas.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无茶品，点击右上角新增</Text> : null}
      <LazyVGrid spacing={12} columns={[
        { size: { type: "flexible", min: 0 } },
        { size: { type: "flexible", min: 0 } },
      ]}>
        {teas.map(tea => <NavigationLink key={tea.id} destination={<TeaEditorPage tea={tea} onSaved={saved} />}>
          <VStack alignment="leading" spacing={10} padding={14}
              frame={{ maxWidth: "infinity", minHeight: 156, alignment: "leading" }}
              background="systemGray6" clipShape={{ type: "rect", cornerRadius: 16 }}>
            <Text font="headline" foregroundStyle="label">{tea.name}</Text>
            <Text font="subheadline" foregroundStyle="secondaryLabel">{tea.brand || "未选品牌"}</Text>
            <Text font="caption" foregroundStyle="systemGreen">{tea.preference} · {tea.stock}</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">
              {tea.pricePerJin === null ? "斤价未设置" : `${tea.pricePerJin} 元/斤`}
            </Text>
          </VStack>
        </NavigationLink>)}
      </LazyVGrid>
    </VStack>
  </ScrollView>
}
