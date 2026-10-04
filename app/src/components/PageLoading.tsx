// Carregando de tela: a cabeça do Evo girando. Com "reduzir movimento" continua girando, mais devagar:
// é informação, não enfeite (contrato §5.3, igual ao Spinner dos botões, que continuam com o círculo).
export default function PageLoading() {
  return (
    <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <span aria-hidden="true" className="[perspective:600px]">
        <img
          src="/evo/evo-cabeca.webp"
          alt=""
          width={64}
          height={64}
          className="size-16 animate-[evo-girando_1.4s_linear_infinite] motion-reduce:[animation-duration:3s]"
        />
      </span>
      <p className="text-sm text-muted-foreground">Carregando…</p>
    </div>
  )
}
