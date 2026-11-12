import {
  Button, Dialog, Form, HStack, Image, Keyboard, Navigation, Picker, Section, Spacer, Text, TextField,
  useEffect, useMemo, useState,
} from "scripting"
import { storage, TEA_PREFERENCES, TEA_STOCKS } from "../../core/storage"
import type { Tea } from "../../core/storage"
import { createTeaDraft, teaFromDraft } from "./draft"
import type { TeaDraft } from "./draft"

function NumberField({ title, unit, value, integer, onChanged }: {
  title: string, unit: string, value: string, integer?: boolean, onChanged: (value: string) => void,
}) {
  return <HStack spacing={12}>
    <Text frame={{ width: 112, alignment: "leading" }}>{title}</Text>
    <TextField title="" prompt="未设置" value={value} onChanged={onChanged}
        frame={{ maxWidth: "infinity" }} keyboardType={integer ? "numberPad" : "decimalPad"} />
    <Text font="caption" foregroundStyle="secondaryLabel">{unit}</Text>
  </HStack>
}

export function TeaEditorPage({ tea, onSaved }: { tea?: Tea, onSaved: (tea: Tea) => void }) {
  const dismiss = Navigation.useDismiss()
  const [draft, setDraft] = useState(createTeaDraft(tea))
  const [brands, setBrands] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingBrand, setAddingBrand] = useState(false)
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

  async function addBrand() {
    if (state.busy || !ready) return
    state.busy = true
    setAddingBrand(true)
    setError("")
    try {
      const name = await Dialog.prompt({
        title: "新增品牌", placeholder: "品牌名称", cancelLabel: "取消", confirmLabel: "添加",
      })
      if (name === null || !state.mounted) return
      const next = await storage.addBrand(name)
      if (state.mounted) {
        setBrands(next)
        change("brand", name.trim())
      }
    } catch (error) {
      if (state.mounted) {
        const message = error instanceof Error ? error.message : ""
        setError(/请输入品牌名称|该品牌已存在/.test(message) ? message : "新增品牌失败，请重试。")
      }
    } finally {
      state.busy = false
      if (state.mounted) setAddingBrand(false)
    }
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
        if (state.busy) return
        setDraft(createTeaDraft(tea))
        void loadBrands()
      }}
      toolbar={{
        topBarTrailing: <Button title={saving ? "保存中…" : "保存"}
            disabled={!ready || saving || addingBrand || !draft.name.trim()} action={() => { void save() }} />,
        keyboard: <HStack><Spacer /><Button title="完成" action={() => Keyboard.hide()} /></HStack>,
      }}
  >
    {error ? <Section>
      <Text foregroundStyle="systemRed">{error}</Text>
      {!ready ? <Button title="重试" action={() => { void loadBrands() }} /> : null}
    </Section> : null}
    <Section header={<Text>基本信息</Text>} disabled={saving || addingBrand}>
      <HStack spacing={12}>
        <Text frame={{ width: 56, alignment: "leading" }}>品名</Text>
        <TextField title="" prompt="输入茶品名称" value={draft.name} onChanged={value => change("name", value)}
            frame={{ maxWidth: "infinity" }} />
      </HStack>
      <HStack spacing={12}>
        <Text frame={{ width: 56, alignment: "leading" }}>品牌</Text>
        <Picker title="" labelsHidden pickerStyle="menu" value={draft.brand}
            frame={{ maxWidth: "infinity" }} disabled={!ready}
            onChanged={(value: string) => change("brand", value)}>
          <Text tag="">未选择</Text>
          {brandOptions.map(brand => <Text key={brand} tag={brand}>{brand}</Text>)}
        </Picker>
        <Button buttonStyle="plain" disabled={!ready} action={() => { void addBrand() }}>
          <Image systemName="plus" frame={{ width: 32, height: 32 }} />
        </Button>
      </HStack>
      <Picker title="" labelsHidden pickerStyle="segmented" value={draft.preference}
          onChanged={(value: TeaDraft["preference"]) => change("preference", value)}>
        {TEA_PREFERENCES.map(value => <Text key={value} tag={value}>{value}</Text>)}
      </Picker>
      <NumberField title="斤价" unit="元/斤" integer value={draft.pricePerJin} onChanged={value => change("pricePerJin", value)} />
      <HStack spacing={12}>
        <Text frame={{ width: 56, alignment: "leading" }}>存量</Text>
        <Picker title="" labelsHidden pickerStyle="segmented" value={draft.stock}
          frame={{ maxWidth: "infinity" }}
          onChanged={(value: TeaDraft["stock"]) => change("stock", value)}>
        {TEA_STOCKS.map(value => <Text key={value} tag={value}>{value}</Text>)}
        </Picker>
      </HStack>
    </Section>
    <Section header={<Text>杯泡配置</Text>} footer={<Text>数字可留空，留空表示未设置</Text>} disabled={saving || addingBrand}>
      <NumberField title="300ml投茶量" unit="g" value={draft.grams300ml} onChanged={value => change("grams300ml", value)} />
      <NumberField title="首杯出汤" unit="分钟" value={draft.firstSteepMinutes} onChanged={value => change("firstSteepMinutes", value)} />
    </Section>
    <Section header={<Text>功夫配置</Text>} disabled={saving || addingBrand}>
      <NumberField title="茶碗投茶量" unit="g" value={draft.gongfuGrams} onChanged={value => change("gongfuGrams", value)} />
      <NumberField title="首杯出汤" unit="秒" integer value={draft.firstSteepSeconds} onChanged={value => change("firstSteepSeconds", value)} />
      <NumberField title="几杯顺延" unit="杯" integer value={draft.extendEveryCups} onChanged={value => change("extendEveryCups", value)} />
      <NumberField title="顺延秒" unit="秒" integer value={draft.extendSeconds} onChanged={value => change("extendSeconds", value)} />
      <NumberField title="最大泡数" unit="泡" integer value={draft.maxSteeps} onChanged={value => change("maxSteeps", value)} />
    </Section>
  </Form>
}
