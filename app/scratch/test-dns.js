import dns from 'dns';

function queryDNS(domain, type) {
  return new Promise((resolve) => {
    dns.resolve(domain, type, (err, addresses) => {
      if (err) {
        resolve({ error: err.message });
      } else {
        resolve({ addresses });
      }
    });
  });
}

async function run() {
  console.log("Consultando usando servidores DNS padrão:");
  const mx = await queryDNS('send.evokaa.com.br', 'MX');
  const spf = await queryDNS('send.evokaa.com.br', 'TXT');
  const dkim = await queryDNS('resend._domainkey.send.evokaa.com.br', 'TXT');
  
  console.log("MX send.evokaa.com.br:", JSON.stringify(mx));
  console.log("TXT send.evokaa.com.br (SPF):", JSON.stringify(spf));
  console.log("TXT resend._domainkey.send.evokaa.com.br (DKIM):", JSON.stringify(dkim));

  try {
    console.log("\nTentando com 1.1.1.1...");
    dns.setServers(['1.1.1.1']);
    const mx2 = await queryDNS('send.evokaa.com.br', 'MX');
    const spf2 = await queryDNS('send.evokaa.com.br', 'TXT');
    const dkim2 = await queryDNS('resend._domainkey.send.evokaa.com.br', 'TXT');
    
    console.log("MX send.evokaa.com.br (1.1.1.1):", JSON.stringify(mx2));
    console.log("TXT send.evokaa.com.br (SPF) (1.1.1.1):", JSON.stringify(spf2));
    console.log("TXT resend._domainkey.send.evokaa.com.br (DKIM) (1.1.1.1):", JSON.stringify(dkim2));
  } catch (e) {
    console.log("Erro ao configurar 1.1.1.1:", e.message);
  }
}

run();
