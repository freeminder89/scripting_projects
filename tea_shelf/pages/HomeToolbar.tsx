import { HStack, Image, NavigationLink, Text, modifiers } from "scripting"
import { ICloudArchivesPage } from "./icloud/ICloudArchivesPage"

export function HomeToolbar() {
  const items = [
    { id: "icloud", title: "icloud", icon: "icloud", destination: <ICloudArchivesPage /> },
  ]

  return <HStack spacing={12} padding={{ leading: 16, trailing: 16 }}
      frame={{ maxWidth: "infinity", minHeight: 40, alignment: "leading" }}>
      {items.map(item => <NavigationLink key={item.id} destination={item.destination} buttonStyle="plain">
        <HStack spacing={8}
            foregroundStyle="white"
            modifiers={modifiers()
              .frame({ width: 100, height: 40 })
              .background("#4ADD82")
              .clipShape({ type: "rect", cornerRadius: 10 })}>
          <Image systemName={item.icon} font="body" />
          <Text font="subheadline">{item.title}</Text>
        </HStack>
      </NavigationLink>)}
  </HStack>
}
