import type { Tea, TeaInput } from "../../core/storage/storage"

export type TeaDraft = {
  name: string
  brand: string
  newBrand: string
  preference: TeaInput["preference"]
  stock: TeaInput["stock"]
  pricePerJin: string
  grams300ml: string
  firstSteepMinutes: string
  gongfuGrams: string
  firstSteepSeconds: string
  extendEveryCups: string
  extendSeconds: string
  maxSteeps: string
}

export function createTeaDraft(tea?: Tea): TeaDraft {
  const text = (value: number | null | undefined) => value == null ? "" : String(value)
  return {
    name: tea?.name ?? "", brand: tea?.brand ?? "", newBrand: "",
    preference: tea?.preference ?? "口粮", stock: tea?.stock ?? "无",
    pricePerJin: text(tea?.pricePerJin), grams300ml: text(tea?.cupBrew.grams300ml),
    firstSteepMinutes: text(tea?.cupBrew.firstSteepMinutes),
    gongfuGrams: text(tea?.gongfuBrew.grams), firstSteepSeconds: text(tea?.gongfuBrew.firstSteepSeconds),
    extendEveryCups: text(tea?.gongfuBrew.extendEveryCups),
    extendSeconds: text(tea?.gongfuBrew.extendSeconds), maxSteeps: text(tea?.gongfuBrew.maxSteeps),
  }
}

export function teaFromDraft(draft: TeaDraft): TeaInput {
  function number(text: string, label: string, integer = false, positive = false): number | null {
    // Accept decimal comma and full-width digits from mobile keyboards.
    const value = text.trim().replace(/[０-９]/g, char => String(char.charCodeAt(0) - 0xff10))
      .replace(/[，,．]/g, ".")
    if (!value) return null
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) throw new Error(`${label}请输入有效数字`)
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || (integer && !Number.isSafeInteger(parsed))
      || (positive && parsed < 1)) {
      throw new Error(`${label}须为${positive ? "正" : "非负"}${integer ? "整数" : "数字"}`)
    }
    return parsed
  }
  if (!draft.name.trim()) throw new Error("请输入品名")
  return {
    name: draft.name.trim(), brand: draft.newBrand.trim() || draft.brand,
    preference: draft.preference, stock: draft.stock,
    pricePerJin: number(draft.pricePerJin, "斤价", true),
    cupBrew: {
      grams300ml: number(draft.grams300ml, "300ml投茶量"),
      firstSteepMinutes: number(draft.firstSteepMinutes, "杯泡首杯出汤"),
    },
    gongfuBrew: {
      grams: number(draft.gongfuGrams, "茶碗投茶量"),
      firstSteepSeconds: number(draft.firstSteepSeconds, "功夫首杯出汤", true),
      extendEveryCups: number(draft.extendEveryCups, "几杯顺延", true, true),
      extendSeconds: number(draft.extendSeconds, "顺延秒", true),
      maxSteeps: number(draft.maxSteeps, "最大泡数", true, true),
    },
  }
}
