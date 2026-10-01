# 2FA de admin: cadastro e recuperação

Admin e super_admin só usam o painel (alpha), o banco e as Edge Functions de admin com a verificação em duas etapas ativa e o código digitado na sessão (Decisão 99; `docs/sql/20261001_seg4_2fa_admin.sql`).

- **Guarde o 2FA em dois lugares:** na hora de ativar, escaneie o mesmo QR (ou copie a "chave manual") no autenticador do celular **e** no gerenciador de senhas (1Password, Bitwarden, Senhas do iCloud). Os dois geram o mesmo código; perder um não tranca a conta. A tela do Evokaa não cadastra um segundo fator separado.
- **Perdeu tudo:** nesta ordem (a conta nunca fica admin sem 2FA):
  1. Um super_admin rebaixa a conta para participante (Usuários → Gerenciar). Se quem perdeu é o único super_admin, o banco não deixa rebaixá-lo (sempre sobra um): o Ricardo, no SQL Editor do Supabase (dono do banco), primeiro dá super_admin a outra conta com 2FA e depois faz este passo.
  2. Confirme por outro canal (telefone, pessoalmente) que o pedido é mesmo da pessoa; ela troca a senha pelo "Esqueci a senha".
  3. No painel do Supabase, remova o fator antigo: Authentication → Users → a pessoa → MFA (*tela não verificada*).
  4. A pessoa entra e cadastra o novo 2FA no Perfil.
  5. Só então um super_admin promove de novo (o banco recusa promover a admin uma conta sem 2FA confirmado).
- **Nunca desligue a regra no banco** (reaplicar a versão antiga de `gf_is_admin`/`gf_admin_can` ou de `gf_protect_profile_privileges`) para destrancar alguém: isso libera todos os admins só com a senha.
