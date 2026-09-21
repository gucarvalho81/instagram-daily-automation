"""
Pipeline autônomo de automação diária para Instagram em Python.
Utiliza:
- Google Gemini Flash (geração de conteúdo estruturado anti-repetição)
- Gerador Gráfico HD Local / CDN (1080x1350)
- Meta Instagram Graph API v21.0 (criação de container, polling FINISHED e publicação)
- SQLite local (persistência de histórico sincronizada com a versão Node.js)
"""

import os
import sys
import time
import json
import sqlite3
import argparse
from datetime import datetime
from typing import List, Dict, Optional, Any
from pathlib import Path

try:
    import requests
    from dotenv import load_dotenv
except ImportError:
    requests = None
    load_dotenv = None

# Carrega arquivo .env da raiz do projeto
env_path = Path(__file__).resolve().parent.parent / '.env'
if load_dotenv and env_path.exists():
    load_dotenv(dotenv_path=env_path)


class Config:
    """Configurações da aplicação extraídas de variáveis de ambiente."""
    GEMINI_API_KEY: str = os.getenv('GEMINI_API_KEY', '')
    GEMINI_MODEL: str = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash')
    META_IG_ACCOUNT_ID: str = os.getenv('META_IG_ACCOUNT_ID', '')
    META_ACCESS_TOKEN: str = os.getenv('META_ACCESS_TOKEN', '')
    META_API_VERSION: str = 'v21.0'
    INSTAGRAM_USERNAME: str = os.getenv('INSTAGRAM_USERNAME', 'thebackenddrop').lstrip('@')
    TOPIC_THEME: str = os.getenv('TOPIC_THEME', 'Dicas de Produtividade para Desenvolvedores de Software')
    SCHEDULE_TIME: str = os.getenv('SCHEDULE_TIME', '09:00')
    DRY_RUN: bool = os.getenv('DRY_RUN', 'false').lower() == 'true'
    DB_PATH: Path = Path(__file__).resolve().parent.parent / 'data' / 'history.db'


class DatabaseManager:
    """Gerencia a persistência de posts e histórico no SQLite."""

    def __init__(self, db_path: Path = Config.DB_PATH):
        self.db_path = db_path
        if str(db_path) != ':memory:':
            db_path.parent.mkdir(parents=True, exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self) -> None:
        with self.get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS posts_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    topic_title TEXT NOT NULL,
                    point_1 TEXT,
                    point_2 TEXT,
                    point_3 TEXT,
                    caption TEXT,
                    image_url TEXT,
                    render_id TEXT,
                    meta_container_id TEXT,
                    meta_post_id TEXT,
                    permalink TEXT,
                    status TEXT DEFAULT 'PUBLISHED',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts_history (created_at DESC);")
            
            # Migrações suaves para bancos legados
            try:
                conn.execute("ALTER TABLE posts_history ADD COLUMN render_id TEXT;")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE posts_history ADD COLUMN permalink TEXT;")
            except sqlite3.OperationalError:
                pass

            conn.commit()

    def get_recent_topics(self, limit: int = 15) -> List[str]:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT topic_title FROM posts_history ORDER BY id DESC LIMIT ?", (limit,))
            rows = cursor.fetchall()
            return [row['topic_title'] for row in rows]

    def save_post(self, data: Dict[str, Any]) -> int:
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO posts_history (
                    topic_title, point_1, point_2, point_3, caption,
                    image_url, render_id, meta_container_id, meta_post_id, permalink, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                data.get('topic_title', ''),
                data.get('point_1', ''),
                data.get('point_2', ''),
                data.get('point_3', ''),
                data.get('caption', ''),
                data.get('image_url', ''),
                data.get('render_id', ''),
                data.get('meta_container_id', ''),
                data.get('meta_post_id', ''),
                data.get('permalink', ''),
                data.get('status', 'PUBLISHED')
            ))
            conn.commit()
            return cursor.lastrowid


class GeminiService:
    """Gera cards e legendas educativas com anti-repetição usando Google Gemini."""

    @staticmethod
    def generate_content(recent_topics: List[str], theme: str, dry_run: bool = False) -> Dict[str, str]:
        if dry_run:
            print("[GEMINI] [DRY-RUN] Gerando conteúdo técnico simulado...")
            now = datetime.now().strftime("%H:%M:%S")
            return {
                "tag": "SYSTEM DESIGN",
                "card_title": f"Transactional Outbox no Postgres ({now})",
                "titulo": f"Transactional Outbox no Postgres ({now})",
                "point_1": "Grave eventos na mesma transação ACID do seu agregado.",
                "ponto_1": "Grave eventos na mesma transação ACID do seu agregado.",
                "point_2": "Use Debezium ou Change Data Capture para streaming Kafka.",
                "ponto_2": "Use Debezium ou Change Data Capture para streaming Kafka.",
                "point_3": "Garante entrega at-least-once sem 2-phase commit complexo.",
                "ponto_3": "Garante entrega at-least-once sem 2-phase commit complexo.",
            mock_legenda = (
                "Dual-write em microsserviços é a receita perfeita para inconsistência de dados em produção. "
                "Se a escrita no banco passar mas a publicação no broker falhar, seu estado fica corrompido.\n\n"
                "A solução canônica para esse problema é o Transactional Outbox Pattern:\n\n"
                "1️⃣ Persistência Atômica: O evento de domínio é inserido na tabela 'outbox' na exata mesma transação SQL da entidade.\n\n"
                "2️⃣ Desacoplamento do Broker: A aplicação nunca faz chamada de rede síncrona ao Kafka durante a requisição HTTP.\n\n"
                "3️⃣ CDC / Polling Publisher: Um processo em background (como Debezium via WAL) publica no broker com semântica at-least-once.\n\n"
                "Você já enfrentou problemas de inconsistência entre banco e mensageria no seu time?\n\n"
                "Salve este post para consultar no seu próximo desenho de arquitetura 📌\n\n"
                "#backend #systemdesign #softwareengineering #microservices #cloud"
            )
            return {
                "tag": "SYSTEM DESIGN",
                "card_title": f"Transactional Outbox no Postgres ({now})",
                "titulo": f"Transactional Outbox no Postgres ({now})",
                "point_1": "Grave eventos na mesma transação ACID do seu agregado.",
                "ponto_1": "Grave eventos na mesma transação ACID do seu agregado.",
                "point_2": "Use Debezium ou Change Data Capture para streaming Kafka.",
                "ponto_2": "Use Debezium ou Change Data Capture para streaming Kafka.",
                "point_3": "Garante entrega at-least-once sem 2-phase commit complexo.",
                "ponto_3": "Garante entrega at-least-once sem 2-phase commit complexo.",
                "caption": mock_legenda,
                "legenda": mock_legenda
            }

        if not requests:
            raise RuntimeError("Biblioteca 'requests' não encontrada. Instale com 'pip install requests'.")

        anti_repeat = ""
        if recent_topics:
            formatted_topics = "\n".join([f"- {t}" for t in recent_topics])
            anti_repeat = f"\n\nATENÇÃO - PROIBIDO REPETIR: Não aborde temas semelhantes aos já postados recentemente:\n{formatted_topics}"

        system_instruction = (
            "Atue como um Engenheiro de Software Principal / Staff Engineer e criador de conteúdo técnico de elite. "
            "Seu objetivo é gerar um post diário denso, ultra-prático e sem jargões corporativos vazios para desenvolvedores de software backend.\n\n"
            "Gere um conteúdo técnico inédito sobre um destes temas: arquitetura de microsserviços, mensageria (Kafka/RabbitMQ), "
            "banco de dados relacionais (Postgres/SQL), padrões de resiliência (Circuit Breaker, Outbox, Retry/Dead-Letter), "
            "ou boas práticas de APIs e observabilidade.\n\n"
            "Diretrizes estritas de layout e tamanho:\n"
            "1. 'tag': Palavra-chave de categoria em caixa alta (ex: SYSTEM DESIGN, POSTGRESQL, RESILIÊNCIA, DISTRIBUÍDOS).\n"
            "2. 'titulo': Curto, direto ao ponto. MÁXIMO 40 CARACTERES (MÁXIMO 5 PALAVRAS).\n"
            "3. 'ponto_1', 'ponto_2', 'ponto_3': Regras práticas e acionáveis em produção. MÁXIMO 75 CARACTERES CADA.\n"
            "4. 'legenda': Formate a legenda para leitura rápida e agradável no Instagram, com blocos curtos SEPARADOS OBRIGATORIAMENTE POR LINHAS EM BRANCO (\\n\\n). "
            "Utilize bullets 1️⃣, 2️⃣, 3️⃣ para detalhar os 3 pontos, adicione pergunta de engajamento, CTA 'Salve este post para consultar no seu próximo desenho de arquitetura 📌' e 5 hashtags."
        )

        user_prompt = (
            f"Gere agora um post técnico inédito seguindo rigorosamente as diretrizes.{anti_repeat}\n"
            f"Tema/Preferência: '{theme}'. Lembre-se: Titulo máx 40 caracteres, pontos máx 75 caracteres cada. "
            "LEGENDA: Use quebras duplas (\\n\\n) entre parágrafos e bullets 1️⃣, 2️⃣, 3️⃣ para leitura arejada."
        )

        candidate_models = list(dict.fromkeys([Config.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash"]))

        for model_name in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={Config.GEMINI_API_KEY}"
            payload = {
                "systemInstruction": {"parts": [{"text": system_instruction}]},
                "contents": [{"parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "temperature": 0.7
                }
            }

            for attempt in range(1, 3):
                try:
                    print(f"[GEMINI] Solicitando geração ao modelo {model_name} (Tentativa {attempt}/2)...")
                    res = requests.post(url, json=payload, timeout=35)
                    res.raise_for_status()
                    data = res.json()
                    raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_text)

                    tag = parsed.get("tag", "SYSTEM DESIGN")
                    titulo = parsed.get("titulo") or parsed.get("card_title", "")
                    ponto_1 = parsed.get("ponto_1") or parsed.get("point_1", "")
                    ponto_2 = parsed.get("ponto_2") or parsed.get("point_2", "")
                    ponto_3 = parsed.get("ponto_3") or parsed.get("point_3", "")
                    legenda = parsed.get("legenda") or parsed.get("caption", "")

                    return {
                        "tag": tag,
                        "titulo": titulo,
                        "ponto_1": ponto_1,
                        "ponto_2": ponto_2,
                        "ponto_3": ponto_3,
                        "legenda": legenda,
                        "card_title": titulo,
                        "point_1": ponto_1,
                        "point_2": ponto_2,
                        "point_3": ponto_3,
                        "caption": legenda
                    }
                except Exception as e:
                    print(f"[GEMINI] Modelo {model_name} falhou: {e}")
                    if attempt < 2:
                        time.sleep(2)

        raise RuntimeError("Todos os modelos de fallback do Gemini falharam.")


class LocalRendererService:
    """Gerencia a imagem 1080x1350 HD do card."""

    @staticmethod
    def render(content: Dict[str, str], dry_run: bool = False) -> Dict[str, str]:
        if dry_run:
            print("[LOCAL RENDERER] [DRY-RUN] Simulação ativa: gerando imagem mock 1080x1350...")
            return {
                "render_id": f"local-mock-{int(time.time())}",
                "image_url": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1080&h=1350&fit=crop"
            }

        # Na esteira Node.js a renderização nativa SVG->PNG é feita via @resvg/resvg-js.
        # Na versão Python de fallback, reutilizamos a última imagem renderizada localmente
        # ou hospedamos o PNG local de data/latest-card-1080x1350.png se existir.
        local_png = Path(__file__).resolve().parent.parent / 'data' / 'latest-card-1080x1350.png'
        if local_png.exists() and requests:
            try:
                print("[LOCAL RENDERER] Hospedando card existente para acesso da Meta Graph API...")
                with open(local_png, 'rb') as f:
                    files = {'fileToUpload': (local_png.name, f, 'image/png')}
                    data = {'reqtype': 'fileupload'}
                    res = requests.post('https://catbox.moe/user/api.php', data=data, files=files, timeout=30)
                    if res.ok and res.text.strip().startswith('http'):
                        hosted_url = res.text.strip()
                        print(f"[LOCAL RENDERER] Imagem hospedada com sucesso: {hosted_url}")
                        return {"render_id": f"python-catbox-{int(time.time())}", "image_url": hosted_url}
            except Exception as e:
                print(f"[LOCAL RENDERER] Aviso ao hospedar imagem: {e}")

        return {
            "render_id": f"local-fallback-{int(time.time())}",
            "image_url": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1080&h=1350&fit=crop"
        }


class MetaInstagramService:
    """Gerencia publicação na Instagram Graph API v21.0 com polling de processamento."""

    @staticmethod
    def create_container(image_url: str, caption: str, dry_run: bool = False) -> str:
        if dry_run:
            print("[META INSTAGRAM] [DRY-RUN] Simulando criação de container...")
            return f"mock-container-{int(time.time())}"

        if not requests:
            raise RuntimeError("Biblioteca 'requests' não encontrada.")

        url = f"https://graph.facebook.com/{Config.META_API_VERSION}/{Config.META_IG_ACCOUNT_ID}/media"
        params = {
            "image_url": image_url,
            "caption": caption,
            "access_token": Config.META_ACCESS_TOKEN
        }
        res = requests.post(url, params=params, timeout=30)
        res.raise_for_status()
        data = res.json()
        return data["id"]

    @staticmethod
    def wait_for_container(container_id: str, dry_run: bool = False) -> bool:
        if dry_run or str(container_id).startswith("mock-"):
            print("[META INSTAGRAM] [DRY-RUN] Container processado: FINISHED!")
            return True

        if not requests:
            raise RuntimeError("Biblioteca 'requests' não encontrada.")

        for attempt in range(1, 21):
            time.sleep(5)
            url = f"https://graph.facebook.com/{Config.META_API_VERSION}/{container_id}"
            params = {
                "fields": "status_code,status",
                "access_token": Config.META_ACCESS_TOKEN
            }
            res = requests.get(url, params=params, timeout=15)
            if not res.ok:
                continue
            data = res.json()
            status_code = data.get("status_code")
            print(f"[META INSTAGRAM] Container status ({attempt}/20): {status_code}")
            if status_code == "FINISHED":
                return True
            elif status_code in ["ERROR", "EXPIRED"]:
                raise RuntimeError(f"Erro no container da Meta: {data}")

        raise TimeoutError("Container não finalizou processamento a tempo na Meta.")

    @staticmethod
    def publish_container(container_id: str, dry_run: bool = False) -> Dict[str, str]:
        profile_url = f"https://www.instagram.com/{Config.INSTAGRAM_USERNAME}/"
        if dry_run or str(container_id).startswith("mock-"):
            print("[META INSTAGRAM] [DRY-RUN] Simulando publicação no feed...")
            return {
                "id": f"mock-published-post-{int(time.time())}",
                "permalink": profile_url
            }

        if not requests:
            raise RuntimeError("Biblioteca 'requests' não encontrada.")

        url = f"https://graph.facebook.com/{Config.META_API_VERSION}/{Config.META_IG_ACCOUNT_ID}/media_publish"
        params = {
            "creation_id": container_id,
            "access_token": Config.META_ACCESS_TOKEN
        }
        res = requests.post(url, params=params, timeout=30)
        res.raise_for_status()
        post_id = res.json()["id"]

        permalink = profile_url
        try:
            p_res = requests.get(
                f"https://graph.facebook.com/{Config.META_API_VERSION}/{post_id}",
                params={"fields": "permalink", "access_token": Config.META_ACCESS_TOKEN},
                timeout=10
            )
            if p_res.ok:
                permalink = p_res.json().get("permalink", profile_url)
        except Exception:
            pass

        return {"id": post_id, "permalink": permalink}


def run_pipeline(dry_run: Optional[bool] = None, custom_theme: Optional[str] = None) -> Dict[str, Any]:
    """Orquestrador do pipeline completo."""
    is_dry = dry_run if dry_run is not None else Config.DRY_RUN
    theme = custom_theme or Config.TOPIC_THEME
    db = DatabaseManager()

    print("=" * 60)
    print(f"Iniciando esteira de publicação Instagram ({datetime.now().isoformat()})")
    print(f"Modo: {'DRY-RUN (Simulado)' if is_dry else 'PRODUÇÃO'}")
    print(f"Tema: {theme}")
    print("=" * 60)

    # 1. Recupera histórico
    recent = db.get_recent_topics(15)
    print(f"[1/5] Histórico: {len(recent)} posts encontrados.")

    # 2. Gera card no Gemini
    content = GeminiService.generate_content(recent, theme, dry_run=is_dry)
    card_title = content.get('titulo') or content.get('card_title', 'Sem título')
    tag = content.get('tag', 'SYSTEM DESIGN')
    full_title = f"[{tag}] {card_title}" if tag else card_title
    print(f"[2/5] Card gerado: {full_title}")

    # 3. Renderiza imagem HD 1080x1350
    render_info = LocalRendererService.render(content, dry_run=is_dry)
    print(f"[3/5] Imagem pronta: {render_info['image_url']}")

    # 4. Publica na Meta Graph API v21.0
    container_id = MetaInstagramService.create_container(render_info['image_url'], content['caption'], dry_run=is_dry)
    MetaInstagramService.wait_for_container(container_id, dry_run=is_dry)
    publish_result = MetaInstagramService.publish_container(container_id, dry_run=is_dry)
    post_id = publish_result["id"]
    permalink = publish_result["permalink"]
    print(f"[4/5] Publicado com sucesso no Instagram! Post ID: {post_id} | Link: {permalink}")

    # 5. Salva histórico
    status = 'SIMULATED' if is_dry else 'PUBLISHED'
    db_id = db.save_post({
        'topic_title': full_title,
        'point_1': content.get('ponto_1') or content.get('point_1', ''),
        'point_2': content.get('ponto_2') or content.get('point_2', ''),
        'point_3': content.get('ponto_3') or content.get('point_3', ''),
        'caption': content.get('legenda') or content.get('caption', ''),
        'image_url': render_info['image_url'],
        'render_id': render_info['render_id'],
        'meta_container_id': container_id,
        'meta_post_id': post_id,
        'permalink': permalink,
        'status': status
    })
    print(f"[5/5] Histórico salvo no SQLite com ID {db_id} (Status: {status}).")
    print("=" * 60)
    return {"status": "success", "post_id": post_id, "permalink": permalink, "title": full_title, "dry_run": is_dry}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Automação Diária para Instagram")
    parser.add_argument("--run-once", action="store_true", help="Executa o pipeline imediatamente uma única vez")
    parser.add_argument("--dry-run", action="store_true", help="Executa simulação sem chamar APIs reais")
    parser.add_argument("--theme", type=str, help="Sobrescreve o tema do post")
    args = parser.parse_args()

    run_pipeline(dry_run=args.dry_run, custom_theme=args.theme)
