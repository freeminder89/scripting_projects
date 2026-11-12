import { HStack, Image, NavigationLink, Text, VStack, modifiers } from "scripting"
import { ICloudArchivesPage } from "./icloud/ICloudArchivesPage"
import { teaTheme } from "../core/theme"

export function HomeToolbar() {
  const items = [
    { id: "icloud", title: "icloud", icon: "icloud", destination: <ICloudArchivesPage /> },
  ]

  return <HStack spacing={12} padding={{ top: 12, leading: 16, trailing: 16 }}
      frame={{ maxWidth: "infinity", minHeight: 80, alignment: "leading" }}>
      {items.map(item => <NavigationLink key={item.id} destination={item.destination} buttonStyle="plain">
        <VStack spacing={8}
            foregroundStyle={teaTheme.buttonText}
            modifiers={modifiers()
              .frame({ width: 80, height: 80 })
              .background(teaTheme.button)
              .clipShape({ type: "rect", cornerRadius: 10 })}>
          <Image systemName={item.icon} font={30} />
          <Text font={9}>{item.title}</Text>
        </VStack>
      </NavigationLink>)}
  </HStack>
}
