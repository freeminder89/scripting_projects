import { Navigation, Script, Text, VStack } from "scripting"

function HelloWorld() {
  return (
    <VStack>
      <Text>amow said hello</Text>
    </VStack>
  )
}

Navigation.present({
  element: <HelloWorld />,
}).then(() => {
  Script.exit()
})
