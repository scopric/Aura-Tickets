import urllib.request
import json

url = "https://rwaezeqyuhxrssntcxdv.supabase.co/rest/v1/profiles?select=*"
anon_key = "sb_publishable_d6yhWhXNJnKHbALR-rdD2w_utpG-Kip"

headers = {
    "apikey": anon_key,
    "Authorization": f"Bearer {anon_key}"
}

req = urllib.request.Request(url, headers=headers, method="GET")

try:
    with urllib.request.urlopen(req) as response:
        status = response.status
        body = response.read().decode("utf-8")
        if status == 200:
            print("Sucesso: A chave ANON do Supabase é VÁLIDA e a conexão com perfis está ativa!")
            print(f"Retorno: {body}")
        else:
            print(f"Erro na requisição: Status {status}")
            print(body)
except Exception as e:
    print(f"Falha na conexão com a chave ANON: {e}")
