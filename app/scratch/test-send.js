const URL = "https://rwaezeqyuhxrssntcxdv.supabase.co/functions/v1/send-email";
const ANON_KEY = "sb_publishable_d6yhWhXNJnKHbALR-rdD2w_utpG-Kip";
const RECIPIENT = "ricardo@licitou.com.br";

const tests = [
  { type: "order_confirmation", name: "Ingressos (ingressos@evokaa.com.br)" },
  { type: "newsletter", name: "Newsletter (info@evokaa.com.br)" },
  { type: "auth", name: "Cadastro (cadastro@evokaa.com.br)" },
  { type: "contact", name: "Contato (contato@evokaa.com.br)" }
];

async function runTests() {
  console.log("Iniciando bateria de testes para verificar os 4 remetentes dinâmicos...\n");

  for (const t of tests) {
    console.log(`----------------------------------------`);
    console.log(`Testando remetente para tipo: ${t.name}...`);
    
    try {
      const response = await fetch(URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ANON_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          to: RECIPIENT,
          emailType: t.type,
          subject: `Teste de Remetente [${t.type}] — Evokaa`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #581C87;">Canal Ativo! 🚀</h2>
              <p>Olá, Ricardo!</p>
              <p>Este e-mail comprova que o canal <strong>${t.name}</strong> está configurado e enviando com sucesso através do domínio verificado.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #78716c; text-align: center;">Evokaa — Gestão de Eventos e Ingressos</p>
            </div>
          `
        })
      });

      const data = await response.json();

      if (response.ok) {
        console.log(`✅ SUCESSO! E-mail enviado.`);
        console.log(`ID do Resend: ${data.id}`);
      } else {
        console.error(`❌ FALHA (HTTP ${response.status}):`);
        console.error(JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error(`❌ ERRO DE CONEXÃO: ${error.message}`);
    }
  }

  console.log(`\n----------------------------------------`);
  console.log("Todos os testes foram executados. Verifique a caixa de entrada para cada um dos 4 remetentes!");
}

runTests();
