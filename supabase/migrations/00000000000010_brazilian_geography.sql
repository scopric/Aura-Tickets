-- MIGRATION: 00000000000010_brazilian_geography.sql
-- Objetivo: Estrutura e dados de estados e cidades do Brasil para auxiliar no preenchimento de endereços.

-- 1. CRIAR TABELA DE ESTADOS
CREATE TABLE IF NOT EXISTS public.states (
  id SERIAL PRIMARY KEY,
  uf VARCHAR(2) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL
);

-- 2. CRIAR TABELA DE CIDADES
CREATE TABLE IF NOT EXISTS public.cities (
  id SERIAL PRIMARY KEY,
  state_id INT NOT NULL REFERENCES public.states(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  UNIQUE(state_id, name)
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para consulta pública (leitura para anon e authenticated)
DROP POLICY IF EXISTS "Leitura pública de estados" ON public.states;
CREATE POLICY "Leitura pública de estados" ON public.states
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Leitura pública de cidades" ON public.cities;
CREATE POLICY "Leitura pública de cidades" ON public.cities
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3. INSERIR ESTADOS (26 Estados + Distrito Federal)
INSERT INTO public.states (id, uf, name) VALUES
(1, 'AC', 'Acre'),
(2, 'AL', 'Alagoas'),
(3, 'AM', 'Amazonas'),
(4, 'AP', 'Amapá'),
(5, 'BA', 'Bahia'),
(6, 'CE', 'Ceará'),
(7, 'DF', 'Distrito Federal'),
(8, 'ES', 'Espírito Santo'),
(9, 'GO', 'Goiás'),
(10, 'MA', 'Maranhão'),
(11, 'MG', 'Minas Gerais'),
(12, 'MS', 'Mato Grosso do Sul'),
(13, 'MT', 'Mato Grosso'),
(14, 'PA', 'Pará'),
(15, 'PB', 'Paraíba'),
(16, 'PE', 'Pernambuco'),
(17, 'PI', 'Piauí'),
(18, 'PR', 'Paraná'),
(19, 'RJ', 'Rio de Janeiro'),
(20, 'RN', 'Rio Grande do Norte'),
(21, 'RO', 'Rondônia'),
(22, 'RR', 'Roraima'),
(23, 'RS', 'Rio Grande do Sul'),
(24, 'SC', 'Santa Catarina'),
(25, 'SE', 'Sergipe'),
(26, 'SP', 'São Paulo'),
(27, 'TO', 'Tocantins')
ON CONFLICT (uf) DO UPDATE SET name = EXCLUDED.name;

-- Ajustar o sequenciador de states
SELECT setval('public.states_id_seq', (SELECT MAX(id) FROM public.states));

-- 4. INSERIR CIDADES (Capitais e polos econômicos de cada UF)
INSERT INTO public.cities (state_id, name) VALUES
-- Acre
(1, 'Rio Branco'), (1, 'Cruzeiro do Sul'), (1, 'Sena Madureira'), (1, 'Tarauacá'), (1, 'Feijó'),
-- Alagoas
(2, 'Maceió'), (2, 'Arapiraca'), (2, 'Palmeira dos Índios'), (2, 'Rio Largo'), (2, 'União dos Palmares'),
-- Amazonas
(3, 'Manaus'), (3, 'Parintins'), (3, 'Itacoatiara'), (3, 'Manacapuru'), (3, 'Coari'),
-- Amapá
(4, 'Macapá'), (4, 'Santana'), (4, 'Laranjal do Jari'), (4, 'Oiapoque'),
-- Bahia
(5, 'Salvador'), (5, 'Feira de Santana'), (5, 'Vitória da Conquista'), (5, 'Camaçari'), (5, 'Juazeiro'), (5, 'Itabuna'), (5, 'Ilhéus'), (5, 'Porto Seguro'), (5, 'Barreiras'),
-- Ceará
(6, 'Fortaleza'), (6, 'Caucaia'), (6, 'Juazeiro do Norte'), (6, 'Maracanaú'), (6, 'Sobral'), (6, 'Crato'), (6, 'Itapipoca'),
-- Distrito Federal
(7, 'Brasília'),
-- Espírito Santo
(8, 'Vitória'), (8, 'Vila Velha'), (8, 'Serra'), (8, 'Cariacica'), (8, 'Cachoeiro de Itapemirim'), (8, 'Linhares'), (8, 'Guarapari'),
-- Goiás
(9, 'Goiânia'), (9, 'Aparecida de Goiânia'), (9, 'Anápolis'), (9, 'Rio Verde'), (9, 'Luziânia'), (9, 'Valparaíso de Goiás'), (9, 'Caldas Novas'),
-- Maranhão
(10, 'São Luís'), (10, 'Imperatriz'), (10, 'Timon'), (10, 'Caxias'), (10, 'Codó'), (10, 'Açailândia'),
-- Minas Gerais
(11, 'Belo Horizonte'), (11, 'Uberlândia'), (11, 'Contagem'), (11, 'Juiz de Fora'), (11, 'Betim'), (11, 'Montes Claros'), (11, 'Uberaba'), (11, 'Governador Valadares'), (11, 'Ipatinga'), (11, 'Sete Lagoas'), (11, 'Divinópolis'), (11, 'Poços de Caldas'),
-- Mato Grosso do Sul
(12, 'Campo Grande'), (12, 'Dourados'), (12, 'Três Lagoas'), (12, 'Corumbá'), (12, 'Ponta Porã'),
-- Mato Grosso
(13, 'Cuiabá'), (13, 'Várzea Grande'), (13, 'Rondonópolis'), (13, 'Sinop'), (13, 'Tangará da Serra'), (13, 'Cáceres'),
-- Pará
(14, 'Belém'), (14, 'Ananindeua'), (14, 'Santarém'), (14, 'Marabá'), (14, 'Castanhal'), (14, 'Parauapebas'), (14, 'Itaituba'), (14, 'Altamira'),
-- Paraíba
(15, 'João Pessoa'), (15, 'Campina Grande'), (15, 'Santa Rita'), (15, 'Patos'), (15, 'Sousa'), (15, 'Cabedelo'),
-- Pernambuco
(16, 'Recife'), (16, 'Jaboatão dos Guararapes'), (16, 'Olinda'), (16, 'Caruaru'), (16, 'Petrolina'), (16, 'Paulista'), (16, 'Cabo de Santo Agostinho'), (16, 'Garanhuns'),
-- Piauí
(17, 'Teresina'), (17, 'Parnaíba'), (17, 'Picos'), (17, 'Floriano'), (17, 'Piripiri'),
-- Paraná
(18, 'Curitiba'), (18, 'Londrina'), (18, 'Maringá'), (18, 'Ponta Grossa'), (18, 'Cascavel'), (18, 'São José dos Pinhais'), (18, 'Foz do Iguaçu'), (18, 'Guarapuava'), (18, 'Paranaguá'),
-- Rio de Janeiro
(19, 'Rio de Janeiro'), (19, 'São Gonçalo'), (19, 'Duque de Caxias'), (19, 'Nova Iguaçu'), (19, 'Niterói'), (19, 'Campos dos Goytacazes'), (19, 'Belford Roxo'), (19, 'São João de Meriti'), (19, 'Petrópolis'), (19, 'Volta Redonda'), (19, 'Macaé'), (19, 'Cabo Frio'),
-- Rio Grande do Norte
(20, 'Natal'), (20, 'Mossoró'), (20, 'Parnamirim'), (20, 'Caicó'), (20, 'Ceará-Mirim'),
-- Rondônia
(21, 'Porto Velho'), (21, 'Ji-Paraná'), (21, 'Ariquemes'), (21, 'Cacoal'), (21, 'Vilhena'),
-- Roraima
(22, 'Boa Vista'), (22, 'Rorainópolis'), (22, 'Caracaraí'),
-- Rio Grande do Sul
(23, 'Porto Alegre'), (23, 'Caxias do Sul'), (23, 'Canoas'), (23, 'Pelotas'), (23, 'Santa Maria'), (23, 'Gravataí'), (23, 'Novo Hamburgo'), (23, 'Passo Fundo'), (23, 'Rio Grande'), (23, 'Bento Gonçalves'),
-- Santa Catarina
(24, 'Florianópolis'), (24, 'Joinville'), (24, 'Blumenau'), (24, 'São José'), (24, 'Chapecó'), (24, 'Criciúma'), (24, 'Itajaí'), (24, 'Balneário Camboriú'), (24, 'Lages'),
-- Sergipe
(25, 'Aracaju'), (25, 'Nossa Senhora do Socorro'), (25, 'Lagarto'), (25, 'Itabaiana'), (25, 'Estância'),
-- São Paulo
(26, 'São Paulo'), (26, 'Guarulhos'), (26, 'Campinas'), (26, 'São Bernardo do Campo'), (26, 'Santo André'), (26, 'São José dos Campos'), (26, 'Osasco'), (26, 'Ribeirão Preto'), (26, 'Sorocaba'), (26, 'Santos'), (26, 'São José do Rio Preto'), (26, 'Mogi das Cruzes'), (26, 'Jundiaí'), (26, 'Piracicaba'), (26, 'Bauru'), (26, 'São Vicente'), (26, 'Itaquaquecetuba'), (26, 'Carapicuíba'), (26, 'Mauá'), (26, 'Diadema'), (26, 'Barueri'), (26, 'Praia Grande'),
-- Tocantins
(27, 'Palmas'), (27, 'Araguaína'), (27, 'Gurupi'), (27, 'Porto Nacional')
ON CONFLICT (state_id, name) DO NOTHING;
