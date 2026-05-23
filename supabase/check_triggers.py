import os
import urllib.request
import urllib.error
import json

token = os.environ.get("SUPABASE_ACCESS_TOKEN")
project_ref = "rwaezeqyuhxrssntcxdv"

if not token:
    print("Erro: SUPABASE_ACCESS_TOKEN não está definida.")
    exit(1)

url = f"https://api.supabase.com/v1/projects/{project_ref}/query"
headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Query para buscar os triggers no banco
query = """
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table
FROM 
    information_schema.triggers;
"""

payload = json.dumps({"query": query}).encode("utf-8")

req = urllib.request.Request(url, data=payload, headers=headers, method="POST")

try:
    with urllib.request.urlopen(req) as response:
        status = response.status
        body = response.read().decode("utf-8")
        if status in (200, 201):
            results = json.loads(body)
            print("Triggers encontrados:")
            print(json.dumps(results, indent=2))
        else:
            print(f"Erro na requisição: Status {status}")
            print(body)
except urllib.error.HTTPError as e:
    print(f"Erro HTTP {e.code}: {e.read().decode('utf-8')}")
except Exception as e:
    print(f"Erro ao executar: {e}")
