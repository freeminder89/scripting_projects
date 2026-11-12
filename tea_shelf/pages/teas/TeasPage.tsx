import {
  Button, HStack, LazyVGrid, NavigationLink, Spacer, Text, VStack, modifiers, useEffect, useMemo, useState,
} from "scripting"
import { storage } from "../../core/storage"
import type { Tea } from "../../core/storage"
import { TeaEditorPage } from "./TeaEditorPage"
import { formatError } from "../../core/errors"
import { teaTheme } from "../../core/theme"

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
    } catch (error) {
      console.error("tea_shelf load teas:", error)
      if (state.mounted) setError(formatError(error))
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

  function deleted(id: string) {
    if (state.mounted) setTeas(previous => previous.filter(tea => tea.id !== id))
  }

  return <VStack alignment="leading" spacing={16} padding={16}
      frame={{ maxWidth: "infinity", alignment: "leading" }}
      onAppear={() => { void load() }}
      toolbar={{ topBarTrailing: <NavigationLink title="新增茶品" disabled={!ready || loading}
          destination={<TeaEditorPage onSaved={saved} />} /> }}
  >
      {loading ? <Text foregroundStyle={teaTheme.secondaryText}>正在读取…</Text> : null}
      {error ? <VStack alignment="leading">
        <Text foregroundStyle="systemRed">{error}</Text>
        <Button title="重试" action={() => { void load() }} />
      </VStack> : null}
      {ready && !loading && teas.length === 0 ? <Text foregroundStyle={teaTheme.secondaryText}>暂无茶品，点击右上角新增</Text> : null}
      <LazyVGrid spacing={12} frame={{ maxWidth: "infinity" }} columns={[
        { size: { type: "flexible", min: 0 } },
        { size: { type: "flexible", min: 0 } },
      ]}>
        {teas.map(tea => <NavigationLink key={tea.id}
            destination={<TeaEditorPage tea={tea} onSaved={saved} onDeleted={deleted} />}
            buttonStyle="plain" frame={{ maxWidth: "infinity" }} contentShape="rect">
          <VStack alignment="leading" spacing={6} padding={10}
              modifiers={modifiers()
                .frame({ maxWidth: "infinity", minHeight: 109, maxHeight: 109, alignment: "leading" })
                .background(teaTheme.card)
                .clipShape({ type: "rect", cornerRadius: 16 })}>
            <Text font="headline" foregroundStyle={teaTheme.text} lineLimit={2} minScaleFactor={0.8}>{tea.name}</Text>
            <Text font="subheadline" foregroundStyle={teaTheme.secondaryText} lineLimit={1} minScaleFactor={0.8}>
              {tea.brand || "未选品牌"}
            </Text>
            <HStack spacing={6} frame={{ maxWidth: "infinity" }}>
              <Text font="caption" foregroundStyle={teaTheme.rating} lineLimit={1} minScaleFactor={0.75}>
                {tea.preference} · {tea.stock}
              </Text>
              <Spacer />
              <Text font="caption" foregroundStyle={teaTheme.secondaryText} multilineTextAlignment="trailing"
                  lineLimit={1} minScaleFactor={0.75}>
                {tea.pricePerJin === null ? "斤价未设置" : `${tea.pricePerJin} 元/斤`}
              </Text>
            </HStack>
          </VStack>
        </NavigationLink>)}
      </LazyVGrid>
  </VStack>
}
