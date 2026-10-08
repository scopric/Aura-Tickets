import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TermsPage from '../pages/Terms'
import PrivacyPage from '../pages/Privacy'

const texto = (ui: React.ReactElement) => {
  render(<MemoryRouter>{ui}</MemoryRouter>)
  return document.body.textContent ?? ''
}

describe('cláusulas da meia-entrada', () => {
  it('Termos: declaração, portaria, diferença ou reembolso, taxa proporcional, não cumulativa', () => {
    const t = texto(<TermsPage />)
    expect(screen.getByText(/Ingressos com Meia-Entrada/)).toBeTruthy()
    for (const trecho of ['sob as penas da lei', 'equipe do organizador', 'pagar a diferença', 'reembolsado', 'Decreto 13.108/2026, art. 9º', 'não é cumulativa'])
      expect(t).toContain(trecho)
  })
  it('Política: dado sensível, bases do art. 11 e não retenção do documento', () => {
    const t = texto(<PrivacyPage />)
    expect(screen.getByText(/Meia-Entrada e Dados Sensíveis/)).toBeTruthy()
    for (const trecho of ['art. 5º, II', 'art. 11, II', 'não pede o documento na compra', 'Não envie esses documentos'])
      expect(t).toContain(trecho)
  })
})
