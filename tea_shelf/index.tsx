import { Navigation, Script } from "scripting"
import { storage } from "./core/storage"
import { WelcomePage } from "./pages/WelcomePage"

async function main() {
  try {
    await storage.start()
    await Navigation.present({ element: <WelcomePage /> })
  } finally {
    try {
      await storage.stop()
    } finally {
      Script.exit()
    }
  }
}

void main().catch(error => console.error("tea_shelf:", error))
