import db from './db.ts';

async function safeQuery(client: any, sql: string, params: any[] = [], desc: string = ''): Promise<boolean> {
  try {
    await client.query(sql, params);
    return true;
  } catch (err: any) {
    if (err.code === '42501' || err.message?.includes('permission denied')) {
      console.warn(`[PostgreSQL Warn] ${desc || 'Query'} bypassed due to schema permissions: ${err.message}`);
    } else if (err.code === '42P07' || err.code === '42701') {
      // Already exists - safe to ignore
    } else {
      console.warn(`[PostgreSQL Warn] ${desc || 'Query'} statement skipped: ${err.message}`);
    }
    return false;
  }
}

/**
 * Automatically initializes and sets up standard PostgreSQL schemas and tables if they do not exist in the database.
 * Crucial for frictionless deployment during placement presentations.
 */
export async function initializeDatabase() {
  console.log('[PostgreSQL] Initializing Database Schema validation checks...');
  let client;
  try {
    client = await db.getClient();
  } catch (err: any) {
    console.warn('[PostgreSQL Warn] Connection refused or database server is down. Bypassing database schema validation checks:', err.message);
    return;
  }
  
  try {
    let mainSchemaExists = false;
    try {
      await client.query('SELECT 1 FROM categories LIMIT 1;');
      mainSchemaExists = true;
    } catch {
      mainSchemaExists = false;
    }

    if (!mainSchemaExists) {
      console.log('[PostgreSQL] Core schema not found or inaccessible. Attempting table creation...');

      // 1. Categories Table
      await safeQuery(client, `
        CREATE TABLE IF NOT EXISTS categories (
          category_id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          slug VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, [], 'Create categories table');
      await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);`, [], 'Index categories slug');

      // 2. Products Table
      await safeQuery(client, `
        CREATE TABLE IF NOT EXISTS products (
          product_id SERIAL PRIMARY KEY,
          category_id INT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
          name VARCHAR(255) NOT NULL,
          brand VARCHAR(100) NOT NULL,
          model_no VARCHAR(100),
          slug VARCHAR(255) NOT NULL UNIQUE,
          canonical_slug VARCHAR(255),
          storage_variant VARCHAR(50) DEFAULT 'N/A',
          color_variant VARCHAR(50) DEFAULT 'N/A',
          image_url VARCHAR(512),
          description TEXT,
          specs_summary VARCHAR(500),
          release_date DATE,
          data_source VARCHAR(50) DEFAULT 'synthetic',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, [], 'Create products table');

      // 3. Stores Table
      await safeQuery(client, `
        CREATE TABLE IF NOT EXISTS stores (
          store_id SERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL UNIQUE,
          domain VARCHAR(255) NOT NULL UNIQUE,
          logo_url VARCHAR(512),
          api_enabled BOOLEAN DEFAULT TRUE,
          rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, [], 'Create stores table');
      await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_domain ON stores(domain);`, [], 'Index stores domain');

      // 4. Product Prices Table
      await safeQuery(client, `
        CREATE TABLE IF NOT EXISTS product_prices (
          price_id BIGSERIAL PRIMARY KEY,
          product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
          store_id INT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
          price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
          original_price NUMERIC(10,2) CHECK (original_price >= price),
          discount NUMERIC(5,2) GENERATED ALWAYS AS (
            CASE WHEN original_price > 0 
            THEN ((original_price - price) / original_price) * 100 
            ELSE 0 END
          ) STORED,
          product_url VARCHAR(1024) NOT NULL,
          is_available BOOLEAN DEFAULT TRUE NOT NULL,
          last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_product_store_price UNIQUE (product_id, store_id)
        );
      `, [], 'Create product_prices table');

      // 5. Price History Tracking Table
      await safeQuery(client, `
        CREATE TABLE IF NOT EXISTS price_history (
          history_id SERIAL PRIMARY KEY,
          product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
          store_id INT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
          price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
          recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, [], 'Create price_history table');

      // 6. Users Table
      await safeQuery(client, `
        CREATE TABLE IF NOT EXISTS users (
          user_id SERIAL PRIMARY KEY,
          username VARCHAR(50) NOT NULL UNIQUE,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash CHAR(60) NOT NULL,
          role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
          is_verified BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, [], 'Create users table');

      // 7. Watchlist Table
      await safeQuery(client, `
        CREATE TABLE IF NOT EXISTS watchlist (
          watchlist_id SERIAL PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
          added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT uq_user_product_watchlist UNIQUE (user_id, product_id)
        );
      `, [], 'Create watchlist table');

      // 8. Price Alerts Table
      await safeQuery(client, `
        CREATE TABLE IF NOT EXISTS price_alerts (
          alert_id SERIAL PRIMARY KEY,
          user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
          product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
          target_price NUMERIC(10,2) NOT NULL CHECK (target_price > 0),
          is_active BOOLEAN DEFAULT TRUE NOT NULL,
          alert_sent BOOLEAN DEFAULT FALSE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `, [], 'Create price_alerts table');
    } else {
      console.log('[PostgreSQL] Main schema tables already present.');
    }

    // Column upgrades & indexes
    await safeQuery(client, `ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;`, [], 'Make users password_hash nullable');
    await safeQuery(client, `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);`, [], 'Upgrade users google_id');
    await safeQuery(client, `ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';`, [], 'Upgrade users auth_provider');
    await safeQuery(client, `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);`, [], 'Upgrade users avatar_url');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);`, [], 'Index users google_id');
    await safeQuery(client, `ALTER TABLE products ADD COLUMN IF NOT EXISTS data_source VARCHAR(50) DEFAULT 'synthetic';`, [], 'Upgrade products data_source');
    await safeQuery(client, `ALTER TABLE products ADD COLUMN IF NOT EXISTS canonical_slug VARCHAR(255);`, [], 'Upgrade products canonical_slug');
    await safeQuery(client, `ALTER TABLE products ADD COLUMN IF NOT EXISTS storage_variant VARCHAR(50) DEFAULT 'N/A';`, [], 'Upgrade products storage_variant');
    await safeQuery(client, `ALTER TABLE products ADD COLUMN IF NOT EXISTS color_variant VARCHAR(50) DEFAULT 'N/A';`, [], 'Upgrade products color_variant');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);`, [], 'Index products category');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);`, [], 'Index products brand');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);`, [], 'Index products slug');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_products_canonical_slug ON products(canonical_slug);`, [], 'Index products canonical_slug');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_prices_product_price ON product_prices(product_id, price);`, [], 'Index price product');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_history_product_date ON price_history(product_id, recorded_at);`, [], 'Index history date');
    await safeQuery(client, `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`, [], 'Index users email');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);`, [], 'Index watchlist user');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_alerts_product_target ON price_alerts(product_id, target_price);`, [], 'Index alerts product');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_alerts_user_active ON price_alerts(user_id, is_active);`, [], 'Index alerts active');

    // 8.5 Password Resets Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS password_resets (
        reset_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, [], 'Create password_resets table');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token_hash);`, [], 'Index password_resets token');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);`, [], 'Index password_resets user');

    // 9. Search History Database Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS search_history (
        history_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        product_id INT,
        query VARCHAR(255) DEFAULT '' NOT NULL,
        search_term VARCHAR(255),
        product_name VARCHAR(255),
        product_image VARCHAR(1024),
        lowest_price NUMERIC(10,2),
        store_name VARCHAR(150),
        searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, [], 'Create search_history table');

    await safeQuery(client, `ALTER TABLE search_history ADD COLUMN IF NOT EXISTS search_term VARCHAR(255);`, [], 'Upgrade search_history search_term');
    await safeQuery(client, `ALTER TABLE search_history ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);`, [], 'Upgrade search_history product_name');
    await safeQuery(client, `ALTER TABLE search_history ADD COLUMN IF NOT EXISTS product_image VARCHAR(1024);`, [], 'Upgrade search_history product_image');
    await safeQuery(client, `ALTER TABLE search_history ADD COLUMN IF NOT EXISTS lowest_price NUMERIC(10,2);`, [], 'Upgrade search_history lowest_price');
    await safeQuery(client, `ALTER TABLE search_history ADD COLUMN IF NOT EXISTS store_name VARCHAR(150);`, [], 'Upgrade search_history store_name');
    await safeQuery(client, `CREATE INDEX IF NOT EXISTS idx_search_history_user_date ON search_history(user_id, searched_at DESC);`, [], 'Index search_history user_date');

    // 9.5 API Call Logs Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS api_call_logs (
        log_id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, [], 'Create api_call_logs table');

    // 9.5b API Quota Calibration Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS api_quota_calibration (
        source VARCHAR(50) PRIMARY KEY,
        offset_value INT DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `, [], 'Create api_quota_calibration table');

    await safeQuery(client, `
      INSERT INTO api_quota_calibration (source, offset_value) VALUES
      ('amazon', 0),
      ('google', 0),
      ('flipkart', 0)
      ON CONFLICT (source) DO NOTHING;
    `, [], 'Seed api_quota_calibration');

    // 9.6 Scheduled Keywords Rotational Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS scheduled_keywords (
        keyword VARCHAR(255) PRIMARY KEY,
        category_name VARCHAR(100) NOT NULL,
        last_synced_at TIMESTAMP DEFAULT NULL
      );
    `, [], 'Create scheduled_keywords table');

    // 9.7 Keyword Sync Log Table
    await safeQuery(client, `
      CREATE TABLE IF NOT EXISTS keyword_sync_log (
        keyword VARCHAR(255) NOT NULL,
        source VARCHAR(50) NOT NULL,
        last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        result_count INT DEFAULT 0,
        PRIMARY KEY (keyword, source)
      );
    `, [], 'Create keyword_sync_log table');

    // Seed Categories
    await safeQuery(client, `
      INSERT INTO categories (name, slug, description) VALUES
      ('Smartphones & Tablets', 'smartphones-tablets', 'Cutting-edge handheld devices running iOS, Android, or iPadOS.'),
      ('Laptops & Desktops', 'laptops-desktops', 'High-performance computers, portable notebooks, and desktop gaming rigs.'),
      ('Smart Wearables', 'smart-wearables', 'Fitness bands, premium smartwatches, and biometrical health checkers.'),
      ('Audio Equipment', 'audio-equipment', 'Active noise-cancelling headphones, wireless ear buds, and hi-fi audio.')
      ON CONFLICT (slug) DO NOTHING;
    `, [], 'Seed categories');

    // Seed Stores
    await safeQuery(client, `
      INSERT INTO stores (name, domain, logo_url, rating, api_enabled) VALUES
      ('Amazon India', 'amazon.in', 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=100', 4.80, true),
      ('Flipkart', 'flipkart.com', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100', 4.55, true),
      ('Croma', 'croma.com', 'https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=100', 4.40, false),
      ('Reliance Digital', 'reliancedigital.in', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100', 4.60, true)
      ON CONFLICT (domain) DO NOTHING;
    `, [], 'Seed stores');

    // Seed Scheduled Keywords
    await safeQuery(client, `
      INSERT INTO scheduled_keywords (keyword, category_name) VALUES
      ('iPhone 15', 'Smartphones & Tablets'),
      ('iPhone 15 Pro Max', 'Smartphones & Tablets'),
      ('Samsung Galaxy S24', 'Smartphones & Tablets'),
      ('Galaxy S24 Ultra', 'Smartphones & Tablets'),
      ('Google Pixel 9', 'Smartphones & Tablets'),
      ('Pixel 9 Pro', 'Smartphones & Tablets'),
      ('OnePlus 12', 'Smartphones & Tablets'),
      ('Redmi Note 13', 'Smartphones & Tablets'),
      ('iPad Air M2', 'Smartphones & Tablets'),
      ('iPad Pro M4', 'Smartphones & Tablets'),
      ('Samsung Galaxy Tab S9', 'Smartphones & Tablets'),
      ('MacBook Air M3', 'Laptops & Desktops'),
      ('MacBook Pro M3', 'Laptops & Desktops'),
      ('Dell XPS 13', 'Laptops & Desktops'),
      ('HP Spectre x360', 'Laptops & Desktops'),
      ('Lenovo ThinkPad X1', 'Laptops & Desktops'),
      ('ASUS ROG Zephyrus', 'Laptops & Desktops'),
      ('Acer Predator Helios', 'Laptops & Desktops'),
      ('Apple Watch Ultra 2', 'Smart Wearables'),
      ('Apple Watch Series 9', 'Smart Wearables'),
      ('Samsung Galaxy Watch 6', 'Smart Wearables'),
      ('Fitbit Charge 6', 'Smart Wearables'),
      ('Garmin Venu 3', 'Smart Wearables'),
      ('OnePlus Watch 2', 'Smart Wearables'),
      ('Sony WH-1000XM5', 'Audio Equipment'),
      ('Bose QuietComfort Ultra', 'Audio Equipment'),
      ('AirPods Pro 2', 'Audio Equipment'),
      ('Sennheiser Momentum 4', 'Audio Equipment'),
      ('Sony WF-1000XM5', 'Audio Equipment'),
      ('JBL Flip 6', 'Audio Equipment')
      ON CONFLICT (keyword) DO NOTHING;
    `, [], 'Seed scheduled_keywords');

    console.log('[PostgreSQL] Database seeding and validation check completed.');
  } catch (err: any) {
    console.warn('[PostgreSQL Warn] Database schema initialization warning:', err.message);
  } finally {
    client.release();
  }
}

