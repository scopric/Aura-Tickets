// Carregando de tela: a cabeça do Evo girando (os botões continuam com o Spinner). Com "reduzir movimento"
// continua girando, mais devagar (contrato §5.3): 3 s por volta, porque o 1,6 s do Spinner quase não
// desacelera um giro que já é de 1,4 s.
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
