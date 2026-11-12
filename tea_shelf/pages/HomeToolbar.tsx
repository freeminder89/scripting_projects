import { HStack, Image, NavigationLink, Text, VStack, modifiers } from "scripting"
import { ICloudArchivesPage } from "./icloud/ICloudArchivesPage"
import { teaTheme } from "../core/theme"
import { ConfigPage } from "./config/ConfigPage"

export function HomeToolbar() {
  const items = [
    { id: "icloud", title: "icloud", icon: "icloud", destination: <ICloudArchivesPage /> },
    { id: "config", title: "配置", icon: "gearshape", destination: <ConfigPage /> },
  ]

  return <VStack alignment="leading" spacing={6} padding={{ top: 12, leading: 8, trailing: 8 }}
      frame={{ maxWidth: "infinity", alignment: "leading" }}>
    <HStack spacing={4} frame={{ minHeight: 60 }}>
      {items.map(item => <NavigationLink key={item.id} destination={item.destination} buttonStyle="plain">
        <VStack spacing={4}
            foregroundStyle={teaTheme.text}
            modifiers={modifiers()
              .frame({ width: 60, height: 60, alignment: "bottom" })
              .background("clear")
              .clipShape({ type: "rect", cornerRadius: 10 })}>
          <Image systemName={item.icon} font={32} />
          <Text font={10}>{item.title}</Text>
        </VStack>
      </NavigationLink>)}
    </HStack>
  </VStack>
}
