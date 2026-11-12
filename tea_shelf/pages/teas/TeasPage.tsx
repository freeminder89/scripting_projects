import {
  Button, Dialog, LazyVGrid, NavigationLink, ScrollView, Text, VStack, useEffect, useMemo, useState,
} from "scripting"
import { storage } from "../../core/storage"
import type { Tea } from "../../core/storage"
import { TeaEditorPage } from "./TeaEditorPage"

export function TeasPage() {
  const [teas, setTeas] = useState<Tea[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState(false)
  const state = useMemo(() => ({ mounted: true, deleting: false }), [])

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

  async function confirmDelete(tea: Tea) {
    if (state.deleting) return
    state.deleting = true
    setDeleting(true)
    setError("")
    try {
      const confirmed = await Dialog.confirm({
        title: "删除茶品", message: `确定删除“${tea.name}”吗？`, cancelLabel: "取消", confirmLabel: "删除",
      })
      if (!confirmed || !state.mounted) return
      const next = await storage.removeTea(tea.id)
      if (state.mounted) setTeas(next)
    } catch {
      if (state.mounted) setError("删除失败，原有数据未被修改，请重试。")
    } finally {
      state.deleting = false
      if (state.mounted) setDeleting(false)
    }
  }

  return <ScrollView
      navigationTitle="茶品管理"
      navigationBarTitleDisplayMode="inline"
      onAppear={() => { void load() }}
      toolbar={{ topBarTrailing: <NavigationLink title="新增茶品" disabled={!ready || loading || deleting}
          destination={<TeaEditorPage onSaved={saved} />} /> }}
  >
    <VStack alignment="leading" spacing={16} padding={16} frame={{ maxWidth: "infinity", alignment: "leading" }}>
      {loading ? <Text foregroundStyle="secondaryLabel">正在读取…</Text> : null}
      {error ? <VStack alignment="leading">
        <Text foregroundStyle="systemRed">{error}</Text>
        <Button title="重试" action={() => { void load() }} />
      </VStack> : null}
      {ready && !loading && teas.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无茶品，点击右上角新增</Text> : null}
      <LazyVGrid spacing={12} frame={{ maxWidth: "infinity" }} columns={[
        { size: { type: "flexible", min: 0 } },
        { size: { type: "flexible", min: 0 } },
      ]}>
        {teas.map(tea => <NavigationLink key={tea.id} destination={<TeaEditorPage tea={tea} onSaved={saved} />}
            buttonStyle="plain" frame={{ maxWidth: "infinity" }} disabled={deleting}
            onLongPressGesture={() => { void confirmDelete(tea) }}>
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
