import urllib.request
import json

url = "https://rwaezeqyuhxrssntcxdv.supabase.co/rest/v1/"
service_role_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWV6ZXF5dWh4cnNzbnRjeGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMyMiwiZXhwIjoyMDkzMzI5MzIyfQ.geaaWq2MCfrICr41FqTICyEqWsQQgYdrhAkYbTkBa5s"

headers = {
    "apikey": service_role_jwt,
    "Authorization": f"Bearer {service_role_jwt}"
}

req = urllib.request.Request(url, headers=headers, method="GET")

try:
    with urllib.request.urlopen(req) as response:
        body = response.read().decode("utf-8")
        data = json.loads(body)
        paths = data.get("paths", {})
        print("Funções RPC expostas no Supabase:")
        rpcs = []
        for path in sorted(paths.keys()):
            if path.startswith("/rpc/"):
                rpcs.append(path)
                print(f"- {path}")
        if not rpcs:
            print("Nenhuma função RPC exposta encontrada.")
except Exception as e:
    print(f"Erro ao obter rpcs: {e}")
