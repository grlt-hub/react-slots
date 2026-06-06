type WithOrder = { order?: number | undefined }

const insertSorted = <T extends WithOrder>(list: readonly T[], element: T): readonly T[] => {
  const elementOrder = element.order ?? 0
  const insertIndex = list.findIndex((existing) => (existing.order ?? 0) > elementOrder)

  return list.toSpliced(insertIndex === -1 ? list.length : insertIndex, 0, element)
}

export { insertSorted, type WithOrder }
