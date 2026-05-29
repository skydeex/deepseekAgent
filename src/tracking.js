const _modifiedFiles = new Set()

export function getModifiedFiles() {
  return [..._modifiedFiles]
}

export function addModifiedFile(filePath) {
  _modifiedFiles.add(filePath)
}
