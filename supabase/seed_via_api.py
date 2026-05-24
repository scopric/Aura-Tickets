#!/usr/bin/env python3
"""
Seed script para Aura Tickets - Configura projeto Supabase via API REST
Execute com: python seed_via_api.py
"""

import urllib.request
import urllib.error
import json
import ssl
import uuid
from datetime import datetime, timezone

# ============================================================
# CONFIGURACOES
# ============================================================
SUPABASE_URL = "https://rwaezeqyuhxrssntcxdv.supabase.co"
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWV6ZXF5dWh4cnNzbnRjeGR2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Nzc1MzMyMiwiZXhwIjoyMDkzMzI5MzIyfQ.geaaWq2MCfrICr41FqTICyEqWsQQgYdrhAkYbTkBa5s"

HEADERS = {
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "apikey": SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
}

REPORT = []

def log(status, message):
    REPORT.append(f"[{status}] {message}")
    print(f"[{status}] {message}")


def make_request(method, endpoint, data=None, extra_headers=None):
    url = f"{SUPABASE_URL}{endpoint}"
    headers = dict(HEADERS)
    if extra_headers:
        headers.update(extra_headers)
    
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    
    ctx = ssl.create_default_context()
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=30)
        body_text = resp.read().decode("utf-8")
        return resp.status, json.loads(body_text) if body_text else {}
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8")
        try:
            body_json = json.loads(body_text)
        except:
            body_json = {"raw": body_text}
        return e.code, body_json
    except Exception as e:
        return 0, {"error": str(e)}


# ============================================================
# 1. VERIFICAR AUTH /settings
# ============================================================
print("=" * 60)
print("1. VERIFICANDO AUTH /settings")
print("=" * 60)
status, data = make_request("GET", "/auth/v1/settings")
if status == 200:
    log("OK", f"Auth settings OK")
else:
    log("ERRO", f"Auth settings falhou: HTTP {status} - {json.dumps(data, indent=2, ensure_ascii=False)}")
    exit(1)


# ============================================================
# 2. CRIAR USUARIO DE TESTE
# ============================================================
print("\n" + "=" * 60)
print("2. CRIANDO USUARIO DE TESTE")
print("=" * 60)

user_payload = {
    "email": "produtor@aura.teste",
    "password": "senha123",
    "email_confirm": True,
    "user_metadata": {
        "full_name": "Joao Eventos",
        "role": "producer"
    }
}

status, data = make_request("POST", "/auth/v1/admin/users", user_payload)
if status in (200, 201):
    producer_id = data.get("id")
    log("OK", f"Usuario criado com sucesso. UUID: {producer_id}")
else:
    log("AVISO", f"Criacao retornou HTTP {status}: {json.dumps(data, indent=2, ensure_ascii=False)}")
    status2, data2 = make_request("GET", "/auth/v1/admin/users")
    if status2 == 200:
        users = data2.get("users", [])
        for u in users:
            if u.get("email") == "produtor@aura.teste":
                producer_id = u.get("id")
                log("OK", f"Usuario existente encontrado. UUID: {producer_id}")
                break
        else:
            log("ERRO", "Usuario nao encontrado na lista.")
            exit(1)
    else:
        log("ERRO", f"Nao foi possivel listar usuarios: HTTP {status2}")
        exit(1)


# ============================================================
# 3. INSERIR PROFILE
# ============================================================
print("\n" + "=" * 60)
print("3. INSERINDO PROFILE")
print("=" * 60)

profile_payload = {
    "id": producer_id,
    "email": "produtor@aura.teste",
    "full_name": "Joao Eventos",
    "role": "producer"
}

status, data = make_request(
    "POST", "/rest/v1/profiles",
    profile_payload,
    extra_headers={
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
)
if status in (200, 201):
    log("OK", f"Profile inserido/atualizado. Registros: {len(data) if isinstance(data, list) else 1}")
else:
    log("ERRO", f"Profile falhou: HTTP {status} - {json.dumps(data, indent=2, ensure_ascii=False)}")


# ============================================================
# IDS FIXOS (mesmos do seed.sql)
# ============================================================
event1_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
event2_id = "b2c3d4e5-f6a7-8901-bcde-f23456789012"
event3_id = "c3d4e5f6-a7b8-9012-cdef-345678901234"

now_iso = datetime.now(timezone.utc).isoformat()


# ============================================================
# 4. EVENTOS
# ============================================================
print("\n" + "=" * 60)
print("4. INSERINDO EVENTOS")
print("=" * 60)

events = [
    {
        "id": event1_id,
        "producer_id": producer_id,
        "title": "Noite Eletro 2025",
        "subtitle": "Uma experiencia sonora imersiva",
        "slug": "noite-eletro-2025",
        "description": "A Noite Eletro 2025 reune os melhores DJs de Curitiba em uma noite inesquecivel de musica eletronica. Prepare-se para uma experiencia sensorial completa com luzes, som de alta fidelidade e uma energia contagiante.",
        "short_description": "Experiencia sonora imersiva com os melhores DJs de Curitiba.",
        "cover_image": "/images/hero-bg.jpg",
        "image_url": "/images/hero-bg.jpg",
        "gallery": ["/images/concert-1.jpg","/images/concert-2.jpg","/images/concert-3.jpg"],
        "category": "Musica",
        "tags": ["eletronica","festa","curitiba"],
        "venue_name": "Warehouse Central",
        "venue_address": "R. XV de Novembro, 123 - Centro",
        "venue_city": "Curitiba",
        "venue_state": "PR",
        "date": "2025-06-15",
        "time": "22:00",
        "start_date": "2025-06-15T22:00:00-03:00",
        "end_date": "2025-06-16T06:00:00-03:00",
        "status": "published",
        "visibility": "public",
        "capacity": 500,
        "branding": {"primaryColor":"#7a3b69"},
        "settings": {"taxaServico":10},
        "created_at": now_iso,
        "updated_at": now_iso
    },
    {
        "id": event2_id,
        "producer_id": producer_id,
        "title": "Jazz Sunset Session",
        "subtitle": "Musica ao vivo no rooftop",
        "slug": "jazz-sunset-session",
        "description": "Uma tarde de jazz ao vivo no rooftop mais charmoso da cidade. Acompanhe o por do sol com boa musica, drinks especiais e uma atmosfera unica.",
        "short_description": "Jazz ao vivo no rooftop com por do sol.",
        "cover_image": "/images/event-card-1.jpg",
        "image_url": "/images/event-card-1.jpg",
        "gallery": ["/images/concert-2.jpg"],
        "category": "Musica",
        "tags": ["jazz","rooftop","sunset"],
        "venue_name": "Rooftop Skyline",
        "venue_address": "Av. das Americas, 456 - Batel",
        "venue_city": "Curitiba",
        "venue_state": "PR",
        "date": "2025-06-22",
        "time": "17:00",
        "start_date": "2025-06-22T17:00:00-03:00",
        "end_date": "2025-06-22T23:00:00-03:00",
        "status": "published",
        "visibility": "public",
        "capacity": 200,
        "branding": {"primaryColor":"#d4a373"},
        "settings": {"taxaServico":8},
        "created_at": now_iso,
        "updated_at": now_iso
    },
    {
        "id": event3_id,
        "producer_id": producer_id,
        "title": "Feira de Arte Contemporanea",
        "subtitle": "Arte, design e criatividade",
        "slug": "feira-arte-contemporanea",
        "description": "A maior feira de arte contemporanea do sul do Brasil reune artistas locais e nacionais em um espaco de exposicao e vendas unico.",
        "short_description": "Arte contemporanea e design em Curitiba.",
        "cover_image": "/images/event-card-2.jpg",
        "image_url": "/images/event-card-2.jpg",
        "gallery": ["/images/concert-3.jpg"],
        "category": "Arte",
        "tags": ["arte","design","cultura"],
        "venue_name": "Parque Barigui",
        "venue_address": "R. Prof. Guido Straube, s/n - Bigorrilho",
        "venue_city": "Curitiba",
        "venue_state": "PR",
        "date": "2025-07-05",
        "time": "10:00",
        "start_date": "2025-07-05T10:00:00-03:00",
        "end_date": "2025-07-05T20:00:00-03:00",
        "status": "draft",
        "visibility": "public",
        "capacity": 1000,
        "branding": {"primaryColor":"#2a9d8f"},
        "settings": {"taxaServico":5},
        "created_at": now_iso,
        "updated_at": now_iso
    }
]

status, data = make_request(
    "POST", "/rest/v1/events",
    events,
    extra_headers={
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
)
if status in (200, 201):
    count = len(data) if isinstance(data, list) else 0
    log("OK", f"Eventos inseridos/atualizados: {count}")
else:
    log("ERRO", f"Eventos falhou: HTTP {status} - {json.dumps(data, indent=2, ensure_ascii=False)}")


# ============================================================
# 5. TICKET TYPES
# ============================================================
print("\n" + "=" * 60)
print("5. INSERINDO TICKET TYPES")
print("=" * 60)

ticket_types = [
    {
        "id": str(uuid.uuid4()),
        "event_id": event1_id,
        "name": "Ingresso Individual",
        "description": "Acesso geral ao evento",
        "price": 80.00,
        "capacity": 300,
        "quantity_total": 300,
        "sold": 145,
        "min_per_order": 1,
        "max_per_order": 10,
        "perks": ["Acesso geral","1 drink de boas-vindas"],
        "type": "individual",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    },
    {
        "id": str(uuid.uuid4()),
        "event_id": event1_id,
        "name": "Ingresso VIP",
        "description": "Acesso VIP com open bar",
        "price": 180.00,
        "capacity": 100,
        "quantity_total": 100,
        "sold": 78,
        "min_per_order": 1,
        "max_per_order": 5,
        "perks": ["Acesso prioritario","Open bar premium","Area VIP","Meet & greet"],
        "type": "vip",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    },
    {
        "id": str(uuid.uuid4()),
        "event_id": event1_id,
        "name": "Mesa Coletiva",
        "description": "Mesa para 6 pessoas com matchmaking",
        "price": 160.00,
        "capacity": 60,
        "quantity_total": 60,
        "sold": 42,
        "min_per_order": 6,
        "max_per_order": 6,
        "perks": ["Mesa para 6","Matchmaking por afinidade","1 garrafa de espumante","Acesso VIP"],
        "type": "coletiva",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    },
    {
        "id": str(uuid.uuid4()),
        "event_id": event2_id,
        "name": "Ingresso Geral",
        "description": "Acesso ao rooftop e show",
        "price": 60.00,
        "capacity": 150,
        "quantity_total": 150,
        "sold": 89,
        "min_per_order": 1,
        "max_per_order": 10,
        "perks": ["Acesso ao rooftop","1 drink de boas-vindas"],
        "type": "individual",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    },
    {
        "id": str(uuid.uuid4()),
        "event_id": event2_id,
        "name": "Mesa VIP",
        "description": "Mesa reservada com vista privilegiada",
        "price": 120.00,
        "capacity": 30,
        "quantity_total": 30,
        "sold": 18,
        "min_per_order": 2,
        "max_per_order": 6,
        "perks": ["Mesa reservada","Vista para o por do sol","Open bar de espumantes"],
        "type": "vip",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    },
    {
        "id": str(uuid.uuid4()),
        "event_id": event3_id,
        "name": "Entrada Geral",
        "description": "Acesso a feira e exposicoes",
        "price": 30.00,
        "capacity": 800,
        "quantity_total": 800,
        "sold": 0,
        "min_per_order": 1,
        "max_per_order": 20,
        "perks": ["Acesso as exposicoes","Folder do evento"],
        "type": "individual",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    },
    {
        "id": str(uuid.uuid4()),
        "event_id": event3_id,
        "name": "Passe VIP",
        "description": "Acesso VIP com workshop",
        "price": 90.00,
        "capacity": 100,
        "quantity_total": 100,
        "sold": 0,
        "min_per_order": 1,
        "max_per_order": 5,
        "perks": ["Acesso VIP","Workshop de arte","Cafe da manha","Kit do artista"],
        "type": "vip",
        "is_active": True,
        "created_at": now_iso,
        "updated_at": now_iso
    }
]

status, data = make_request(
    "POST", "/rest/v1/ticket_types",
    ticket_types,
    extra_headers={
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
)
if status in (200, 201):
    count = len(data) if isinstance(data, list) else 0
    log("OK", f"Ticket types inseridos/atualizados: {count}")
else:
    log("ERRO", f"Ticket types falhou: HTTP {status} - {json.dumps(data, indent=2, ensure_ascii=False)}")


# ============================================================
# 6. MENU ITEMS
# ============================================================
print("\n" + "=" * 60)
print("6. INSERINDO MENU ITEMS")
print("=" * 60)

menu_items = [
    {"id": str(uuid.uuid4()), "event_id": event1_id, "producer_id": producer_id, "name": "Gin Tonica Aura", "description": "Gin importado, tonica artesanal, zimbro e rosa", "price": 28.00, "category": "bebida", "image_url": "/images/concert-1.jpg", "is_available": True, "stock": 200, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event1_id, "producer_id": producer_id, "name": "Espumante Brut", "description": "Espumante nacional brut, bem gelado", "price": 35.00, "category": "bebida", "image_url": "/images/concert-2.jpg", "is_available": True, "stock": 150, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event1_id, "producer_id": producer_id, "name": "Burger Eletro", "description": "Hamburguer artesanal, queijo cheddar, cebola caramelizada", "price": 32.00, "category": "comida", "image_url": "/images/concert-3.jpg", "is_available": True, "stock": 100, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event1_id, "producer_id": producer_id, "name": "Combo VIP", "description": "2 drinks + 1 porcao + 1 agua", "price": 75.00, "category": "combo", "image_url": "/images/hero-bg.jpg", "is_available": True, "stock": 50, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event1_id, "producer_id": producer_id, "name": "Camiseta Noite Eletro", "description": "Edicao limitada, 100% algodao", "price": 65.00, "category": "merch", "image_url": "/images/event-card-1.jpg", "is_available": True, "stock": 80, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event2_id, "producer_id": producer_id, "name": "Dry Martini", "description": "Gin, vermute seco, azeitona", "price": 32.00, "category": "bebida", "image_url": "/images/concert-1.jpg", "is_available": True, "stock": 100, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event2_id, "producer_id": producer_id, "name": "Cheese Board", "description": "Tabua de queijos finos com geleia e nozes", "price": 45.00, "category": "comida", "image_url": "/images/concert-2.jpg", "is_available": True, "stock": 40, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event2_id, "producer_id": producer_id, "name": "Espumante Rose", "description": "Espumante rose nacional, servido em taca", "price": 38.00, "category": "bebida", "image_url": "/images/concert-3.jpg", "is_available": True, "stock": 80, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event3_id, "producer_id": producer_id, "name": "Cafe Especial", "description": "Cafe de origem unica, metodo pour over", "price": 12.00, "category": "bebida", "image_url": "/images/event-card-2.jpg", "is_available": True, "stock": 300, "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event3_id, "producer_id": producer_id, "name": "Pao de Queijo Gourmet", "description": "Pao de queijo recheado com requeijao", "price": 15.00, "category": "comida", "image_url": "/images/hero-bg.jpg", "is_available": True, "stock": 200, "created_at": now_iso}
]

status, data = make_request(
    "POST", "/rest/v1/menu_items",
    menu_items,
    extra_headers={
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
)
if status in (200, 201):
    count = len(data) if isinstance(data, list) else 0
    log("OK", f"Menu items inseridos/atualizados: {count}")
else:
    log("ERRO", f"Menu items falhou: HTTP {status} - {json.dumps(data, indent=2, ensure_ascii=False)}")


# ============================================================
# 7. PIPELINE STAGES
# ============================================================
print("\n" + "=" * 60)
print("7. INSERINDO PIPELINE STAGES")
print("=" * 60)

stage_novo = str(uuid.uuid4())
stage_qual = str(uuid.uuid4())
stage_prop = str(uuid.uuid4())
stage_neg = str(uuid.uuid4())
stage_fech = str(uuid.uuid4())
stage_perd = str(uuid.uuid4())

stages = [
    {"id": stage_novo, "producer_id": producer_id, "name": "Novo", "color": "#3b82f6", "position": 0, "created_at": now_iso},
    {"id": stage_qual, "producer_id": producer_id, "name": "Qualificado", "color": "#8b5cf6", "position": 1, "created_at": now_iso},
    {"id": stage_prop, "producer_id": producer_id, "name": "Proposta", "color": "#f59e0b", "position": 2, "created_at": now_iso},
    {"id": stage_neg, "producer_id": producer_id, "name": "Negociacao", "color": "#ec4899", "position": 3, "created_at": now_iso},
    {"id": stage_fech, "producer_id": producer_id, "name": "Fechado", "color": "#22c55e", "position": 4, "created_at": now_iso},
    {"id": stage_perd, "producer_id": producer_id, "name": "Perdido", "color": "#ef4444", "position": 5, "created_at": now_iso}
]

status, data = make_request(
    "POST", "/rest/v1/pipeline_stages",
    stages,
    extra_headers={
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
)
if status in (200, 201):
    count = len(data) if isinstance(data, list) else 0
    log("OK", f"Pipeline stages inseridos/atualizados: {count}")
else:
    log("ERRO", f"Pipeline stages falhou: HTTP {status} - {json.dumps(data, indent=2, ensure_ascii=False)}")


# ============================================================
# 8. CRM LEADS
# ============================================================
print("\n" + "=" * 60)
print("8. INSERINDO CRM LEADS")
print("=" * 60)

leads = [
    {"id": str(uuid.uuid4()), "producer_id": producer_id, "stage_id": stage_novo, "full_name": "Carlos Silva", "email": "carlos@email.com", "phone": "41999991111", "source": "instagram", "score": 65, "potential_value": 320.00, "tags": ["interessado","mesa"], "event_interest": "Noite Eletro 2025", "notes": "Quer mesa coletiva para grupo de 6 amigos", "created_at": now_iso, "updated_at": now_iso},
    {"id": str(uuid.uuid4()), "producer_id": producer_id, "stage_id": stage_qual, "full_name": "Mariana Oliveira", "email": "mariana@email.com", "phone": "41988882222", "source": "site", "score": 82, "potential_value": 180.00, "tags": ["vip","casal"], "event_interest": "Noite Eletro 2025", "notes": "Interesse em ingresso VIP para casal", "created_at": now_iso, "updated_at": now_iso},
    {"id": str(uuid.uuid4()), "producer_id": producer_id, "stage_id": stage_prop, "full_name": "Pedro Henrique", "email": "pedro@email.com", "phone": "41977773333", "source": "indicacao", "score": 45, "potential_value": 80.00, "tags": ["individual","estudante"], "event_interest": "Jazz Sunset", "notes": "Buscando ingresso com desconto estudante", "created_at": now_iso, "updated_at": now_iso},
    {"id": str(uuid.uuid4()), "producer_id": producer_id, "stage_id": stage_fech, "full_name": "Juliana Martins", "email": "juliana@email.com", "phone": "41966664444", "source": "organic", "score": 95, "potential_value": 540.00, "tags": ["mesa","aniversario"], "event_interest": "Noite Eletro 2025", "notes": "Comprou mesa coletiva para aniversario", "created_at": now_iso, "updated_at": now_iso}
]

status, data = make_request(
    "POST", "/rest/v1/crm_leads",
    leads,
    extra_headers={
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
)
if status in (200, 201):
    count = len(data) if isinstance(data, list) else 0
    log("OK", f"CRM leads inseridos/atualizados: {count}")
else:
    log("ERRO", f"CRM leads falhou: HTTP {status} - {json.dumps(data, indent=2, ensure_ascii=False)}")


# ============================================================
# 9. COLLECTIVE TABLES
# ============================================================
print("\n" + "=" * 60)
print("9. INSERINDO COLLECTIVE TABLES")
print("=" * 60)

tables = [
    {"id": str(uuid.uuid4()), "event_id": event1_id, "name": "Mesa Aurora", "theme": "Vibe energetica e extrovertida", "capacity": 6, "compatibility_score": 87.5, "status": "open", "created_at": now_iso},
    {"id": str(uuid.uuid4()), "event_id": event1_id, "name": "Mesa Nebula", "theme": "Vibe chill e introspectiva", "capacity": 6, "compatibility_score": 92.0, "status": "open", "created_at": now_iso}
]

status, data = make_request(
    "POST", "/rest/v1/collective_tables",
    tables,
    extra_headers={
        "Prefer": "resolution=merge-duplicates,return=representation"
    }
)
if status in (200, 201):
    count = len(data) if isinstance(data, list) else 0
    log("OK", f"Collective tables inseridas/atualizadas: {count}")
else:
    log("ERRO", f"Collective tables falhou: HTTP {status} - {json.dumps(data, indent=2, ensure_ascii=False)}")


# ============================================================
# RELATORIO FINAL
# ============================================================
print("\n" + "=" * 60)
print("RELATORIO FINAL")
print("=" * 60)
for line in REPORT:
    print(line)

print(f"\nUUID do produtor: {producer_id}")
