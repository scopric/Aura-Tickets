// Evo girando em 3D: webp animado com transparência (o vídeo HEVC com alfa falhava no iPhone).
// Movimento reduzido usa a versão de 4 s: o carregando continua se movendo, só mais devagar.
// Trocar a imagem exige nome novo (v3): /evo/ tem cache de 1 dia.
export default function PageLoading() {
  return (
    <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet="/evo/evo-giro-v2-lento.webp" />
        <img src="/evo/evo-giro-v2.webp" alt="" width={96} height={96} className="size-24" />
      </picture>
      <p className="text-sm text-muted-foreground">Carregando…</p>
    </div>
  )
}
