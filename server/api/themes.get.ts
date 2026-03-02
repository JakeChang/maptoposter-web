export default defineEventHandler(async () => {
  try {
    const storage = useStorage('assets:themes')
    const keys = await storage.getKeys()
    const themes = []

    for (const key of keys) {
      if (key.endsWith('.json')) {
        const theme = await storage.getItem(key) as Record<string, unknown>
        themes.push({
          id: key.replace('.json', ''),
          ...theme
        })
      }
    }

    return themes.sort((a, b) => a.id.localeCompare(b.id))
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to load themes'
    })
  }
})
