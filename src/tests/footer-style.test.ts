import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('footer', () => {
  it('has no top border line, so only the table bottom edge remains', () => {
    const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
    const footerTag = layout.match(/<footer[^>]*>/)?.[0] ?? ''
    expect(footerTag).not.toBe('')
    expect(footerTag).not.toMatch(/border-t/)
  })
})
