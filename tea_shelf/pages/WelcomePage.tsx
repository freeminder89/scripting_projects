import {
  Image, LazyVGrid, NavigationLink, NavigationStack, Script, ScrollView, Text, VStack,
} from "scripting"
import { BrandsPage } from "./brands/BrandsPage"
import { TeasPage } from "./teas/TeasPage"

export function WelcomePage() {
  return <NavigationStack>
    <ScrollView navigationTitle="茶架">
      <VStack alignment="leading" spacing={24} padding={16}>
        <VStack alignment="leading" spacing={6}>
          <Text font="title">欢迎使用茶架</Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel">版本 {Script.metadata.version}</Text>
        </VStack>
        <LazyVGrid
          columns={[
            { size: { type: "flexible", min: 0 } },
            { size: { type: "flexible", min: 0 } },
            { size: { type: "flexible", min: 0 } },
          ]}
          spacing={12}
        >
          <NavigationLink destination={<BrandsPage />}>
            <VStack
                spacing={12}
                frame={{ maxWidth: "infinity", height: 112 }}
                background="systemGray6"
                clipShape={{ type: "rect", cornerRadius: 16 }}
            >
              <Image systemName="tag.fill" font="title" foregroundStyle="systemGreen" />
              <Text font="subheadline" foregroundStyle="label">品牌管理</Text>
            </VStack>
          </NavigationLink>
          <NavigationLink destination={<TeasPage />}>
            <VStack spacing={12} frame={{ maxWidth: "infinity", height: 112 }}
                background="systemGray6" clipShape={{ type: "rect", cornerRadius: 16 }}>
              <Image systemName="leaf.fill" font="title" foregroundStyle="systemGreen" />
              <Text font="subheadline" foregroundStyle="label">茶品管理</Text>
            </VStack>
          </NavigationLink>
        </LazyVGrid>
      </VStack>
    </ScrollView>
  </NavigationStack>
}
