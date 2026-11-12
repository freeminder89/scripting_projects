import { TeaShelfStorage } from "./storage"

export * from "./storage"

/** Data lives outside the remotely replaceable script directory. */
export const storage = new TeaShelfStorage({
  fs: {
    exists: path => FileManager.exists(path),
    isDirectory: path => FileManager.isDirectory(path),
    createDirectory: (path, recursive) => FileManager.createDirectory(path, recursive),
    readDirectory: path => FileManager.readDirectory(path),
    readAsString: path => FileManager.readAsString(path),
    writeAsString: (path, content) => FileManager.writeAsString(path, content),
    rename: (from, to) => FileManager.rename(from, to),
    remove: path => FileManager.remove(path),
  },
  localDirectory: `${FileManager.appGroupDocumentsDirectory}/tea_shelf`,
  backupDirectory: () => FileManager.isiCloudEnabled
    ? `${FileManager.iCloudDocumentsDirectory}/tea_shelf`
    : null,
  onError: error => console.error("tea_shelf storage:", error),
})
