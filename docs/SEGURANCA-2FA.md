# 2FA de admin: cadastro e recuperação

Admin e super_admin só usam o painel (alpha), o banco e as Edge Functions de admin com a verificação em duas etapas ativa e o código digitado na sessão (Decisão 99; `docs/sql/20261001_seg4_2fa_admin.sql`).

- **Guarde o 2FA em dois lugares:** na hora de ativar, escaneie o mesmo QR (ou copie a "chave manual") no autenticador do celular **e** no gerenciador de senhas (1Password, Bitwarden, Senhas do iCloud). Os dois geram o mesmo código; perder um não tranca a conta. A tela do Evokaa não cadastra um segundo fator separado.
- **Perdeu tudo:** quem tem acesso ao painel do Supabase (o Ricardo, ou outro super_admin com acesso) abre Authentication → Users → a pessoa → remove o fator MFA. No próximo login ela entra com a senha, cai na tela "ative a verificação em duas etapas" e cadastra de novo.
- Antes de remover, confirme por outro canal (telefone, pessoalmente) que o pedido é mesmo da pessoa.
- **Nunca desligue a regra no banco** (reaplicar a versão antiga de `gf_is_admin`/`gf_admin_can`) para destrancar alguém: isso libera todos os admins só com a senha.
