import {
  Button, Form, GeometryReader, HStack, Image, Navigation, Picker, ScrollViewReader, Section, Spacer, Text, TextField, VStack,
  useEffect, useKeyboardVisible, useMemo, useState,
} from "scripting"
import type { ScrollViewProxy } from "scripting"
import { storage, TEA_PREFERENCES, TEA_STOCKS } from "../../core/storage"
import type { Tea } from "../../core/storage"
import { createTeaDraft, teaFromDraft } from "./draft"
import type { TeaDraft } from "./draft"
import { formatError } from "../../core/errors"

const inputOrder = ["name", "pricePerJin", "grams300ml", "firstSteepMinutes", "gongfuGrams",
  "firstSteepSeconds", "extendEveryCups", "extendSeconds", "maxSteeps"] as const
type InputField = typeof inputOrder[number]
type InputFocus = { key: string, autofocus: boolean, onFocus: () => void, onBlur: () => void }
const rowKey = (field: InputField) => `tea-input-${field}`

function NumberField({ title, unit, value, integer, onChanged, inputFocus }: {
  title: string, unit: string, value: string, integer?: boolean, onChanged: (value: string) => void,
  inputFocus: InputFocus,
}) {
  return <HStack spacing={12}>
    <Text frame={{ width: 112, alignment: "leading" }}>{title}</Text>
    <TextField {...inputFocus} title="" prompt="未设置" value={value} onChanged={onChanged}
        multilineTextAlignment="trailing" frame={{ maxWidth: "infinity" }}
        keyboardType={integer ? "numberPad" : "decimalPad"} />
    <Text font="caption" foregroundStyle="secondaryLabel">{unit}</Text>
  </HStack>
}

type TeaEditorProps = {
  tea?: Tea, onSaved: (tea: Tea) => void, onDeleted?: (id: string) => void,
}

export function TeaEditorPage(props: TeaEditorProps) {
  return <GeometryReader>{geometry => <ScrollViewReader>{scrollProxy =>
    <TeaEditorForm {...props} scrollProxy={scrollProxy} viewportHeight={geometry.size.height} />
  }</ScrollViewReader>}</GeometryReader>
}

function TeaEditorForm({ tea, onSaved, onDeleted, scrollProxy, viewportHeight }: TeaEditorProps & {
  scrollProxy: ScrollViewProxy, viewportHeight: number,
}) {
  const dismiss = Navigation.useDismiss()
  const [draft, setDraft] = useState(createTeaDraft(tea))
  const [brands, setBrands] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addingBrand, setAddingBrand] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const keyboardVisible = useKeyboardVisible()
  const [activeInput, setActiveInput] = useState<InputField | null>(null)
  const [movingFocus, setMovingFocus] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{
    field: InputField | null, versions: Partial<Record<InputField, number>>,
  }>({ field: null, versions: {} })
  const state = useMemo(() => ({
    mounted: true, busy: false, draftId: tea?.id, focusRevision: 0, moving: false,
    centeredByNext: null as { field: InputField, height: number } | null,
  }), [])

  function centerInput(field: InputField) {
    return withAnimation(Animation.easeOut(0.3), () => scrollProxy.scrollTo(rowKey(field), "center"))
  }

  useEffect(() => {
    if (!keyboardVisible || activeInput === null || state.busy || state.moving) return
    if (state.centeredByNext?.field === activeInput && state.centeredByNext.height === viewportHeight) {
      state.centeredByNext = null
      return
    }
    // Debounce layout changes so native keyboard avoidance finishes first.
    const revision = state.focusRevision
    const timer = setTimeout(() => {
      if (state.mounted && !state.busy && !state.moving && state.focusRevision === revision) {
        void centerInput(activeInput).catch(error => console.error("tea_shelf center input:", error))
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [activeInput, keyboardVisible, viewportHeight, scrollProxy])

  function inputFocus(field: InputField): InputFocus {
    return {
      key: `${field}-${focusRequest.versions[field] ?? 0}`,
      autofocus: focusRequest.field === field,
      onFocus: () => {
        state.focusRevision++
        setActiveInput(field)
        setFocusRequest(previous => previous.field !== null && previous.field !== field
          ? { ...previous, field: null } : previous)
      },
      onBlur: () => setFocusRequest(previous => previous.field === field
        ? { ...previous, field: null } : previous),
    }
  }

  const nextInput = activeInput === null ? undefined : inputOrder[inputOrder.indexOf(activeInput) + 1]
  async function focusNext() {
    if (state.busy || state.moving || nextInput === undefined) return
    state.moving = true
    setMovingFocus(true)
    const revision = ++state.focusRevision
    try {
      // Make offscreen rows visible smoothly before autofocus can trigger
      // a competing native scroll. A manual focus change cancels the handoff.
      await centerInput(nextInput)
      if (!state.mounted || state.focusRevision !== revision) return
      state.centeredByNext = { field: nextInput, height: viewportHeight }
      setFocusRequest(previous => ({
        field: nextInput,
        versions: { ...previous.versions, [nextInput]: (previous.versions[nextInput] ?? 0) + 1 },
      }))
    } catch (error) {
      console.error("tea_shelf next input:", error)
    } finally {
      state.moving = false
      if (state.mounted) setMovingFocus(false)
    }
  }

  function finishInput() {
    state.focusRevision++
    state.centeredByNext = null
    setFocusRequest(previous => ({ ...previous, field: null }))
    setActiveInput(null)
    Keyboard.hide()
  }

  async function loadBrands() {
    setReady(false)
    setError("")
    try {
      const meta = await storage.getMeta()
      if (state.mounted) {
        setBrands(meta.brands)
        setReady(true)
      }
    } catch (error) {
      if (state.mounted) setError(formatError(error))
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
    let submitting = false
    try {
      const name = await Dialog.prompt({
        title: "新增品牌", placeholder: "品牌名称", cancelLabel: "取消", confirmLabel: "添加",
      })
      // Native bridges may return either null or undefined on cancellation.
      if (name == null || !state.mounted) return
      submitting = true
      setAddingBrand(true)
      setError("")
      const next = storage.addBrand(name)
      await storage.saveMeta()
      if (state.mounted) {
        setBrands([...next])
        change("brand", name.trim())
      }
    } catch (error) {
      console.error("tea_shelf add brand:", error)
      if (state.mounted) {
        const message = error instanceof Error ? error.message : ""
        setError(/请输入品牌名称|该品牌已存在/.test(message) ? message : formatError(error))
      }
    } finally {
      state.busy = false
      if (state.mounted && submitting) setAddingBrand(false)
    }
  }

  async function save() {
    if (state.busy || !ready) return
    state.busy = true
    setSaving(true)
    setError("")
    try {
      const input = teaFromDraft(draft)
      if (!storage.meta.brands.includes(input.brand)) {
        storage.addBrand(input.brand)
        await storage.saveMeta()
      }
      const saved = storage.upsertTea(input, state.draftId)
      // Keep the ID after a failed write so retrying cannot create a duplicate.
      state.draftId = saved.id
      await storage.saveData()
      onSaved(saved)
      if (state.mounted) {
        if (!tea) setDraft(createTeaDraft())
        setBrands(previous => saved.brand && !previous.includes(saved.brand) ? [...previous, saved.brand] : previous)
        dismiss()
      }
    } catch (error) {
      if (state.mounted) {
        const message = error instanceof Error ? error.message : ""
        setError(/请输入|须为|请选择|不存在/.test(message) ? message : formatError(error))
      }
    } finally {
      state.busy = false
      if (state.mounted) setSaving(false)
    }
  }

  async function deleteTea() {
    if (!tea || state.busy) return
    state.busy = true
    setDeleting(true)
    setError("")
    try {
      const confirmed = await Dialog.confirm({
        title: "删除茶品", message: `确定删除“${tea.name}”吗？`, cancelLabel: "取消", confirmLabel: "删除",
      })
      if (!confirmed || !state.mounted) return
      storage.removeTea(tea.id)
      await storage.saveData()
      onDeleted?.(tea.id)
      if (state.mounted) dismiss()
    } catch (error) {
      console.error("tea_shelf delete tea:", error)
      if (state.mounted) setError(formatError(error))
    } finally {
      state.busy = false
      if (state.mounted) setDeleting(false)
    }
  }

  const brandOptions = [...new Set([...brands, ...(draft.brand ? [draft.brand] : [])])]
  return <Form
      navigationTitle={tea ? "编辑茶品" : "新增茶品"}
      navigationBarTitleDisplayMode="inline"
      onAppear={() => {
        if (state.busy || ready) return
        setDraft(createTeaDraft(tea))
        void loadBrands()
      }}
      toolbar={{
        topBarTrailing: <Button title={saving ? "保存中…" : "保存"}
            disabled={!ready || saving || addingBrand || deleting || !draft.name.trim() || !draft.brand.trim()}
            action={() => { void save() }} />,
        keyboard: <HStack spacing={20}>
          <Button title="下一项" disabled={nextInput === undefined || movingFocus || saving || addingBrand || deleting}
              action={() => { void focusNext() }} />
          <Spacer />
          <Button title="完成" action={finishInput} />
        </HStack>,
      }}
  >
    {error ? <Section>
      <Text foregroundStyle="systemRed">{error}</Text>
      {!ready ? <Button title="重试" action={() => { void loadBrands() }} /> : null}
    </Section> : null}
    <Section header={<VStack alignment="leading" spacing={0}>
      {keyboardVisible ? <Text hidden frame={{ height: viewportHeight / 2 }}> </Text> : null}
      <Text>基本信息</Text>
    </VStack>} disabled={saving || addingBrand || deleting}>
      <HStack key={rowKey("name")} spacing={12}>
        <Text frame={{ width: 56, alignment: "leading" }}>品名</Text>
        <TextField {...inputFocus("name")} title="" prompt="输入茶品名称" value={draft.name} onChanged={value => change("name", value)}
            multilineTextAlignment="trailing" frame={{ maxWidth: "infinity" }} />
      </HStack>
      <HStack spacing={12}>
        <Text frame={{ width: 56, alignment: "leading" }}>品牌</Text>
        <Spacer />
        <HStack spacing={12}>
          <Picker title="" labelsHidden pickerStyle="menu" value={draft.brand}
              frame={{ alignment: "trailing" }} disabled={!ready}
              onChanged={(value: string) => change("brand", value)}>
            <Text tag="">未选择</Text>
            {brandOptions.map(brand => <Text key={brand} tag={brand}>{brand}</Text>)}
          </Picker>
          <Button buttonStyle="plain" disabled={!ready} action={() => { void addBrand() }}>
            <Image systemName="plus" />
          </Button>
        </HStack>
      </HStack>
      <Picker title="" labelsHidden pickerStyle="segmented" value={draft.preference}
          onChanged={(value: TeaDraft["preference"]) => change("preference", value)}>
        {TEA_PREFERENCES.map(value => <Text key={value} tag={value}>{value}</Text>)}
      </Picker>
      <NumberField key={rowKey("pricePerJin")} inputFocus={inputFocus("pricePerJin")} title="斤价" unit="元/斤" integer value={draft.pricePerJin} onChanged={value => change("pricePerJin", value)} />
      <HStack spacing={12}>
        <Text frame={{ width: 56, alignment: "leading" }}>存量</Text>
        <Picker title="" labelsHidden pickerStyle="segmented" value={draft.stock}
          frame={{ maxWidth: "infinity" }}
          onChanged={(value: TeaDraft["stock"]) => change("stock", value)}>
        {TEA_STOCKS.map(value => <Text key={value} tag={value}>{value}</Text>)}
        </Picker>
      </HStack>
    </Section>
    <Section header={<Text>杯泡配置</Text>} footer={<Text>数字可留空，留空表示未设置</Text>} disabled={saving || addingBrand || deleting}>
      <NumberField key={rowKey("grams300ml")} inputFocus={inputFocus("grams300ml")} title="300ml投茶量" unit="克" value={draft.grams300ml} onChanged={value => change("grams300ml", value)} />
      <NumberField key={rowKey("firstSteepMinutes")} inputFocus={inputFocus("firstSteepMinutes")} title="首泡" unit="分" value={draft.firstSteepMinutes} onChanged={value => change("firstSteepMinutes", value)} />
    </Section>
    <Section header={<Text>功夫配置</Text>} disabled={saving || addingBrand || deleting}
        footer={!tea && keyboardVisible ? <Text hidden frame={{ height: viewportHeight / 2 }}> </Text> : undefined}>
      <NumberField key={rowKey("gongfuGrams")} inputFocus={inputFocus("gongfuGrams")} title="茶碗投茶量" unit="克" value={draft.gongfuGrams} onChanged={value => change("gongfuGrams", value)} />
      <NumberField key={rowKey("firstSteepSeconds")} inputFocus={inputFocus("firstSteepSeconds")} title="首泡" unit="秒" integer value={draft.firstSteepSeconds} onChanged={value => change("firstSteepSeconds", value)} />
      <NumberField key={rowKey("extendEveryCups")} inputFocus={inputFocus("extendEveryCups")} title="几泡顺延" unit="泡" integer value={draft.extendEveryCups} onChanged={value => change("extendEveryCups", value)} />
      <NumberField key={rowKey("extendSeconds")} inputFocus={inputFocus("extendSeconds")} title="顺延秒" unit="秒" integer value={draft.extendSeconds} onChanged={value => change("extendSeconds", value)} />
      <NumberField key={rowKey("maxSteeps")} inputFocus={inputFocus("maxSteeps")} title="最大泡数" unit="泡" integer value={draft.maxSteeps} onChanged={value => change("maxSteeps", value)} />
    </Section>
    {tea ? <Section footer={keyboardVisible ? <Text hidden frame={{ height: viewportHeight / 2 }}> </Text> : undefined}>
      <Button role="destructive" disabled={saving || addingBrand || deleting}
          action={() => { void deleteTea() }}>
        <Text foregroundStyle="systemRed" frame={{ maxWidth: "infinity" }}>
          {deleting ? "删除中…" : "删除茶品"}
        </Text>
      </Button>
    </Section> : null}
  </Form>
}
