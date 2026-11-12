import { HStack, Image, NavigationLink, Text, VStack, modifiers, useEffect, useMemo, useState } from "scripting"
import { ICloudArchivesPage } from "./icloud/ICloudArchivesPage"
import { teaTheme } from "../core/theme"
import { ConfigPage } from "./config/ConfigPage"
import { DEFAULT_CONFIG, storage } from "../core/storage"
import type { AppConfig } from "../core/storage"
import { formatError } from "../core/errors"

export function HomeToolbar() {
  const [config, setConfig] = useState<AppConfig>({ ...DEFAULT_CONFIG })
  const [error, setError] = useState("")
  const state = useMemo(() => ({ mounted: true }), [])

  useEffect(() => {
    state.mounted = true
    return () => { state.mounted = false }
  }, [])

  async function load() {
    try {
      const meta = await storage.getMeta()
      if (state.mounted) {
        setConfig(meta.config)
        setError("")
      }
    } catch (error) {
      if (state.mounted) setError(formatError(error))
    }
  }

  function saved(next: AppConfig) {
    if (state.mounted) setConfig(next)
  }

  const items = [
    { id: "icloud", title: "icloud", icon: "icloud", destination: <ICloudArchivesPage /> },
    { id: "config", title: "配置", icon: "gearshape", destination: <ConfigPage onSaved={saved} /> },
  ]

  return <VStack alignment="leading" spacing={6} padding={{ top: 12, leading: 16, trailing: 16 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }} onAppear={() => { void load() }}>
    <HStack spacing={12} frame={{ minHeight: 80 }}>
      {items.map(item => <NavigationLink key={item.id} destination={item.destination} buttonStyle="plain"
          offset={{ y: -config.toolbarOffsetUp }}>
        <VStack spacing={8}
            foregroundStyle={teaTheme.text}
            modifiers={modifiers()
              .frame({ width: 80, height: 80 })
              .background("clear")
              .clipShape({ type: "rect", cornerRadius: 10 })}>
          <Image systemName={item.icon} font={config.toolbarIconSize} />
          <Text font={config.toolbarTextSize}>{item.title}</Text>
        </VStack>
      </NavigationLink>)}
    </HStack>
    {error ? <Text foregroundStyle="systemRed">{error}</Text> : null}
  </VStack>
}
