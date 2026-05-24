import asyncio
import os
import sys
from dotenv import load_dotenv

# Carregar variáveis do arquivo .env local
load_dotenv()

# Validar a presença da GEMINI_API_KEY
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("ERRO: GEMINI_API_KEY não encontrada no ambiente.")
    print("Por favor, crie um arquivo '.env' baseado no '.env.example' e insira sua chave do Gemini.")
    sys.exit(1)

# A importação do SDK deve ocorrer após a verificação e de forma segura
try:
    from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig
    from google.antigravity.utils.interactive import run_interactive_loop
except ImportError:
    print("ERRO: O pacote 'google-antigravity' não está instalado no seu ambiente Python.")
    print("Certifique-se de executar: pip install -r requirements.txt")
    sys.exit(1)

# Ler o contexto e regras locais para repassar ao agente
def load_system_instructions():
    instructions = [
        "Você é um agente de IA especializado no projeto Aura Tickets.",
        "Siga estritamente as regras de desenvolvimento, segurança e convenções contidas abaixo:\n"
    ]
    paths = [
        ".antigravity/rules.md",
        ".antigravity/context.md",
        ".antigravity/conventions.md",
        ".antigravity/security.md"
    ]
    for path in paths:
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    instructions.append(f"=== {os.path.basename(path).upper()} ===\n" + f.read())
            except Exception as e:
                print(f"Aviso: Não foi possível ler o arquivo {path}: {e}")
    return "\n\n".join(instructions)

async def main():
    system_instructions = load_system_instructions()
    
    # Configurar o agente local
    # Por padrão, roda em modo somente leitura (sem CapabilitiesConfig) para segurança.
    config = LocalAgentConfig(
        system_instructions=system_instructions,
        api_key=api_key
    )
    
    print("Inicializando o agente Antigravity...")
    try:
        async with Agent(config) as agent:
            # Se houver argumentos na linha de comando, executa um prompt único
            if len(sys.argv) > 1:
                prompt = " ".join(sys.argv[1:])
                print(f"Enviando prompt: {prompt}\n")
                response = await agent.chat(prompt)
                async for token in response:
                    sys.stdout.write(token)
                    sys.stdout.flush()
                print()
            else:
                # Caso contrário, inicia o modo interativo
                print("Iniciando loop interativo. Digite 'exit' ou 'quit' para encerrar.\n")
                await run_interactive_loop(agent)
    except Exception as e:
        print(f"\nErro durante a execução do agente: {e}")
        sys.exit(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSessão encerrada pelo usuário.")
        sys.exit(0)
