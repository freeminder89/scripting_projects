import { Navigation, Script } from "scripting"
import { storage } from "./core/storage"
import { WelcomePage } from "./pages/WelcomePage"
import { formatError } from "./core/errors"

async function main() {
  try {
    await storage.start()
    await Navigation.present({ element: <WelcomePage /> })
  } catch (error) {
    console.error("tea_shelf:", error)
    await Dialog.alert({ title: "茶管家启动失败", message: formatError(error) })
  } finally {
    try {
      await storage.stop()
    } catch (error) {
      console.error("tea_shelf storage stop:", error)
      await Dialog.alert({ title: "茶管家存储关闭失败", message: formatError(error) })
    } finally {
      Script.exit()
    }
  }
}

void main().catch(error => console.error("tea_shelf:", error))
