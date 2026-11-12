import { NavigationStack, Script, ScrollView, Text, VStack } from "scripting"
import { TeasPage } from "./teas/TeasPage"
import { HomeToolbar } from "./HomeToolbar"
import { teaTheme } from "../core/theme"

export function WelcomePage() {
  return <NavigationStack tint={teaTheme.accent}>
    <ScrollView axes="vertical"
        navigationTitle="茶管家" navigationBarTitleDisplayMode="inline"
        background={teaTheme.background}
        foregroundStyle={teaTheme.text}
        toolbarBackground={{ style: teaTheme.background, bars: ["navigationBar"] }}
        toolbarBackgroundVisibility={{ visibility: "visible", bars: ["navigationBar"] }}
        toolbar={{
          topBarLeading: <Text font={9} foregroundStyle={teaTheme.version}>
            版本 {Script.metadata.version}
          </Text>,
        }}
    >
      <VStack spacing={0} alignment="leading" frame={{ maxWidth: "infinity", alignment: "leading" }}>
        <HomeToolbar />
        <TeasPage />
      </VStack>
    </ScrollView>
  </NavigationStack>
}
