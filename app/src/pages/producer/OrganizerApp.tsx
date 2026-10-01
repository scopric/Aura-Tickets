import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/producer/ui'
import { Button } from '@/components/ui/button'

// Não há app nas lojas: o painel roda no navegador do celular e pode ir para a tela inicial (public/manifest.json).
const usos = [
  { titulo: 'Check-in na porta', desc: 'Digite o código do ingresso ou procure o nome na lista para liberar a entrada.', to: '/producer/checkin' },
  { titulo: 'Vendas', desc: 'Ingressos vendidos e valor bruto dos pedidos pagos, no Início e no Financeiro.', to: '/producer/dashboard' },
  { titulo: 'Seus eventos', desc: 'Situação de cada evento, da análise da Evokaa à publicação.', to: '/producer/events' },
]

const passos = [
  { titulo: 'Abra pelo celular', desc: 'Entre na Evokaa pelo navegador do celular (Chrome ou Safari) e faça login.' },
  { titulo: 'Abra o menu do navegador', desc: 'No Chrome, toque nos três pontos. No Safari, toque no botão de compartilhar.' },
  { titulo: 'Adicione à tela inicial', desc: 'Escolha "Adicionar à tela inicial". O atalho abre a Evokaa em tela cheia, como um app.' },
]

export default function OrganizerApp() {
  return (
    <div>
      <PageHeader title="App do Organizador" description="O painel no celular, sem baixar nada" />

      <div className="rounded-[10px] border border-border bg-card p-4 sm:p-6">
        <p className="text-sm text-foreground">A Evokaa ainda não tem app nas lojas (App Store e Google Play).</p>
        <p className="mt-1 text-sm text-muted-foreground">
          O painel funciona no navegador do celular e pode virar um atalho na tela inicial. Ele precisa de internet: não funciona sem conexão.
        </p>
      </div>

      <h2 className="mt-8 text-base font-semibold text-foreground">Como colocar na tela inicial</h2>
      <ol className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {passos.map((p, i) => (
          <li key={p.titulo} className="rounded-[10px] border border-border bg-card p-4">
            <p className="text-xs font-medium tabular-nums text-muted-foreground">Passo {i + 1}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{p.titulo}</p>
            <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
          </li>
        ))}
      </ol>

      <h2 className="mt-8 text-base font-semibold text-foreground">O que dá para fazer pelo celular</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        {usos.map(u => (
          <div key={u.titulo} className="rounded-[10px] border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">{u.titulo}</p>
            <p className="mt-1 text-sm text-muted-foreground">{u.desc}</p>
            <Button asChild variant="link" size="sm" className="mt-2 h-auto px-0">
              <Link to={u.to} aria-label={`Abrir: ${u.titulo}`}>Abrir</Link>
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
