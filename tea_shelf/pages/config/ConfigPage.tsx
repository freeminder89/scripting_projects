import { Button, Form, HStack, Navigation, Section, Slider, Spacer, Text, VStack, useEffect, useMemo, useState } from "scripting"
import { CONFIG_LIMITS, DEFAULT_CONFIG, storage } from "../../core/storage"
import type { AppConfig } from "../../core/storage"
import { formatError } from "../../core/errors"

const fields: { key: keyof AppConfig, title: string }[] = [
  { key: "toolbarIconSize", title: "首页工具按钮图标字号" },
  { key: "toolbarTextSize", title: "首页工具按钮文字字号" },
  { key: "toolbarOffsetUp", title: "首页工具按钮向上偏移" },
]

export function ConfigPage({ onSaved }: { onSaved: (config: AppConfig) => void }) {
  const dismiss = Navigation.useDismiss()
  const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG })
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const state = useMemo(() => ({ mounted: true, busy: false }), [])

  useEffect(() => {
    state.mounted = true
    return () => { state.mounted = false }
  }, [])

  async function load() {
    if (state.busy) return
    state.busy = true
    setReady(false)
    setError("")
    try {
      const meta = await storage.getMeta()
      if (state.mounted) {
        setConfig(meta.config)
        setReady(true)
      }
    } catch (error) {
      if (state.mounted) setError(formatError(error))
    } finally {
      state.busy = false
    }
  }

  async function save() {
    if (state.busy || !ready) return
    state.busy = true
    setSaving(true)
    setError("")
    try {
      const saved = await storage.saveConfig(config)
      onSaved(saved)
      if (state.mounted) dismiss()
    } catch (error) {
      if (state.mounted) setError(formatError(error))
    } finally {
      state.busy = false
      if (state.mounted) setSaving(false)
    }
  }

  return <Form navigationTitle="配置" navigationBarTitleDisplayMode="inline"
      onAppear={() => { void load() }}
      toolbar={{ topBarTrailing: <Button title={saving ? "保存中…" : "保存"}
          disabled={!ready || saving} action={() => { void save() }} /> }}>
    {error ? <Section>
      <Text foregroundStyle="systemRed">{error}</Text>
      {!ready ? <Button title="重试" action={() => { void load() }} /> : null}
    </Section> : null}
    <Section header={<Text>首页工具栏</Text>}
        footer={<Text>保存后生效。向上偏移最大为 12，避免按钮超出顶部留白。</Text>}
        disabled={!ready || saving}>
      {fields.map(field => <VStack key={field.key} alignment="leading" spacing={8}>
        <HStack>
          <Text>{field.title}</Text>
          <Spacer />
          <Text>{config[field.key]}</Text>
        </HStack>
        <Slider min={CONFIG_LIMITS[field.key].min} max={CONFIG_LIMITS[field.key].max} step={1}
            value={config[field.key]} label={<Text>{field.title}</Text>}
            onChanged={value => setConfig(previous => ({ ...previous, [field.key]: value }))} />
      </VStack>)}
    </Section>
  </Form>
}
