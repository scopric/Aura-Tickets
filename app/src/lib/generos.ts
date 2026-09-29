// Lista fechada de gêneros de evento (contrato do Evo, 29/09/2026). O valor vai para
// events.settings.genero e para o formulário "Planejar meu primeiro evento".
export const GENEROS = [
  { valor: 'forro', rotulo: 'Forró' },
  { valor: 'sertanejo', rotulo: 'Sertanejo' },
  { valor: 'funk', rotulo: 'Funk' },
  { valor: 'eletronica', rotulo: 'Eletrônica' },
  { valor: 'pagode_samba', rotulo: 'Pagode e samba' },
  { valor: 'rock', rotulo: 'Rock' },
  { valor: 'gospel', rotulo: 'Gospel' },
  { valor: 'corporativo', rotulo: 'Corporativo' },
  { valor: 'formatura', rotulo: 'Formatura' },
  { valor: 'casamento', rotulo: 'Casamento' },
  { valor: 'infantil', rotulo: 'Infantil' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

export type Genero = (typeof GENEROS)[number]['valor']
