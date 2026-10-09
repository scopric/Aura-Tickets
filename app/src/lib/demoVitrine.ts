// MODO DEMONSTRAÇÃO da vitrine (só desenvolvimento, ?demo=1). Dados simulados: nada daqui é gravado nem vai para produção.
// Só é importado dentro de `if (import.meta.env.DEV)`; o build de produção descarta este arquivo.
export const DEMO_SENTINELA = 'DEMO-VITRINE-SENTINELA-8f3a'
export const DEMO_FAIXA = 'MODO DEMONSTRAÇÃO — dados simulados'

// Foto abstrata gerada aqui (nenhuma pessoa real)
const foto = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2a61d"/><stop offset="1" stop-color="#7a1f3d"/></linearGradient></defs><rect width="400" height="500" fill="url(#g)"/><circle cx="130" cy="170" r="90" fill="#ffffff22"/><circle cx="290" cy="330" r="130" fill="#00000022"/></svg>`,
)}`

export const demoVitrine = {
  // Sociedade Morgenau, Av. Senador Souza Naves 945, Curitiba (consulta única ao Nominatim, só para demonstrar o mapa)
  coords: { lat: -25.4310044, lng: -49.2484121 },
  atracoes: [
    { id: 'a1', nome: 'Trio Forrozeiro do Sul', foto, instagram: 'trio.forro' },
    { id: 'a2', nome: 'Maria Sanfoneira', foto: null, instagram: null },
    { id: 'a3', nome: 'DJ Baião', foto: null, instagram: 'dj.baiao' },
    { id: 'a4', nome: 'Orquestra Sinfônica Popular Brasileira de Câmara e Convidados', foto: null, instagram: null },
  ],
  organizador: {
    nome: 'Bora Dançar Produções',
    razao_social: 'Bora Dançar Eventos LTDA',
    cnpj: '11222333000181',
    whatsapp: '5541999999999',
    instagram: 'bora.danca',
    site: 'https://www.boradancar.com.br',
    email: 'oi@boradancar.com.br',
    outras_redes: [
      { rotulo: 'TikTok', url: 'https://www.tiktok.com/@boradancar' },
      { rotulo: 'YouTube', url: 'https://www.youtube.com/@boradancar' },
      { rotulo: 'Spotify', url: 'https://open.spotify.com/user/boradancar' },
    ],
  },
}
