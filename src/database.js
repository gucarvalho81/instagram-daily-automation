import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

let dbInstance = null;

/**
 * Obtém ou inicializa a conexão com o SQLite
 * @param {string} [customPath]
 * @returns {DatabaseSync}
 */
export function getDatabase(customPath) {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const targetPath = customPath || config.dbPath;

  // Garante que o diretório exista se for um arquivo físico
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);

  // Criação da tabela de histórico de publicações
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts_history (created_at DESC);
  `);

  // Migração suave: garante coluna render_id em bancos legados
  try {
    db.exec('ALTER TABLE posts_history ADD COLUMN render_id TEXT;');
  } catch {
    // Coluna já existe
  }

  // Migração suave: garante coluna permalink em bancos legados
  try {
    db.exec('ALTER TABLE posts_history ADD COLUMN permalink TEXT;');
  } catch {
    // Coluna já existe
  }

  if (!customPath) {
    dbInstance = db;
  }

  return db;
}

/**
 * Recupera os títulos e tópicos dos últimos N posts publicados para evitar repetições
 * @param {number} [limit=15]
 * @param {DatabaseSync} [db]
 * @returns {Array<{topic_title: string, point_1: string, point_2: string, point_3: string, created_at: string}>}
 */
export function getRecentTopics(limit = 15, db = getDatabase()) {
  const stmt = db.prepare(`
    SELECT topic_title, point_1, point_2, point_3, created_at
    FROM posts_history
    ORDER BY id DESC
    LIMIT ?
  `);

  return stmt.all(limit);
}

/**
 * Registra um novo post no histórico local
 * @param {Object} postData
 * @param {DatabaseSync} [db]
 * @returns {number} ID do registro inserido
 */
export function savePostRecord(postData, db = getDatabase()) {
  const stmt = db.prepare(`
    INSERT INTO posts_history (
      topic_title,
      point_1,
      point_2,
      point_3,
      caption,
      image_url,
      render_id,
      meta_container_id,
      meta_post_id,
      permalink,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    postData.topic_title || 'Sem título',
    postData.point_1 || '',
    postData.point_2 || '',
    postData.point_3 || '',
    postData.caption || '',
    postData.image_url || '',
    postData.render_id || postData.creatomate_render_id || '',
    postData.meta_container_id || '',
    postData.meta_post_id || '',
    postData.permalink || '',
    postData.status || 'PUBLISHED'
  );

  return result.lastInsertRowid;
}

/**
 * Atualiza status e IDs de publicação de um post existente
 * @param {number} id
 * @param {Object} updateData
 * @param {DatabaseSync} [db]
 */
export function updatePostRecord(id, updateData, db = getDatabase()) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updateData)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  values.push(id);

  const stmt = db.prepare(`
    UPDATE posts_history
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);
}
