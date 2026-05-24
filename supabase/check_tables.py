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
        definitions = data.get("definitions", {})
        print("Tabelas e Views expostas no Supabase:")
        for table_name in sorted(definitions.keys()):
            print(f"- {table_name}")
except Exception as e:
    print(f"Erro ao obter schema: {e}")
