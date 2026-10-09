// Linhas COPIADAS (extraídas por script) das sementes de task_templates em docs/sql/20261107_quadro_f2c_botoes_modelos.sql
export const SEMENTES_MODELOS = [
 {
  "key": "show",
  "name": "Show",
  "items": [
   {
    "titulo": "Contratar som, luz e palco",
    "papel": "fornecedores",
    "dias": 45,
    "vinculos": [
     "parceiro"
    ]
   },
   {
    "titulo": "Fechar o line-up e os cachês",
    "papel": "fornecedores",
    "dias": 40,
    "vinculos": [
     "parceiro"
    ]
   },
   {
    "titulo": "Abrir a venda do primeiro lote",
    "papel": "divulgacao",
    "dias": 40,
    "vinculos": [
     "ingresso"
    ]
   },
   {
    "titulo": "Conferir licenças e alvará",
    "papel": "juridico",
    "dias": 30,
    "vinculos": [
     "evento"
    ]
   },
   {
    "titulo": "Definir o plano de segurança e brigada",
    "papel": "portaria",
    "dias": 21,
    "vinculos": [
     "equipe"
    ]
   },
   {
    "titulo": "Montar o cronograma do dia",
    "papel": "fornecedores",
    "dias": 14,
    "vinculos": [
     "cronograma"
    ]
   },
   {
    "titulo": "Credenciar imprensa e convidados",
    "papel": "divulgacao",
    "dias": 10,
    "vinculos": [
     "participantes"
    ]
   },
   {
    "titulo": "Testar o check-in",
    "papel": "portaria",
    "dias": 3,
    "vinculos": [
     "checkin"
    ]
   },
   {
    "titulo": "Ensaio geral e passagem de som",
    "papel": "fornecedores",
    "dias": 1,
    "vinculos": [
     "cronograma"
    ]
   }
  ]
 },
 {
  "key": "festa",
  "name": "Festa",
  "items": [
   {
    "titulo": "Fechar o local e a data",
    "papel": "fornecedores",
    "dias": 40,
    "vinculos": [
     "evento"
    ]
   },
   {
    "titulo": "Contratar bar, DJ e decoração",
    "papel": "fornecedores",
    "dias": 30,
    "vinculos": [
     "parceiro"
    ]
   },
   {
    "titulo": "Abrir a venda de ingressos e lista",
    "papel": "divulgacao",
    "dias": 30,
    "vinculos": [
     "ingresso"
    ]
   },
   {
    "titulo": "Definir regras de saída e brigada",
    "papel": "portaria",
    "dias": 14,
    "vinculos": [
     "equipe"
    ]
   },
   {
    "titulo": "Montar a lista de convidados",
    "papel": "divulgacao",
    "dias": 7,
    "vinculos": [
     "participantes"
    ]
   },
   {
    "titulo": "Briefing da portaria",
    "papel": "portaria",
    "dias": 3,
    "vinculos": [
     "checkin"
    ]
   }
  ]
 },
 {
  "key": "curso",
  "name": "Curso",
  "items": [
   {
    "titulo": "Reservar a sala e o material",
    "papel": "fornecedores",
    "dias": 30,
    "vinculos": [
     "evento"
    ]
   },
   {
    "titulo": "Publicar o conteúdo programático",
    "papel": "divulgacao",
    "dias": 30,
    "vinculos": [
     "evento"
    ]
   },
   {
    "titulo": "Abrir as inscrições",
    "papel": "divulgacao",
    "dias": 28,
    "vinculos": [
     "ingresso"
    ]
   },
   {
    "titulo": "Confirmar os instrutores",
    "papel": "fornecedores",
    "dias": 14,
    "vinculos": [
     "equipe"
    ]
   },
   {
    "titulo": "Preparar a lista de presença",
    "papel": "portaria",
    "dias": 3,
    "vinculos": [
     "participantes"
    ]
   },
   {
    "titulo": "Emitir os certificados",
    "papel": "divulgacao",
    "dias": -1,
    "vinculos": [
     "certificados"
    ]
   }
  ]
 },
 {
  "key": "congresso",
  "name": "Congresso",
  "items": [
   {
    "titulo": "Fechar o espaço e a infraestrutura",
    "papel": "fornecedores",
    "dias": 90,
    "vinculos": [
     "evento"
    ]
   },
   {
    "titulo": "Abrir a chamada de palestrantes",
    "papel": "divulgacao",
    "dias": 80,
    "vinculos": [
     "divulgacao"
    ]
   },
   {
    "titulo": "Abrir a venda do primeiro lote",
    "papel": "divulgacao",
    "dias": 70,
    "vinculos": [
     "ingresso"
    ]
   },
   {
    "titulo": "Fechar patrocinadores",
    "papel": "financeiro",
    "dias": 60,
    "vinculos": [
     "parceiro"
    ]
   },
   {
    "titulo": "Montar a grade e o cronograma",
    "papel": "fornecedores",
    "dias": 30,
    "vinculos": [
     "cronograma"
    ]
   },
   {
    "titulo": "Credenciar imprensa e palestrantes",
    "papel": "divulgacao",
    "dias": 14,
    "vinculos": [
     "participantes"
    ]
   },
   {
    "titulo": "Testar check-in e credenciais",
    "papel": "portaria",
    "dias": 3,
    "vinculos": [
     "checkin"
    ]
   },
   {
    "titulo": "Enviar certificados e pesquisa",
    "papel": "divulgacao",
    "dias": -1,
    "vinculos": [
     "certificados"
    ]
   }
  ]
 }
]
