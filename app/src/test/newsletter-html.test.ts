import { describe, it, expect } from 'vitest'
import { eventoNewsletterHtml } from '../pages/admin/Newsletter'
import type { DbEvent } from '../hooks/useEvents'

const evento = (e: Partial<DbEvent>) => ({ id: 'e1', title: 'Show', category: null, venue_city: null, cover_image: null, date: null, ...e }) as DbEvent

describe('HTML da newsletter do admin (campos do produtor)', () => {
  it('título, categoria e cidade saem escapados', () => {
    const html = eventoNewsletterHtml(evento({
      title: '<a href="https://phish.example">Clique</a>', category: '<b>x</b>', venue_city: 'São "Paulo" & <i>',
    }), '#7c3aed')
    expect(html).not.toContain('<a href="https://phish.example"')
    expect(html).toContain('&lt;a href=&quot;https://phish.example&quot;&gt;Clique&lt;/a&gt;')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
    expect(html).toContain('São &quot;Paulo&quot; &amp; &lt;i&gt;')
  })

  it('capa só com https:// ou /; o resto some', () => {
    expect(eventoNewsletterHtml(evento({ cover_image: 'https://cdn.x/a.jpg' }), '#000')).toContain('<img src="https://cdn.x/a.jpg"')
    expect(eventoNewsletterHtml(evento({ cover_image: '/images/a.jpg' }), '#000')).toContain('<img src="https://www.evokaa.com.br/images/a.jpg"')
    expect(eventoNewsletterHtml(evento({ cover_image: 'https://x/a.jpg" onerror="alert(1)' }), '#000')).toContain('a.jpg&quot; onerror=&quot;alert(1)"')
    for (const ruim of ['javascript:alert(1)', 'data:image/png;base64,AA', 'http://x/a.jpg', '//evil/a.jpg'])
      expect(eventoNewsletterHtml(evento({ cover_image: ruim }), '#000')).not.toContain('<img')
  })
})
