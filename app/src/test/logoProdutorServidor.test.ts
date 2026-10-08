import { describe, it, expect } from 'vitest'
import { caber, dimensoes, tipoImagem, urlLogoValida } from '../../../supabase/functions/_shared/logoProdutor'

const ID = '11111111-2222-3333-4444-555555555555'
const BASE = 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/'
const PNG = (w: number, h: number) => { const b = new Uint8Array(33); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); new DataView(b.buffer).setUint32(16, w); new DataView(b.buffer).setUint32(20, h); return b }

describe('logo do produtor no servidor', () => {
  it('só aceita URL do bucket, na pasta do próprio produtor', () => {
    expect(urlLogoValida(`${BASE}${ID}/abcdefgh12.png`, ID)).toBe(true)
    expect(urlLogoValida(`${BASE}${ID}/abcdefgh12.webp`, ID)).toBe(true)
    for (const ruim of [
      `${BASE}99999999-2222-3333-4444-555555555555/abcdefgh12.png`, // pasta de outro produtor
      'https://evil.example/logo.png', `${BASE}${ID}/abcdefgh12.png?x=1`, `${BASE}${ID}/../abcdefgh12.png`,
      `http://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/logos-produtor/${ID}/abcdefgh12.png`,
      `https://rwaezeqyuhxrssntcxdv.supabase.co.evil.example/storage/v1/object/public/logos-produtor/${ID}/abcdefgh12.png`,
      `https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/capas-eventos/${ID}/abcdefgh12.png`, null, 42, '',
    ]) expect(urlLogoValida(ruim, ID)).toBe(false)
    expect(urlLogoValida(`${BASE}${ID}/abcdefgh12.png`, 'nao-e-uuid')).toBe(false)
  })
  it('tipo pelos bytes: png e jpeg sim; html, svg e webp não', () => {
    expect(tipoImagem(PNG(1, 1))).toBe('png')
    expect(tipoImagem(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('jpeg')
    expect(tipoImagem(new TextEncoder().encode('<html><script>alert(1)</script>'))).toBeNull()
    expect(tipoImagem(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
    expect(tipoImagem(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBeNull()
  })
  it('lê as medidas do PNG e do JPEG', () => {
    expect(dimensoes(PNG(300, 80), 'png')).toEqual({ w: 300, h: 80 })
    // SOI, APP0 (len 4), SOF0 com 60 de altura e 200 de largura
    const j = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0, 0, 0xff, 0xc0, 0x00, 0x11, 8, 0x00, 0x3c, 0x00, 0xc8, 3, 0, 0, 0, 0, 0, 0, 0])
    expect(dimensoes(j, 'jpeg')).toEqual({ w: 200, h: 60 })
    expect(dimensoes(new Uint8Array([0xff, 0xd8, 0xff]), 'jpeg')).toBeNull()
  })
  it('cabe na caixa mantendo a proporção e nunca amplia', () => {
    expect(caber({ w: 300, h: 80 }, 120, 44)).toEqual({ width: 120, height: 32 })
    expect(caber({ w: 100, h: 100 }, 120, 44)).toEqual({ width: 44, height: 44 })
    expect(caber({ w: 50, h: 20 }, 120, 44)).toEqual({ width: 50, height: 20 })
    expect(caber(null, 120, 44)).toEqual({ width: 44, height: 44 })
  })
})
