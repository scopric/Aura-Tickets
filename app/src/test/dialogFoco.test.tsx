import { render, screen, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'

// Foco ao fechar o modal (achados do QA e do revisor da V8d)
const espera = () => act(() => new Promise(r => setTimeout(r, 50)))

function PorEstado() {
  const [aberto, setAberto] = useState(false)
  return <>
    <button onClick={() => setAberto(true)}>abrir</button>
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent><DialogTitle>t</DialogTitle><DialogDescription>d</DialogDescription><input aria-label="campo" /></DialogContent>
    </Dialog>
  </>
}

function ComGatilho() {
  return <Dialog><DialogTrigger>gatilho</DialogTrigger>
    <DialogContent><DialogTitle>t</DialogTitle><DialogDescription>d</DialogDescription><input aria-label="campo" /></DialogContent>
  </Dialog>
}

it('aberto por estado: o Esc devolve o foco ao botão que abriu', async () => {
  render(<PorEstado />)
  const botao = screen.getByText('abrir'); botao.focus(); fireEvent.click(botao); await espera()
  expect(document.activeElement).toBe(screen.getByLabelText('campo'))
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' }); await espera()
  expect(document.activeElement).toBe(botao)
})

it('com DialogTrigger e clique que não dá foco (Safari, iOS): o foco volta ao gatilho', async () => {
  render(<ComGatilho />)
  const gatilho = screen.getByText('gatilho'); fireEvent.click(gatilho); await espera()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' }); await espera()
  expect(document.activeElement).toBe(gatilho)
})
