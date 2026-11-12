import {
  Button, Form, HStack, Keyboard, Navigation, Picker, Section, Spacer, Text, TextField,
  useEffect, useMemo, useState,
} from "scripting"
import { storage, TEA_PREFERENCES, TEA_STOCKS } from "../../core/storage"
import type { Tea } from "../../core/storage"
import { createTeaDraft, teaFromDraft } from "./draft"
import type { TeaDraft } from "./draft"

function NumberField({ title, unit, value, integer, onChanged }: {
  title: string, unit: string, value: string, integer?: boolean, onChanged: (value: string) => void,
}) {
  return <HStack>
    <TextField title={title} prompt="未设置" value={value} onChanged={onChanged}
        keyboardType={integer ? "numberPad" : "decimalPad"} />
    <Text font="caption" foregroundStyle="secondaryLabel">{unit}</Text>
  </HStack>
}

export function TeaEditorPage({ tea, onSaved }: { tea?: Tea, onSaved: (tea: Tea) => void }) {
  const dismiss = Navigation.useDismiss()
  const [draft, setDraft] = useState(createTeaDraft(tea))
  const [brands, setBrands] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const state = useMemo(() => ({ mounted: true, busy: false }), [])

  async function loadBrands() {
    setReady(false)
    setError("")
    try {
      const meta = await storage.getMeta()
      if (state.mounted) {
        setBrands(meta.brands)
        setReady(true)
      }
    } catch {
      if (state.mounted) setError("读取品牌失败，请重试。")
    }
  }

  useEffect(() => {
    state.mounted = true
    return () => { state.mounted = false }
  }, [])

  function change<K extends keyof TeaDraft>(key: K, value: TeaDraft[K]) {
    setDraft(previous => ({ ...previous, [key]: value }))
  }

  async function save() {
    if (state.busy || !ready) return
    state.busy = true
    setSaving(true)
    setError("")
    try {
      const input = teaFromDraft(draft)
      const saved = await storage.upsertTea(input, tea?.id)
      onSaved(saved)
      if (state.mounted) {
        if (!tea) setDraft(createTeaDraft())
        setBrands(previous => saved.brand && !previous.includes(saved.brand) ? [...previous, saved.brand] : previous)
        dismiss()
      }
    } catch (error) {
      if (state.mounted) {
        const message = error instanceof Error ? error.message : ""
        setError(/请输入|须为|请选择|不存在/.test(message) ? message : "保存失败，请重试。")
      }
    } finally {
      state.busy = false
      if (state.mounted) setSaving(false)
    }
  }

  const brandOptions = [...new Set([...brands, ...(draft.brand ? [draft.brand] : [])])]
  return <Form
      navigationTitle={tea ? "编辑茶品" : "新增茶品"}
      navigationBarTitleDisplayMode="inline"
      onAppear={() => {
        setDraft(createTeaDraft(tea))
        void loadBrands()
      }}
      toolbar={{
        topBarTrailing: <Button title={saving ? "保存中…" : "保存"}
            disabled={!ready || saving || !draft.name.trim()} action={() => { void save() }} />,
        keyboard: <HStack><Spacer /><Button title="完成" action={() => Keyboard.hide()} /></HStack>,
      }}
  >
    {error ? <Section>
      <Text foregroundStyle="systemRed">{error}</Text>
      {!ready ? <Button title="重试" action={() => { void loadBrands() }} /> : null}
    </Section> : null}
    <Section header={<Text>基本信息</Text>} disabled={saving}>
      <TextField title="品名" prompt="输入茶品名称" value={draft.name} onChanged={value => change("name", value)} />
      <Picker title="品牌" pickerStyle="menu" value={draft.brand} onChanged={(value: string) => change("brand", value)}>
        <Text tag="">未选择</Text>
        {brandOptions.map(brand => <Text key={brand} tag={brand}>{brand}</Text>)}
      </Picker>
      <TextField title="新品牌（选填）" prompt="保存时创建并选用" value={draft.newBrand}
          onChanged={value => change("newBrand", value)} />
      <Picker title="个人喜好" pickerStyle="segmented" value={draft.preference}
          onChanged={(value: TeaDraft["preference"]) => change("preference", value)}>
        {TEA_PREFERENCES.map(value => <Text key={value} tag={value}>{value}</Text>)}
      </Picker>
      <NumberField title="斤价" unit="元/斤" integer value={draft.pricePerJin} onChanged={value => change("pricePerJin", value)} />
      <Picker title="存量" pickerStyle="segmented" value={draft.stock}
          onChanged={(value: TeaDraft["stock"]) => change("stock", value)}>
        {TEA_STOCKS.map(value => <Text key={value} tag={value}>{value}</Text>)}
      </Picker>
    </Section>
    <Section header={<Text>杯泡配置</Text>} footer={<Text>数字可留空，留空表示未设置</Text>} disabled={saving}>
      <NumberField title="300ml投茶量" unit="g" value={draft.grams300ml} onChanged={value => change("grams300ml", value)} />
      <NumberField title="首杯出汤" unit="分钟" value={draft.firstSteepMinutes} onChanged={value => change("firstSteepMinutes", value)} />
    </Section>
    <Section header={<Text>功夫配置</Text>} disabled={saving}>
      <NumberField title="茶碗投茶量" unit="g" value={draft.gongfuGrams} onChanged={value => change("gongfuGrams", value)} />
      <NumberField title="首杯出汤" unit="秒" integer value={draft.firstSteepSeconds} onChanged={value => change("firstSteepSeconds", value)} />
      <NumberField title="几杯顺延" unit="杯" integer value={draft.extendEveryCups} onChanged={value => change("extendEveryCups", value)} />
      <NumberField title="顺延秒" unit="秒" integer value={draft.extendSeconds} onChanged={value => change("extendSeconds", value)} />
      <NumberField title="最大泡数" unit="泡" integer value={draft.maxSteeps} onChanged={value => change("maxSteeps", value)} />
    </Section>
  </Form>
}
