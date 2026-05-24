#!/usr/bin/env python3
"""
Extrai texto de todos os PDFs da pasta atual para uma subpasta 'texto_extraido/'.
Como usar: abra o terminal (cmd/powershell) nesta pasta e rode:
    python extrair_pdfs.py
Ou clique duas vezes se o Python estiver associado a .py
"""

import os
import sys
import subprocess
import glob

PASTA_ATUAL = os.path.dirname(os.path.abspath(__file__))
PASTA_SAIDA = os.path.join(PASTA_ATUAL, "texto_extraido")


def verificar_instalar(biblioteca, import_name=None):
    """Verifica se biblioteca está instalada; tenta instalar se não estiver."""
    if import_name is None:
        import_name = biblioteca
    try:
        __import__(import_name)
        return True
    except ImportError:
        print(f"[!] Biblioteca '{biblioteca}' não encontrada. Tentando instalar...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", biblioteca, "-q"])
            __import__(import_name)
            print(f"[✓] {biblioteca} instalado com sucesso!")
            return True
        except Exception as e:
            print(f"[✗] Falha ao instalar {biblioteca}: {e}")
            return False


def extrair_com_pymupdf(pdf_path, txt_path):
    """Extrai texto usando PyMuPDF (fitz)."""
    import fitz
    doc = fitz.open(pdf_path)
    texto = ""
    for pagina in doc:
        texto += pagina.get_text()
    doc.close()
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(texto)
    return len(texto)


def extrair_com_pypdf(pdf_path, txt_path):
    """Extrai texto usando pypdf."""
    from pypdf import PdfReader
    reader = PdfReader(pdf_path)
    texto = ""
    for pagina in reader.pages:
        t = pagina.extract_text()
        if t:
            texto += t + "\n"
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(texto)
    return len(texto)


def main():
    print("=" * 60)
    print(" EXTRAÇÃO DE TEXTO DOS PDFS - AURA DOCUMENTOS")
    print("=" * 60)
    print(f"Pasta de origem: {PASTA_ATUAL}")
    print(f"Pasta de saída:  {PASTA_SAIDA}")
    print()

    # Criar pasta de saída
    os.makedirs(PASTA_SAIDA, exist_ok=True)

    # Listar PDFs
    padrao = os.path.join(PASTA_ATUAL, "*.pdf")
    pdfs = glob.glob(padrao)
    pdfs.sort()

    if not pdfs:
        print("[✗] Nenhum PDF encontrado nesta pasta!")
        input("Pressione Enter para sair...")
        sys.exit(1)

    print(f"Encontrados {len(pdfs)} PDFs para extrair.")
    print()

    # Escolher biblioteca
    metodo = None
    if verificar_instalar("PyMuPDF", "fitz"):
        metodo = "pymupdf"
    elif verificar_instalar("pypdf"):
        metodo = "pypdf"
    else:
        print("[✗] Nenhuma biblioteca PDF disponível.")
        print("    Instale manualmente com um dos comandos abaixo:")
        print("        pip install PyMuPDF")
        print("        pip install pypdf")
        input("Pressione Enter para sair...")
        sys.exit(1)

    print(f"Usando método: {metodo}")
    print()

    # Extrair cada PDF
    for pdf_path in pdfs:
        nome = os.path.basename(pdf_path)
        nome_base = os.path.splitext(nome)[0]
        txt_path = os.path.join(PASTA_SAIDA, f"{nome_base}.txt")

        print(f"Extraindo: {nome} ... ", end="", flush=True)
        try:
            if metodo == "pymupdf":
                tamanho = extrair_com_pymupdf(pdf_path, txt_path)
            else:
                tamanho = extrair_com_pypdf(pdf_path, txt_path)

            if tamanho > 0:
                print(f"OK ({tamanho} caracteres)")
            else:
                print("AVISO (vazio)")
        except Exception as e:
            print(f"ERRO: {e}")

    print()
    print("=" * 60)
    print(" EXTRAÇÃO CONCLUÍDA!")
    print(f" Arquivos salvos em: {PASTA_SAIDA}")
    print("=" * 60)
    print()
    input("Pressione Enter para sair...")


if __name__ == "__main__":
    main()
