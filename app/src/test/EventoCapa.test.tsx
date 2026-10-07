import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import EventoCapa from '../components/EventoCapa'

const FOTO = 'https://rwaezeqyuhxrssntcxdv.supabase.co/storage/v1/object/public/capas-eventos/p/e/aaaaaaaa.webp'
const evento = { id: 'e1', title: 'Noite de Forró', date: '2026-12-12', accent_color: '#a55c65' }

describe('EventoCapa', () => {
  it('sem foto (vazio, nulo ou foto padrão) é cartaz com nome e data', () => {
    for (const cover_image of [undefined, null, '', '/images/hero-bg.jpg']) {
      const { container, unmount } = render(<EventoCapa evento={{ ...evento, cover_image }} />)
      expect(container.querySelector('img')).toBeNull()
      expect(container.querySelector('.evcapa-cz')).not.toBeNull()
      expect(container.querySelector('.evcz-tit')?.textContent).toBe('NOITEDE FORRÓ')
      expect(container.querySelector('.evcz-dia')?.textContent).toBe('12')
      expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Cartaz de Noite de Forró, 12 de dez')
      unmount()
    }
  })
  it('com foto e sem a opção: foto original inteira, com a mesma foto desfocada ao fundo (decorativa) e sem duotone', () => {
    for (const capa_na_cor of [undefined, null, false]) {
      const { container, unmount } = render(<EventoCapa evento={{ ...evento, cover_image: FOTO, capa_na_cor }} />)
      expect(container.querySelector('.evcapa-duo')).toBeNull()
      const imgs = container.querySelectorAll('.evcapa-orig img')
      expect(imgs).toHaveLength(2)
      expect(imgs[0].classList.contains('evcapa-fundo')).toBe(true)
      expect(imgs[0].getAttribute('aria-hidden')).toBe('true')
      expect(imgs[0].getAttribute('alt')).toBe('')
      expect([...imgs].map(i => i.getAttribute('src'))).toEqual([FOTO, FOTO])
      expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Capa do evento Noite de Forró')
      unmount()
    }
  })
  it('miniatura na foto original não carrega fundo: só uma imagem; foto que não carrega cai no cartaz', () => {
    const { container } = render(<EventoCapa evento={{ ...evento, cover_image: FOTO }} tamanho="mini" />)
    expect(container.querySelectorAll('img')).toHaveLength(1)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('.evcapa-cz')).not.toBeNull()
  })
  it('capa_na_cor true usa o duotone na cor do evento; a foto que não carrega cai no cartaz', () => {
    const { container } = render(<EventoCapa evento={{ ...evento, cover_image: FOTO, capa_na_cor: true }} />)
    expect(container.querySelectorAll('img')).toHaveLength(1)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe(FOTO)
    expect(container.querySelector('.evcapa-duo')).not.toBeNull()
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--duo-luz')).toBe('#eaa2aa')
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('.evcapa-cz')).not.toBeNull()
  })
  it('não usa Base64 nem esquema estranho como foto', () => {
    const { container } = render(<EventoCapa evento={{ ...evento, cover_image: 'data:image/png;base64,AAAA', image_url: 'javascript:alert(1)' }} />)
    expect(container.querySelector('img')).toBeNull()
  })
  it('miniatura é decorativa e sem texto; sem cor salva, sorteia sempre a mesma', () => {
    const sem = { id: 'e2', title: 'Festa' }
    const a = render(<EventoCapa evento={sem} tamanho="mini" />)
    expect(a.container.firstElementChild?.getAttribute('aria-hidden')).toBe('true')
    expect(a.container.textContent).toBe('')
    const cor = (a.container.firstElementChild as HTMLElement).style.getPropertyValue('--evento')
    a.unmount()
    const b = render(<EventoCapa evento={sem} tamanho="mini-p" />)
    expect((b.container.firstElementChild as HTMLElement).style.getPropertyValue('--evento')).toBe(cor)
  })
  it('a prop cor sobrepõe a cor salva (prévia do formulário)', () => {
    const { container } = render(<EventoCapa evento={evento} cor="#1f7a74" />)
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--evento')).toBe('#1f7a74')
  })
})

describe('EventoCapa: intensidade da cor', () => {
  it('sem intensidade = 100 (igual ao de antes); com 40 o --cz muda', () => {
    const cz = (accent_intensity?: number) => render(<EventoCapa evento={{ ...evento, accent_intensity }} />).container.querySelector<HTMLElement>('.evcapa')!.style.getPropertyValue('--cz')
    expect(cz(undefined)).toBe('#a55c65')
    expect(cz(100)).toBe('#a55c65')
    expect(cz(40)).not.toBe('#a55c65')
  })
})
