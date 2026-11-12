import { HStack, Image, NavigationLink, ScrollView, Text, VStack, modifiers } from "scripting"
import { ICloudArchivesPage } from "./icloud/ICloudArchivesPage"

export function HomeToolbar() {
  return <ScrollView axes="horizontal" scrollIndicator="hidden" frame={{ height: 80 }}>
    <HStack spacing={12} padding={{ leading: 16, trailing: 16 }}>
      <NavigationLink destination={<ICloudArchivesPage />} buttonStyle="plain">
        <VStack spacing={8} modifiers={modifiers()
          .frame({ width: 100, height: 80 })
          .background("systemGray6")
          .clipShape({ type: "rect", cornerRadius: 12 })}>
          <Image systemName="icloud" font="title" foregroundStyle="systemBlue" />
          <Text font="subheadline" foregroundStyle="label">icloud</Text>
        </VStack>
      </NavigationLink>
    </HStack>
  </ScrollView>
}
