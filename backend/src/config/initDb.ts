import db from './db.ts';

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
    await client.query('BEGIN');

    // 1. Categories Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        category_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);`);

    // 2. Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        product_id SERIAL PRIMARY KEY,
        category_id INT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        model_no VARCHAR(100),
        slug VARCHAR(255) NOT NULL UNIQUE,
        image_url VARCHAR(512),
        description TEXT,
        specs_summary VARCHAR(500),
        release_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products(slug);`);

    // 3. Stores Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        store_id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL UNIQUE,
        domain VARCHAR(255) NOT NULL UNIQUE,
        logo_url VARCHAR(512),
        api_enabled BOOLEAN DEFAULT TRUE,
        rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_domain ON stores(domain);`);

    // 4. Product Prices Table (Operational Live Tracker)
    await client.query(`
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
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_prices_product_price ON product_prices(product_id, price);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_prices_discount ON product_prices(discount) WHERE discount > 0;`);

    // 5. Price History Tracking Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_history (
        history_id SERIAL PRIMARY KEY,
        product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
        store_id INT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
        price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_history_product_date ON price_history(product_id, recorded_at);`);

    // 6. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash CHAR(60) NOT NULL,
        role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`);

    // 7. Watchlist Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS watchlist (
        watchlist_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_user_product_watchlist UNIQUE (user_id, product_id)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);`);

    // 8. Price Alerts Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS price_alerts (
        alert_id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
        target_price NUMERIC(10,2) NOT NULL CHECK (target_price > 0),
        is_active BOOLEAN DEFAULT TRUE NOT NULL,
        alert_sent BOOLEAN DEFAULT FALSE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_product_target ON price_alerts(product_id, target_price);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_alerts_user_active ON price_alerts(user_id, is_active);`);

    // 9. Search History Database Table (Requested Core Feature)
    await client.query(`
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
    `);
    
    // Add columns dynamically to upgrade active installations
    try {
      await client.query(`ALTER TABLE search_history ADD COLUMN IF NOT EXISTS search_term VARCHAR(255);`);
      await client.query(`ALTER TABLE search_history ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);`);
      await client.query(`ALTER TABLE search_history ADD COLUMN IF NOT EXISTS product_image VARCHAR(1024);`);
      await client.query(`ALTER TABLE search_history ADD COLUMN IF NOT EXISTS lowest_price NUMERIC(10,2);`);
      await client.query(`ALTER TABLE search_history ADD COLUMN IF NOT EXISTS store_name VARCHAR(150);`);
      await client.query(`ALTER TABLE search_history ADD COLUMN IF NOT EXISTS product_id INT REFERENCES products(product_id) ON DELETE SET NULL;`);
      // Port query to search_term if null
      await client.query(`UPDATE search_history SET search_term = query WHERE search_term IS NULL;`);
    } catch (migErr: any) {
      console.warn('[PostgreSQL Migrations] Quietly bypassed history alterations: ', migErr.message);
    }

    await client.query(`CREATE INDEX IF NOT EXISTS idx_search_history_user_date ON search_history(user_id, searched_at DESC);`);

    // 10. Initial Seed Seeding - categories
    await client.query(`
      INSERT INTO categories (name, slug, description) VALUES
      ('Smartphones & Tablets', 'smartphones-tablets', 'Cutting-edge handheld devices running iOS, Android, or iPadOS.'),
      ('Laptops & Desktops', 'laptops-desktops', 'High-performance computers, portable notebooks, and desktop gaming rigs.'),
      ('Smart Wearables', 'smart-wearables', 'Fitness bands, premium smartwatches, and biometrical health checkers.'),
      ('Audio Equipment', 'audio-equipment', 'Active noise-cancelling headphones, wireless ear buds, and hi-fi audio.')
      ON CONFLICT (slug) DO NOTHING;
    `);

    // 10. Seed standard Target Shops as requested
    await client.query(`
      INSERT INTO stores (name, domain, logo_url, rating, api_enabled) VALUES
      ('Amazon India', 'amazon.in', 'https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=100', 4.80, true),
      ('Flipkart', 'flipkart.com', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100', 4.55, true),
      ('Croma', 'croma.com', 'https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=100', 4.40, false),
      ('Reliance Digital', 'reliancedigital.in', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100', 4.60, true)
      ON CONFLICT (domain) DO NOTHING;
    `);

    await client.query('COMMIT');
    console.log('[PostgreSQL] Database seeding and validation successful!');
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[PostgreSQL Error] Database schema initialization failed:', err.message);
  } finally {
    client.release();
  }
}
