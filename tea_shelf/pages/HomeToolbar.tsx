import { HStack, Image, NavigationLink, ScrollView, Text, modifiers } from "scripting"
import { ICloudArchivesPage } from "./icloud/ICloudArchivesPage"

const BUTTON_COLORS = ["#D9D28B", "#B2BD7E", "#8E9162", "#6A795D"] as const

export function HomeToolbar() {
  const items = [
    { id: "icloud", title: "icloud", icon: "icloud", destination: <ICloudArchivesPage /> },
  ]

  return <ScrollView axes="horizontal" scrollIndicator="hidden" frame={{ height: 40 }}>
    <HStack spacing={12} padding={{ leading: 16, trailing: 16 }}>
      {items.map((item, index) => <NavigationLink key={item.id} destination={item.destination} buttonStyle="plain">
        <HStack spacing={8}
            foregroundStyle={index % BUTTON_COLORS.length === 3 ? "white" : "#253323"}
            modifiers={modifiers()
              .frame({ width: 100, height: 40 })
              .background(BUTTON_COLORS[index % BUTTON_COLORS.length])
              .clipShape({ type: "rect", cornerRadius: 10 })}>
          <Image systemName={item.icon} font="body" />
          <Text font="subheadline">{item.title}</Text>
        </HStack>
      </NavigationLink>)}
    </HStack>
  </ScrollView>
}
