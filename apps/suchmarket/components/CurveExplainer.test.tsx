import { describe, expect, it } from 'vitest'
import { explainPoolForArtist } from '@/lib/quotes'

describe('CurveExplainer copy helpers', () => {
  it('describes trade pools for artists', () => {
    const text = explainPoolForArtist(2)
    expect(text.toLowerCase()).toContain('trade pool')
    expect(text.toLowerCase()).toContain('fee')
  })

  it('describes sell pools', () => {
    expect(explainPoolForArtist(1).toLowerCase()).toContain('sell pool')
  })

  it('describes buy pools', () => {
    expect(explainPoolForArtist(0).toLowerCase()).toContain('buy pool')
  })
})
