import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Ban, CheckCircle2, Printer, SearchX, WifiOff } from 'lucide-react'
import { codigoValido, validarCertificado } from '../lib/certificadoValidar'
import { dataLonga, modeloComCor, modeloPorId, sanearTemplate, type DadosCertificado } from '../lib/certificados'
import { CertificadoDesenho, ImpressaoCertificados } from '../components/producer/CertificadoDesenho'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// Página pública de validação (/certificado/<código>): confirma que o certificado existe e mostra só o mínimo.
// Sem login. O código é um uuid aleatório (122 bits): quem o tem, tem o certificado nas mãos. Não é indexada por buscadores.
export default function CertificadoValidacao() {
  const { codigo = '' } = useParams()
  const formatoOk = codigoValido(codigo.trim())

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'; meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    const titulo = document.title
    document.title = 'Validar certificado | Evokaa'
    return () => { meta.remove(); document.title = titulo }
  }, [])

  const [impressao, setImpressao] = useState(0) // 0 = fechado; a cada clique uma key nova (no Safari do iPhone o afterprint pode não vir)

  const q = useQuery({
    queryKey: ['certificado-validar', codigo],
    queryFn: () => validarCertificado(codigo),
    enabled: formatoOk,
    retry: false,
    staleTime: 60_000,
  })

  const linha = (rotulo: string, valor: string | null) => valor ? (
    <div className="flex flex-col gap-0.5 border-b border-border py-3 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-sm font-medium text-foreground sm:text-right">{valor}</dd>
    </div>
  ) : null

  let corpo
  if (formatoOk && q.isPending) {
    corpo = <div aria-busy="true" role="status" aria-label="Consultando o certificado"><Skeleton className="h-8 w-2/3 rounded-md bg-muted" /><Skeleton className="mt-6 h-40 rounded-[10px] bg-muted" /></div>
  } else if (formatoOk && q.isError) {
    corpo = (
      <div role="alert" className="rounded-[10px] border border-border bg-card p-6">
        <WifiOff aria-hidden="true" className="size-6 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-semibold text-foreground">Não foi possível consultar agora</h1>
        <p className="mt-1 text-sm text-muted-foreground">Confira a conexão e tente de novo. Isso não quer dizer que o certificado seja inválido.</p>
        <Button className="mt-4" variant="outline" onClick={() => q.refetch()} loading={q.isFetching}>Tentar de novo</Button>
      </div>
    )
  } else if (q.data?.valido) {
    const c = q.data
    // O modelo vem do banco como JSON livre do produtor: passa pelo mesmo saneamento do editor (imagens só data: png/jpeg/webp ou bucket do projeto)
    const t = c.modelo ? sanearTemplate(c.modelo) : null
    const modelo = t ? modeloComCor(modeloPorId(t.selectedTemplate), t.accentColor) : null
    const dados: DadosCertificado = {
      nome: c.nome ?? '', evento: c.evento, data: dataLonga(c.data_evento), horas: c.horas || t?.horas || '___',
      emissao: c.emitido_em.split('-').reverse().join('/'), codigo: codigo.trim().toLowerCase(),
    }
    corpo = (
      <>
      <div className="rounded-[10px] border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <CheckCircle2 aria-hidden="true" className="size-7 shrink-0 text-[var(--ev-success)]" />
          <h1 className="text-xl font-semibold text-foreground">Certificado válido</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Este certificado foi emitido pela Evokaa para o evento abaixo. Compare os dados com os do documento que você recebeu.</p>
        <dl className="mt-4">
          {linha('Participante', c.nome)}
          {linha('Evento', c.evento)}
          {linha('Data do evento', dataLonga(c.data_evento))}
          {linha('Organizador', c.organizador)}
          {linha('Carga horária', c.horas ? `${c.horas} h` : null)}
          {linha('Emitido em', dataLonga(c.emitido_em))}
        </dl>
        <p className="mt-4 break-all text-xs text-muted-foreground">Código: <span className="font-mono">{codigo.trim().toLowerCase()}</span></p>
      </div>
      {t && modelo && (
        <section aria-labelledby="cert-ver" className="mt-6">
          <h2 id="cert-ver" className="mb-3 text-base font-semibold text-foreground">Seu certificado</h2>
          <div role="img" aria-label={`Certificado de ${dados.nome || 'participante'} no evento ${c.evento}`} className="overflow-hidden rounded-[10px] border border-border bg-card">
            <CertificadoDesenho modelo={modelo} campos={t.fields} logoUrl={t.logoUrl} sigUrl={t.sigUrl} dados={dados} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button onClick={() => setImpressao(n => n + 1)}><Printer aria-hidden="true" />Baixar PDF</Button>
            <p className="text-xs text-muted-foreground">Na janela que abrir, escolha &quot;Salvar como PDF&quot; como impressora (A4 paisagem).</p>
          </div>
          {impressao > 0 && <ImpressaoCertificados key={impressao} itens={[{ dados }]} modelo={modelo} campos={t.fields} logoUrl={t.logoUrl} sigUrl={t.sigUrl} onFim={() => setImpressao(0)} />}
        </section>
      )}
      </>
    )
  } else if (q.data && !q.data.valido && q.data.revogado) {
    corpo = (
      <div className="rounded-[10px] border border-border bg-card p-6">
        <Ban aria-hidden="true" className="size-7 text-destructive" />
        <h1 className="mt-3 text-xl font-semibold text-foreground">Certificado revogado</h1>
        <p className="mt-1 text-sm text-muted-foreground">Este certificado foi revogado em {dataLonga(q.data.revogado_em)} e não vale mais. Se tiver dúvida, fale com o organizador do evento.</p>
        <p className="mt-4 break-all text-xs text-muted-foreground">Código: <span className="font-mono">{codigo.trim().toLowerCase()}</span></p>
      </div>
    )
  } else {
    corpo = (
      <div className="rounded-[10px] border border-border bg-card p-6">
        <SearchX aria-hidden="true" className="size-7 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-semibold text-foreground">Não encontramos este certificado</h1>
        <p className="mt-1 text-sm text-muted-foreground">O código pode estar incompleto ou errado, ou o certificado não vale mais. Confira o código impresso no documento e tente de novo. Se continuar assim, fale com o organizador do evento.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-12 sm:py-16">
      {corpo}
      <p className="mt-6 text-xs text-muted-foreground">Mostramos só o necessário para conferir o certificado: não exibimos e-mail, CPF nem telefone. <Link to="/privacidade" className="underline underline-offset-4">Política de Privacidade</Link>.</p>
    </div>
  )
}
