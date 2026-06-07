const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuração do Projeto Supabase
const PROJECT_REF = 'rwaezeqyuhxrssntcxdv';

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function run() {
  console.log('================================================================');
  console.log('CONFIGURADOR AUTOMÁTICO DE TEMPLATES DE E-MAIL DO SUPABASE AUTH');
  console.log('================================================================');
  
  // 1. Obter o Token de Acesso Pessoal (Supabase Personal Access Token)
  // O usuário pode passar como argumento ou digitar no terminal
  let token = process.argv[2] || process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.log('\nPara rodar esta automação, você precisa gerar um Token de Acesso Pessoal do Supabase.');
    console.log('Acesse: https://supabase.com/dashboard/account/tokens e crie um token.');
    token = await askQuestion('\nDigite o seu Supabase Personal Access Token (começa com sb_at_...): ');
  }

  if (!token) {
    console.error('Erro: O token de acesso do Supabase é obrigatório.');
    process.exit(1);
  }

  // 2. Ler e parsear os templates do arquivo HTML
  console.log('\nLendo o arquivo email_templates_premium.html...');
  const filePath = path.join(__dirname, 'email_templates_premium.html');
  
  if (!fs.existsSync(filePath)) {
    console.error(`Erro: Arquivo não encontrado em ${filePath}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const blocks = fileContent.split('<!-- ==================== ');
  
  const templates = {};
  
  function extractHtml(blockText) {
    const startIdx = blockText.indexOf('<!DOCTYPE html>');
    const endIdx = blockText.lastIndexOf('</html>');
    if (startIdx === -1 || endIdx === -1) return null;
    return blockText.slice(startIdx, endIdx + 7).trim();
  }

  for (const block of blocks) {
    if (block.startsWith('1. CONFIRM SIGNUP')) {
      templates.confirm_signup = extractHtml(block);
    } else if (block.startsWith('2. RESET PASSWORD')) {
      templates.reset_password = extractHtml(block);
    } else if (block.startsWith('3. MAGIC LINK')) {
      templates.magic_link = extractHtml(block);
    } else if (block.startsWith('4. CHANGE EMAIL ADDRESS')) {
      templates.email_change = extractHtml(block);
    }
  }

  if (!templates.confirm_signup || !templates.reset_password) {
    console.error('Erro ao ler ou processar os blocos de e-mail do arquivo HTML.');
    process.exit(1);
  }

  console.log('✓ Templates HTML carregados e estruturados com sucesso.');

  // 3. Montar o payload de envio para a API de Gerenciamento da Supabase
  const payload = {
    mailer_templates: {
      confirm_signup: {
        subject: 'Confirme seu endereço de e-mail na Evokaa',
        content: templates.confirm_signup
      },
      reset_password: {
        subject: 'Redefinição de senha da sua conta Evokaa',
        content: templates.reset_password
      },
      magic_link: {
        subject: 'Seu link de login instantâneo na Evokaa',
        content: templates.magic_link
      },
      email_change: {
        subject: 'Confirme a alteração do seu e-mail de acesso na Evokaa',
        content: templates.email_change
      }
    },
    // Configura o remetente oficial correto noreply@evokaa.com.br
    smtp_sender_name: 'Evokaa',
    smtp_admin_email: 'noreply@evokaa.com.br',
    smtp_host: 'smtp.resend.com',
    smtp_port: 587,
    smtp_user: 'resend'
  };

  console.log(`\nEnviando novas configurações para o projeto Supabase (${PROJECT_REF})...`);
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Erro na requisição (Status: ${response.status})`);
    }

    console.log('\n================================================================');
    console.log('🎉 SUCESSO! AS CONFIGURAÇÕES FORAM ATUALIZADAS NO SUPABASE!');
    console.log('================================================================');
    console.log('O que foi atualizado:');
    console.log('- Template de Confirmação de Cadastro (Confirm Signup) ➔ Ativo e em Português');
    console.log('- Template de Redefinição de Senha (Reset Password) ➔ Ativo e em Português');
    console.log('- Template de Link Mágico (Magic Link) ➔ Ativo e em Português');
    console.log('- Template de Confirmação de Troca de E-mail (Email Change) ➔ Ativo');
    console.log('- Remetente de SMTP Atualizado ➔ noreply@evokaa.com.br');
    console.log('- Porta de Conexão SMTP ➔ 587 (Liberada)');
    console.log('================================================================');
    
  } catch (error) {
    console.error('\n❌ Falha ao atualizar as configurações no Supabase Cloud:');
    console.error(error.message);
    console.log('\nCertifique-se de que o seu Token de Acesso do Supabase é válido e possui permissão de escrita no projeto.');
  }
}

run();
