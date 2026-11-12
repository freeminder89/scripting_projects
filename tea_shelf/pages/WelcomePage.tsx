import { NavigationStack, Script, ScrollView, Text, VStack } from "scripting"
import { TeasPage } from "./teas/TeasPage"
import { HomeToolbar } from "./HomeToolbar"

export function WelcomePage() {
  return <NavigationStack>
    <ScrollView axes="vertical"
        navigationTitle="茶管家" navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Text font={9} foregroundStyle="secondaryLabel">
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
