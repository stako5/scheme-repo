import sqlite3 from 'sqlite3';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { verbose } = sqlite3;

const DB_PATH = path.join(__dirname, '..', 'data', 'schema_designer.db');

let db = null;

// Ensure data directory exists
async function ensureDataDirectory() {
  const dataDir = path.dirname(DB_PATH);
  try {
    await fs.access(dataDir);
  } catch (error) {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Get database connection
function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

// Initialize database connection and create tables
async function initializeDatabase() {
  try {
    await ensureDataDirectory();
    
    db = new verbose().Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        throw err;
      }
      console.log('Connected to SQLite database');
    });

    // Enable foreign keys
    await runQuery('PRAGMA foreign_keys = ON');
    
    // Create tables
    await createTables();
    
    console.log('Database tables created successfully');
    return db;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

// Promisify database queries
function runQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
}

function getQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function allQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Create database tables
async function createTables() {
  // Schemas table (no user authentication needed)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS schemas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_public BOOLEAN DEFAULT 1,
      version TEXT DEFAULT '1.0.0',
      metadata TEXT, -- JSON string for additional data
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tables table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      position_x INTEGER DEFAULT 0,
      position_y INTEGER DEFAULT 0,
      color TEXT DEFAULT '#ffffff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schema_id) REFERENCES schemas (id) ON DELETE CASCADE,
      UNIQUE(schema_id, name)
    )
  `);

  // Columns table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS columns (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL,
      name TEXT NOT NULL,
      data_type TEXT NOT NULL,
      length INTEGER,
      precision_val INTEGER,
      scale_val INTEGER,
      is_primary_key BOOLEAN DEFAULT 0,
      is_foreign_key BOOLEAN DEFAULT 0,
      is_unique BOOLEAN DEFAULT 0,
      is_required BOOLEAN DEFAULT 0,
      is_auto_increment BOOLEAN DEFAULT 0,
      default_value TEXT,
      description TEXT,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (table_id) REFERENCES tables (id) ON DELETE CASCADE,
      UNIQUE(table_id, name)
    )
  `);

  // Relationships table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL,
      source_table_id TEXT NOT NULL,
      source_column_id TEXT NOT NULL,
      target_table_id TEXT NOT NULL,
      target_column_id TEXT NOT NULL,
      relationship_type TEXT NOT NULL, -- 'one-to-one', 'one-to-many', 'many-to-many'
      on_delete TEXT DEFAULT 'RESTRICT', -- 'CASCADE', 'SET NULL', 'RESTRICT'
      on_update TEXT DEFAULT 'CASCADE',
      name TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schema_id) REFERENCES schemas (id) ON DELETE CASCADE,
      FOREIGN KEY (source_table_id) REFERENCES tables (id) ON DELETE CASCADE,
      FOREIGN KEY (source_column_id) REFERENCES columns (id) ON DELETE CASCADE,
      FOREIGN KEY (target_table_id) REFERENCES tables (id) ON DELETE CASCADE,
      FOREIGN KEY (target_column_id) REFERENCES columns (id) ON DELETE CASCADE
    )
  `);

  // Templates table (no user authentication needed)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'General',
      is_public BOOLEAN DEFAULT 1,
      schema_data TEXT NOT NULL, -- JSON string of the schema structure
      usage_count INTEGER DEFAULT 0,
      rating REAL DEFAULT 0.0,
      tags TEXT, -- JSON array of tags
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Schema versions table (no user authentication needed)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      id TEXT PRIMARY KEY,
      schema_id TEXT NOT NULL,
      version TEXT NOT NULL,
      description TEXT,
      schema_data TEXT NOT NULL, -- JSON snapshot of the schema at this version
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schema_id) REFERENCES schemas (id) ON DELETE CASCADE,
      UNIQUE(schema_id, version)
    )
  `);

  // AI chat history table (no user authentication needed)
  await runQuery(`
    CREATE TABLE IF NOT EXISTS ai_chat_history (
      id TEXT PRIMARY KEY,
      schema_id TEXT,
      message TEXT NOT NULL,
      response TEXT NOT NULL,
      context TEXT, -- JSON string for additional context
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (schema_id) REFERENCES schemas (id) ON DELETE CASCADE
    )
  `);

  // Indexes for better performance
  await runQuery('CREATE INDEX IF NOT EXISTS idx_tables_schema_id ON tables (schema_id)');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_columns_table_id ON columns (table_id)');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_relationships_schema_id ON relationships (schema_id)');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_templates_public ON templates (is_public)');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_templates_category ON templates (category)');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_versions_schema_id ON schema_versions (schema_id)');
  await runQuery('CREATE INDEX IF NOT EXISTS idx_chat_schema_id ON ai_chat_history (schema_id)');
}

// Close database connection
function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database connection closed');
          db = null;
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

export {
  initializeDatabase,
  getDB,
  runQuery,
  getQuery,
  allQuery,
  closeDatabase
};