import urllib.request
import json

url = "https://rwaezeqyuhxrssntcxdv.supabase.co/auth/v1/admin/users"
service_role_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWV6ZXF5dWh4cnNzbnRjeGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMyMiwiZXhwIjoyMDkzMzI5MzIyfQ.geaaWq2MCfrICr41FqTICyEqWsQQgYdrhAkYbTkBa5s"

headers = {
    "apikey": service_role_jwt,
    "Authorization": f"Bearer {service_role_jwt}",
    "Content-Type": "application/json"
}

req = urllib.request.Request(url, headers=headers, method="GET")

try:
    with urllib.request.urlopen(req) as response:
        body = response.read().decode("utf-8")
        data = json.loads(body)
        users = data.get("users", [])
        print(f"Usuários encontrados no Auth do Supabase ({len(users)}):")
        for u in users:
            print(f"- ID: {u.get('id')}")
            print(f"  Email: {u.get('email')}")
            print(f"  Confirmed At: {u.get('email_confirmed_at')}")
            print(f"  Metadata: {json.dumps(u.get('user_metadata'), indent=2)}")
            print("-" * 30)
except Exception as e:
    print(f"Erro ao gerenciar usuários: {e}")
