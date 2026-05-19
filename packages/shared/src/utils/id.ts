let counter = 0

export function nanoid(prefix = ""): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  const seq = (counter++).toString(36)
  return `${prefix}${ts}${rand}${seq}`
}
