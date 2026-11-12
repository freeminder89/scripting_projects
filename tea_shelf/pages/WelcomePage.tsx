import { NavigationStack, Script, Text, VStack } from "scripting"
import { TeasPage } from "./teas/TeasPage"
import { HomeToolbar } from "./HomeToolbar"

export function WelcomePage() {
  return <NavigationStack>
    <VStack spacing={0} alignment="leading"
        navigationTitle="茶管家" navigationBarTitleDisplayMode="inline"
        toolbar={{
          topBarLeading: <Text font={9} foregroundStyle="secondaryLabel">
            版本 {Script.metadata.version}
          </Text>,
        }}
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
      <HomeToolbar />
      <TeasPage />
    </VStack>
  </NavigationStack>
}
