import { Button, HStack, List, Section, Text, TextField, useEffect, useMemo, useState } from "scripting"
import { storage } from "../../core/storage"
import { formatError } from "../../core/errors"

export function BrandsPage() {
  const [brands, setBrands] = useState<string[]>([])
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  // Prevent two taps in the same render cycle from submitting duplicate operations.
  const state = useMemo(() => ({ busy: false, mounted: true }), [])

  async function load() {
    setLoading(true)
    setError("")
    try {
      const meta = await storage.getMeta()
      if (state.mounted) {
        setBrands(meta.brands)
        setReady(true)
      }
    } catch (error) {
      if (state.mounted) setError(formatError(error))
    } finally {
      if (state.mounted) setLoading(false)
    }
  }

  useEffect(() => {
    state.mounted = true
    return () => { state.mounted = false }
  }, [])

  async function update(operation: () => Promise<string[]>, clearName = false) {
    if (state.busy || !ready) return
    state.busy = true
    setSaving(true)
    setError("")
    try {
      const next = await operation()
      if (state.mounted) {
        setBrands(next)
        if (clearName) setName("")
      }
    } catch (error) {
      if (state.mounted) {
        const message = error instanceof Error ? error.message : ""
        setError(message === "该品牌已存在" || message === "请输入品牌名称"
          ? message : formatError(error))
      }
    } finally {
      state.busy = false
      if (state.mounted) setSaving(false)
    }
  }

  return <List navigationTitle="品牌管理" navigationBarTitleDisplayMode="inline"
      onAppear={() => { void load() }}>
    <Section header={<Text>新增品牌</Text>}>
      <HStack spacing={12}>
        <TextField
            title="品牌名称"
            prompt="输入品牌名称"
            value={name}
            onChanged={setName}
            disabled={loading || saving || !ready}
        />
        <Button
            title={saving ? "保存中…" : "添加"}
            disabled={loading || saving || !ready || !name.trim()}
            action={() => { void update(() => storage.addBrand(name), true) }}
        />
      </HStack>
    </Section>
    {error ? <Section>
      <Text foregroundStyle="systemRed">{error}</Text>
      {!ready && !loading ? <Button title="重试" action={() => { void load() }} /> : null}
    </Section> : null}
    <Section header={<Text>品牌</Text>} footer={<Text>向右滑动品牌可删除</Text>}>
      {loading ? <Text foregroundStyle="secondaryLabel">正在读取…</Text>
        : !ready ? <Text foregroundStyle="secondaryLabel">暂时无法读取品牌</Text>
        : brands.length === 0 ? <Text foregroundStyle="secondaryLabel">暂无品牌，添加第一个品牌吧</Text>
        : brands.map(brand => <Text
            disabled={saving}
            leadingSwipeActions={{
              allowsFullSwipe: false,
              actions: [<Button
                  title="删除"
                  role="destructive"
                  disabled={saving}
                  action={() => { void update(() => storage.removeBrand(brand)) }}
              />],
            }}
        >{brand}</Text>)}
    </Section>
  </List>
}
