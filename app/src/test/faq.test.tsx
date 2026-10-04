import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ProducerFAQ, { filtrarFaq, producerFAQs, affiliateFAQs } from '../pages/producer/FAQ'

const montar = () => render(<MemoryRouter><ProducerFAQ /></MemoryRouter>)

describe('Ajuda (FAQ)', () => {
  it('filtrarFaq ignora acento e caixa, e exige todas as palavras', () => {
    expect(filtrarFaq(producerFAQs, '').length).toBe(producerFAQs.length)
    const achou = filtrarFaq(producerFAQs, 'ORCAMENTO')
    expect(achou.length).toBeGreaterThan(0)
    expect(achou.every(i => /or[cç]amento/i.test(`${i.question} ${i.answer}`))).toBe(true)
    expect(filtrarFaq(producerFAQs, 'orcamento xyzinexistente')).toHaveLength(0)
  })

  it('a tela filtra pela busca e avisa quando nada bate', () => {
    montar()
    expect(screen.getByText('Como criar cupons de desconto?')).toBeInTheDocument()
    const campo = screen.getByRole('searchbox', { name: 'Buscar nas perguntas e respostas' })
    fireEvent.change(campo, { target: { value: 'cupons' } })
    expect(screen.getByText('Como criar cupons de desconto?')).toBeInTheDocument()
    expect(screen.queryByText('Como funciona o cronograma do evento?')).not.toBeInTheDocument()
    fireEvent.change(campo, { target: { value: 'zzzz' } })
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma pergunta encontrada')
  })

  it('toda resposta tem data de revisão e todo link aponta para rota que existe no App.tsx', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8')
    for (const i of [...producerFAQs, ...affiliateFAQs]) {
      expect(i.atualizado).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
      for (const l of i.links ?? []) expect(app).toContain(`path="${l.rota}"`)
    }
  })

  it('não promete cupom aplicado na compra', () => {
    const cupons = producerFAQs.find(i => i.question.includes('cupons'))!
    expect(cupons.answer).toMatch(/ainda não aplica/)
  })
})
