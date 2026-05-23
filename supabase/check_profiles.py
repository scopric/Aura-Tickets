import os
import urllib.request
import urllib.error
import json

url = "https://rwaezeqyuhxrssntcxdv.supabase.co/rest/v1/profiles?select=*"
# Lendo a service_role key clássica da variável de ambiente por segurança
service_role_jwt = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not service_role_jwt:
    print("Erro: SUPABASE_SERVICE_ROLE_KEY não está definida nas variáveis de ambiente.")
    exit(1)

headers = {
    "apikey": service_role_jwt,
    "Authorization": f"Bearer {service_role_jwt}"
}

req = urllib.request.Request(url, headers=headers, method="GET")

try:
    with urllib.request.urlopen(req) as response:
        status = response.status
        body = response.read().decode("utf-8")
        if status == 200:
            results = json.loads(body)
            print(f"Perfis cadastrados ({len(results)}):")
            print(json.dumps(results[:10], indent=2))
        else:
            print(f"Erro na requisição: Status {status}")
            print(body)
except urllib.error.HTTPError as e:
    print(f"Erro HTTP {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Erro ao executar: {e}")
