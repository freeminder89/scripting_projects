import { NavigationStack, Script, Text, VStack } from "scripting"
import { TeasPage } from "./teas/TeasPage"

export function WelcomePage() {
  return <NavigationStack>
    <VStack spacing={0} alignment="leading"
        frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
      <Text font={9} foregroundStyle="secondaryLabel"
          padding={{ top: 8, bottom: 8, leading: 16, trailing: 16 }}>
        版本 {Script.metadata.version}
      </Text>
      <TeasPage />
    </VStack>
  </NavigationStack>
}
