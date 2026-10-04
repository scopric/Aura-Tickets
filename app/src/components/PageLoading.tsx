// Evo girando em 3D (vídeo com transparência): .mov HEVC para Safari/iPhone, .webm VP9 para o resto.
// Trocar o vídeo exige nome novo (v2): /evo/ tem cache de 1 dia.
// Movimento reduzido: o carregando continua se movendo, só mais devagar.
// iPhone em economia de energia não toca sozinho: fica o pôster, sem o botão de play por cima.
const devagar = (v: HTMLVideoElement | null) => {
  if (v && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    v.defaultPlaybackRate = 0.5
    v.playbackRate = 0.5
  }
}

export default function PageLoading() {
  return (
    <div role="status" className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <video
        aria-hidden="true"
        autoPlay
        muted
        loop
        playsInline
        width={96}
        height={96}
        poster="/evo/evo-giro-v1.webp"
        className="size-24 [&::-webkit-media-controls-start-playback-button]:hidden"
        ref={devagar}
      >
        <source src="/evo/evo-giro-v1.mov" type='video/quicktime; codecs="hvc1"' />
        <source src="/evo/evo-giro-v1.webm" type="video/webm" />
      </video>
      <p className="text-sm text-muted-foreground">Carregando…</p>
    </div>
  )
}
