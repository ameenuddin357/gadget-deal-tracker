import { DBTable, ERDConnection, NormanLevel, QuizQuestion, SimulationQuery } from '../types';

export const dbTables: DBTable[] = [
  {
    id: 'categories',
    name: 'categories',
    purpose: 'Stores the product groups (categories) of electronic items (e.g., Laptops, Smartphones) to organize search and navigation pathways.',
    realWorldUsage: 'Used to classify catalog items and optimize category-wise product filtering queries through standard foreign keys.',
    columns: [
      { name: 'category_id', type: 'SERIAL', isPK: true, isFK: false, constraints: ['PRIMARY KEY'], description: 'Unique auto-incremented primary key for each category.' },
      { name: 'name', type: 'VARCHAR(100)', isPK: false, isFK: false, constraints: ['NOT NULL', 'UNIQUE'], description: 'Display name of the category (e.g., "Smartphones").' },
      { name: 'slug', type: 'VARCHAR(100)', isPK: false, isFK: false, constraints: ['NOT NULL', 'UNIQUE'], description: 'URL-friendly lowercase token used for search-engine-friendly routing.' },
      { name: 'description', type: 'TEXT', isPK: false, isFK: false, constraints: [], description: 'A brief text detailing what types of gadgets fall under this category.' },
      { name: 'created_at', type: 'TIMESTAMP', isPK: false, isFK: false, constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Standard row creation time for historical audit logs.' }
    ],
    indexes: [
      { name: 'idx_categories_slug', columns: ['slug'], type: 'B-Tree (Unique)', reason: 'Powers fast O(1) slug-based routing lookups in backend catalog endpoints.' }
    ],
    sqlDDL: `CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`
  },
  {
    id: 'products',
    name: 'products',
    purpose: 'Acts as the central product catalogue, holding specifications, model numbers, and general descriptions of gadgets.',
    realWorldUsage: 'Saves product metadata globally. Prevents duplicate product entries across different retail stores (e.g. B&H and Amazon sell the exact same iPhone).',
    columns: [
      { name: 'product_id', type: 'SERIAL', isPK: true, isFK: false, constraints: ['PRIMARY KEY'], description: 'Canonical primary key identifying each unique electronic product.' },
      { name: 'category_id', type: 'INT', isPK: false, isFK: true, fkRef: 'categories.category_id', constraints: ['NOT NULL', 'REFERENCES categories(category_id) ON DELETE RESTRICT'], description: 'Foreign key establishing classifying relationship to categories.' },
      { name: 'name', type: 'VARCHAR(255)', isPK: false, isFK: false, constraints: ['NOT NULL'], description: 'Full marketing name of the gadget (e.g., "Samsung S24 Ultra").' },
      { name: 'brand', type: 'VARCHAR(100)', isPK: false, isFK: false, constraints: ['NOT NULL'], description: 'Manufacturer or brand name for aggregation filters (e.g., "Apple").' },
      { name: 'model_no', type: 'VARCHAR(100)', isPK: false, isFK: false, constraints: [], description: 'Official model sequence number for precise identification.' },
      { name: 'slug', type: 'VARCHAR(255)', isPK: false, isFK: false, constraints: ['NOT NULL', 'UNIQUE'], description: 'URL-friendly product name used to generate landing page links.' },
      { name: 'image_url', type: 'VARCHAR(512)', isPK: false, isFK: false, constraints: [], description: 'Hosting URL for the product graphic display.' },
      { name: 'description', type: 'TEXT', isPK: false, isFK: false, constraints: [], description: 'Detailed overview of the product specifications and hardware.' },
      { name: 'specs_summary', type: 'VARCHAR(500)', isPK: false, isFK: false, constraints: [], description: 'Saves main structural specifications (e.g., RAM, Storage, Color) as a standard readable string.' },
      { name: 'release_date', type: 'DATE', isPK: false, isFK: false, constraints: [], description: 'Official manufacturer release date of the hardware.' },
      { name: 'created_at', type: 'TIMESTAMP', isPK: false, isFK: false, constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'System log recording when the product was cataloged.' }
    ],
    indexes: [
      { name: 'idx_products_category_id', columns: ['category_id'], type: 'B-Tree', reason: 'Speeds up categories-wise product filtering in catalog browsers.' },
      { name: 'idx_products_brand', columns: ['brand'], type: 'B-Tree', reason: 'Optimizes brand sidebar queries which occur frequently.' },
      { name: 'idx_products_slug', columns: ['slug'], type: 'B-Tree (Unique)', reason: 'Provides instant key searches to load a specific product page by URL.' }
    ],
    sqlDDL: `CREATE TABLE products (
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

-- Indexing for classic catalog searches and category lookups
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand);`
  },
  {
    id: 'stores',
    name: 'stores',
    purpose: 'Maintains information about verified partner retail stores or online e-commerce outlets crawled by the platform.',
    realWorldUsage: 'Tracks registrar parameters (such as B&H, Amazon, BestBuy) including rating metrics and crawler configurations.',
    columns: [
      { name: 'store_id', type: 'SERIAL', isPK: true, isFK: false, constraints: ['PRIMARY KEY'], description: 'Auto-incremented primary key identifies each retailer.' },
      { name: 'name', type: 'VARCHAR(150)', isPK: false, isFK: false, constraints: ['NOT NULL', 'UNIQUE'], description: 'Corporate display name of the retailer outlet.' },
      { name: 'domain', type: 'VARCHAR(255)', isPK: false, isFK: false, constraints: ['NOT NULL', 'UNIQUE'], description: 'Verified root website domain used to map pricing crawl urls.' },
      { name: 'logo_url', type: 'VARCHAR(512)', isPK: false, isFK: false, constraints: [], description: 'Store branding badge for standard checkout visual indicators.' },
      { name: 'api_enabled', type: 'BOOLEAN', isPK: false, isFK: false, constraints: ['DEFAULT TRUE'], description: 'True if store price data updates via direct API sync rather than periodic HTML scraping.' },
      { name: 'rating', type: 'NUMERIC(3,2)', isPK: false, isFK: false, constraints: ['CHECK (rating >= 0 AND rating <= 5)'], description: 'Consumer trust score (0 - 5.00) based on rating aggregates.' },
      { name: 'created_at', type: 'TIMESTAMP', isPK: false, isFK: false, constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Timestamp tracking online retailer registration date.' }
    ],
    indexes: [
      { name: 'idx_stores_domain', columns: ['domain'], type: 'B-Tree (Unique)', reason: 'Prevents store domain duplicate records at the SQL index level.' }
    ],
    sqlDDL: `CREATE TABLE stores (
    store_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    logo_url VARCHAR(512),
    api_enabled BOOLEAN DEFAULT TRUE,
    rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`
  },
  {
    id: 'product_prices',
    name: 'product_prices',
    purpose: 'Stores active, scrawl-reported pricing snapshots of catalog items at particular stores, listing active prices, MSRP, and buy links.',
    realWorldUsage: 'Acts as the core transactional live tracking engine. Aggregates different store prices per product, showing current live deals.',
    columns: [
      { name: 'price_id', type: 'BIGSERIAL', isPK: true, isFK: false, constraints: ['PRIMARY KEY'], description: '64-bit unique transaction primary identifier key.' },
      { name: 'product_id', type: 'INT', isPK: false, isFK: true, fkRef: 'products.product_id', constraints: ['NOT NULL', 'REFERENCES products(product_id) ON DELETE CASCADE'], description: 'Foreign key to canonical target product.' },
      { name: 'store_id', type: 'INT', isPK: false, isFK: true, fkRef: 'stores.store_id', constraints: ['NOT NULL', 'REFERENCES stores(store_id) ON DELETE CASCADE'], description: 'Foreign key to reference seller store.' },
      { name: 'price', type: 'NUMERIC(10,2)', isPK: false, isFK: false, constraints: ['NOT NULL', 'CHECK (price >= 0)'], description: 'Active checkout retail list price recorded by crawl runs.' },
      { name: 'original_price', type: 'NUMERIC(10,2)', isPK: false, isFK: false, constraints: ['CHECK (original_price >= price)'], description: 'MSRP or un-discounted parent sticker price to calculate margins.' },
      { name: 'discount', type: 'NUMERIC(5,2)', isPK: false, isFK: false, constraints: ['GENERATED ALWAYS AS (...) STORED'], description: 'Calculated deal clearance percentage column generated on-write and saved on disk.' },
      { name: 'product_url', type: 'VARCHAR(1024)', isPK: false, isFK: false, constraints: ['NOT NULL'], description: 'Referral outbound redirect web address to directly purchase the gadget.' },
      { name: 'is_available', type: 'BOOLEAN', isPK: false, isFK: false, constraints: ['DEFAULT TRUE', 'NOT NULL'], description: 'Quick flag indicating if item is in stock.' },
      { name: 'last_scraped_at', type: 'TIMESTAMP', isPK: false, isFK: false, constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Time of last automated cron price collection script.' },
      { name: 'created_at', type: 'TIMESTAMP', isPK: false, isFK: false, constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Original tuple record registration date.' }
    ],
    indexes: [
      { name: 'uq_product_store_price', columns: ['product_id', 'store_id'], type: 'Unique Composite Key', reason: 'Guarantees any seller store maintains at most a single live active row per catalog item.' },
      { name: 'idx_prices_product_price', columns: ['product_id', 'price'], type: 'B-Tree Composite', reason: 'Critical sorting optimization to retrieve all live store prices for a gadget ordered by cheapest first.' },
      { name: 'idx_prices_discount', columns: ['discount'], type: 'B-Tree', reason: 'Enables high-speed sorting to compile the biggest bargain discounts for the index landing home feed.' }
    ],
    sqlDDL: `CREATE TABLE product_prices (
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

-- Optimize deal extraction sorted by cheapest stores and biggest bargains
CREATE INDEX idx_prices_product_price ON product_prices(product_id, price);
CREATE INDEX idx_prices_discount ON product_prices(discount) WHERE discount > 0;`
  },
  {
    id: 'users',
    name: 'users',
    purpose: 'Maintains user profile accounts, logins, credential hashes, and notification preferences.',
    realWorldUsage: 'Identifies registered clients to grant customized watchlists, user privileges, and alert delivery mechanisms.',
    columns: [
      { name: 'user_id', type: 'SERIAL', isPK: true, isFK: false, constraints: ['PRIMARY KEY'], description: 'Primary key used to reference accounts in watchlist and alerts.' },
      { name: 'username', type: 'VARCHAR(50)', isPK: false, isFK: false, constraints: ['NOT NULL', 'UNIQUE'], description: 'Alphanumeric profile handle registered by user.' },
      { name: 'email', type: 'VARCHAR(255)', isPK: false, isFK: false, constraints: ['NOT NULL', 'UNIQUE'], description: 'Delivery electronic mail address used for dispatching triggered price drops.' },
      { name: 'password_hash', type: 'CHAR(60)', isPK: false, isFK: false, constraints: ['NOT NULL'], description: 'Bcrypt algorithm encrypted password block of fixed character length.' },
      { name: 'role', type: 'VARCHAR(20)', isPK: false, isFK: false, constraints: ["DEFAULT 'user'", "CHECK (role IN ('user', 'admin'))"], description: 'Permission privilege level restricting server API panels.' },
      { name: 'is_verified', type: 'BOOLEAN', isPK: false, isFK: false, constraints: ['DEFAULT FALSE'], description: 'Mandates authentication activation limits.' },
      { name: 'created_at', type: 'TIMESTAMP', isPK: false, isFK: false, constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'User account creation date.' }
    ],
    indexes: [
      { name: 'idx_users_email', columns: ['email'], type: 'B-Tree (Unique)', reason: 'Powers fast O(1) B-tree email queries during standard secure login checks.' }
    ],
    sqlDDL: `CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash CHAR(60) NOT NULL, -- Fixed scale Blowfish bcrypt hash digest
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`
  },
  {
    id: 'watchlist',
    name: 'watchlist',
    purpose: 'Associates authenticated users with their specific shortlisted electronic items they want to monitor together.',
    realWorldUsage: 'A classic relational join table resolving many-to-many properties between User accounts and Products.',
    columns: [
      { name: 'watchlist_id', type: 'SERIAL', isPK: true, isFK: false, constraints: ['PRIMARY KEY'], description: 'Primary key identifying a bookmark record.' },
      { name: 'user_id', type: 'INT', isPK: false, isFK: true, fkRef: 'users.user_id', constraints: ['NOT NULL', 'REFERENCES users(user_id) ON DELETE CASCADE'], description: 'Reference ID of bookmark owner.' },
      { name: 'product_id', type: 'INT', isPK: false, isFK: true, fkRef: 'products.product_id', constraints: ['NOT NULL', 'REFERENCES products(product_id) ON DELETE CASCADE'], description: 'Reference ID of bookmarked product.' },
      { name: 'added_at', type: 'TIMESTAMP', isPK: false, isFK: false, constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Time indicating when product was bookmarked.' }
    ],
    indexes: [
      { name: 'uq_user_product_watchlist', columns: ['user_id', 'product_id'], type: 'Unique Composite Key', reason: 'Ensures relational uniqueness. A user can bookmark any specific product at most once.' },
      { name: 'idx_watchlist_user', columns: ['user_id'], type: 'B-Tree', reason: 'Optimizes rendering personal user home feeds by querying their list instantly.' }
    ],
    sqlDDL: `CREATE TABLE watchlist (
    watchlist_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_product_watchlist UNIQUE (user_id, product_id)
);

-- Index user_id to load dashboards instantly
CREATE INDEX idx_watchlist_user ON watchlist(user_id);`
  },
  {
    id: 'price_alerts',
    name: 'price_alerts',
    purpose: 'Saves active threshold numbers requested by client profiles to automatically dispatch electronic notifications when pricing falls below target targets.',
    realWorldUsage: 'Continuous background workers check new scrawl prices against this alerts index, firing notifications on matching targets.',
    columns: [
      { name: 'alert_id', type: 'SERIAL', isPK: true, isFK: false, constraints: ['PRIMARY KEY'], description: 'Unique tracking number.' },
      { name: 'user_id', type: 'INT', isPK: false, isFK: true, fkRef: 'users.user_id', constraints: ['NOT NULL', 'REFERENCES users(user_id) ON DELETE CASCADE'], description: 'Alert subscriber identifier.' },
      { name: 'product_id', type: 'INT', isPK: false, isFK: true, fkRef: 'products.product_id', constraints: ['NOT NULL', 'REFERENCES products(product_id) ON DELETE CASCADE'], description: 'Catalog gadget scrawl target.' },
      { name: 'target_price', type: 'NUMERIC(10,2)', isPK: false, isFK: false, constraints: ['NOT NULL', 'CHECK (target_price > 0)'], description: 'Target threshold selected by user. Fired when actual scrawl price <= target_price.' },
      { name: 'is_active', type: 'BOOLEAN', isPK: false, isFK: false, constraints: ['DEFAULT TRUE', 'NOT NULL'], description: 'True if active. Allows users to mute/continue alert monitoring.' },
      { name: 'alert_sent', type: 'BOOLEAN', isPK: false, isFK: false, constraints: ['DEFAULT FALSE', 'NOT NULL'], description: 'Deduplication hedge column. Prevents spamming alerts repeatedly once triggered.' },
      { name: 'created_at', type: 'TIMESTAMP', isPK: false, isFK: false, constraints: ['DEFAULT CURRENT_TIMESTAMP'], description: 'Alert registration timestamp.' }
    ],
    indexes: [
      { name: 'idx_alerts_product_target', columns: ['product_id', 'target_price'], type: 'Composite B-Tree', reason: 'Crucial for alert evaluation. When a product price changes, this scans pending active alerts in sub-milliseconds.' },
      { name: 'idx_alerts_user_active', columns: ['user_id', 'is_active'], type: 'B-Tree Composite', reason: 'Accelerates fetching active alert checklists for a user settings panel.' }
    ],
    sqlDDL: `CREATE TABLE price_alerts (
    alert_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    target_price NUMERIC(10,2) NOT NULL CHECK (target_price > 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    alert_sent BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Optimize evaluations during scraper price updates
CREATE INDEX idx_alerts_product_target ON price_alerts (product_id, target_price);
CREATE INDEX idx_alerts_user_active ON price_alerts(user_id, is_active);`
  }
];

export const erdConnections: ERDConnection[] = [
  { id: 'c1', fromTable: 'categories', fromColumn: 'category_id', toTable: 'products', toColumn: 'category_id', type: '1-to-many' },
  { id: 'c2', fromTable: 'products', fromColumn: 'product_id', toTable: 'product_prices', toColumn: 'product_id', type: '1-to-many' },
  { id: 'c3', fromTable: 'stores', fromColumn: 'store_id', toTable: 'product_prices', toColumn: 'store_id', type: '1-to-many' },
  { id: 'c4', fromTable: 'users', fromColumn: 'user_id', toTable: 'watchlist', toColumn: 'user_id', type: '1-to-many' },
  { id: 'c5', fromTable: 'products', fromColumn: 'product_id', toTable: 'watchlist', toColumn: 'product_id', type: '1-to-many' },
  { id: 'c6', fromTable: 'users', fromColumn: 'user_id', toTable: 'price_alerts', toColumn: 'user_id', type: '1-to-many' },
  { id: 'c7', fromTable: 'products', fromColumn: 'product_id', toTable: 'price_alerts', toColumn: 'product_id', type: '1-to-many' }
];

export const normalizationLevels: NormanLevel[] = [
  {
    title: '1st Normal Form (1NF) - Atomic Values & No Repeating Groups',
    concept: 'Enforces that each cell must contain single-valued, atomic items, and there are no repeating configurations. An unnormalized deal sheet typically jams multiple vendor listings on a single row (e.g., "Amazon: $999, BestBuy: $1020").',
    appliedExample: {
      beforeText: 'An unnormalized excel scraper sheet maps products and prices in a single dense row where store prices and URLs are repeated in list strings or multiple columns.',
      beforeTable: {
        headers: ['Product ID', 'Name', 'Category', 'Store Prices List'],
        rows: [
          ['101', 'Samsung S24 Ultra', 'Phones', 'Amazon:999.00|BestBuy:1049.00|BH:989.00'],
          ['102', 'MacBook Air M3', 'Laptops', 'Amazon:1099.00|BestBuy:1149.00']
        ]
      },
      afterText: 'In 1NF, we extract the repeated multi-value rows into multiple discrete atomic rows. Now, every attribute has a single scalar value per tuple.',
      afterTables: [
        {
          name: 'Flat Product Prices (1NF Representation)',
          headers: ['Product ID', 'Name', 'Category', 'Store', 'Price'],
          rows: [
            ['101', 'Samsung S24 Ultra', 'Phones', 'Amazon', '999.00'],
            ['101', 'Samsung S24 Ultra', 'Phones', 'BestBuy', '1049.00'],
            ['101', 'Samsung S24 Ultra', 'Phones', 'BH', '989.00'],
            ['102', 'MacBook Air M3', 'Laptops', 'Amazon', '1099.00'],
            ['102', 'MacBook Air M3', 'Laptops', 'BestBuy', '1149.00']
          ]
        }
      ],
      problemsSolved: [
        'Eliminates parsing string-delimited price arrays inside databases.',
        'Enables native SQL comparison operators (=, <, >, MIN) to query price properties without slow complex regular expressions.',
        'Permits standard indexing structures over numerical price attributes.'
      ]
    }
  },
  {
    title: '2nd Normal Form (2NF) - Removing Partial Dependencies',
    concept: 'Adheres to 1NF and enforces that any non-key attributes must depend on the ENTIRE primary key, not a subset. In our composite-key flat list, non-key factors like "Category" and "Product Name" depend solely on the "Product ID" subset of our composite primary key (Product ID, Store), causing heavy data redundancy.',
    appliedExample: {
      beforeText: 'In a flat 1NF composite table, the Product Name and Category Description are repeated for every store listing, meaning a change to a product name requires modifying multiple rows.',
      beforeTable: {
        headers: ['Product ID (PK)', 'Store (PK)', 'Product Name', 'Category', 'Price', 'Store URL'],
        rows: [
          ['101', 'Amazon', 'Samsung S24 Ultra', 'Phones', '999.00', 'https://amazon.com/...'],
          ['101', 'BestBuy', 'Samsung S24 Ultra', 'Phones', '1049.00', 'https://bestbuy.com/...'],
          ['102', 'Amazon', 'MacBook Air M3', 'Laptops', '1099.00', 'https://amazon.com/...']
        ]
      },
      afterText: 'We split the partial dependencies. Products are separated into their own table where product attributes rely purely on Product ID. Prices remain linked by foreign keys.',
      afterTables: [
        {
          name: 'Products Table (2NF Split)',
          headers: ['Product ID (PK)', 'Product Name', 'Category'],
          rows: [
            ['101', 'Samsung S24 Ultra', 'Phones'],
            ['102', 'MacBook Air M3', 'Laptops']
          ]
        },
        {
          name: 'Store Prices Table (2NF Split)',
          headers: ['Product ID (FK)', 'Store', 'Price', 'Store URL'],
          rows: [
            ['101', 'Amazon', '999.00', 'https://amazon.com/...'],
            ['101', 'BestBuy', '1049.00', 'https://bestbuy.com/...'],
            ['102', 'Amazon', '1099.00', 'https://amazon.com/...']
          ]
        }
      ],
      problemsSolved: [
        'Update Anomalies: If the product name changes (e.g., Apple iPhone 15 refurbished), we edit a single row in the Products table, not thousands of price records.',
        'Insertion Anomalies: We can catalog a new product before we have scrawled any retail stores or prices for it.',
        'Deletion Anomalies: Deleting Amazon price logs does not wipe out our core product metadata records.'
      ]
    }
  },
  {
    title: '3rd Normal Form (3NF) - Removing Transitive Dependencies',
    concept: 'Adheres to 2NF and reinforces that non-key attributes should not depend transitively on other non-key attributes. For example, in our 2NF Products table, "Category" metadata (e.g. category description) depends on "Category Name", which in turn depends on "Product ID". We must separate categories into their own normalized table.',
    appliedExample: {
      beforeText: 'In our 2NF Products table, if we store the category details directly (e.g. category layout configs or descriptions), they depend transitively on the Product ID through the Category field.',
      beforeTable: {
        headers: ['Product ID (PK)', 'Product Name', 'Category Name', 'Category Tax Rate'],
        rows: [
          ['101', 'Samsung S24 Ultra', 'Smartphones', '7.25%'],
          ['102', 'MacBook Air M3', 'Laptops', '8.50%'],
          ['103', 'iPhone 15 Pro', 'Smartphones', '7.25%']
        ]
      },
      afterText: 'By normalizing to 3NF, we extract Category metadata into a dedicated "categories" lookup table, and reference it via a foreign key in the "products" table.',
      afterTables: [
        {
          name: 'Categories Lookup Table (3NF Complete)',
          headers: ['Category ID (PK)', 'Category Name', 'Tax Rate'],
          rows: [
            ['1', 'Smartphones', '7.25%'],
            ['2', 'Laptops', '8.50%']
          ]
        },
        {
          name: 'Products Table referencing Category (3NF Complete)',
          headers: ['Product ID (PK)', 'Product Name', 'Category ID (FK)'],
          rows: [
            ['101', 'Samsung S24 Ultra', '1'],
            ['102', 'MacBook Air M3', '2'],
            ['103', 'iPhone 15 Pro', '1']
          ]
        }
      ],
      problemsSolved: [
        'Wasted Storage: Storing category banners, taxes, or descriptions on every product is highly inefficient.',
        'Data Inconsistency: Prevents "Smartphones" category from having mismatched tax rates on different rows.',
        'Sovereignty: Allows creating a new category in the catalog even if no products exist yet in that category.'
      ]
    }
  }
];

export const completeDDLScript = `-- =========================================================================
-- E-COMMERCE GADGET DEAL TRACKER - BEGINNER-TO-INTERMEDIATE SCHEMA DESIGN
-- Core Stack: React, Express, Node.js, standard PostgreSQL
-- Features exactly 7 clean normalized relational tables. No JSONB/GIN layouts.
-- =========================================================================

-- Drop Tables if existing in order of dependency resolution to avoid FK conflicts
DROP TABLE IF EXISTS price_alerts CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS product_prices CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- 1. CATEGORIES TABLE
CREATE TABLE categories (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing slug strings for sub-millisecond catalogue page routing checks
CREATE UNIQUE INDEX idx_categories_slug ON categories(slug);


-- 2. PRODUCTS TABLE (Canonical Catalog - specs simplified to specs_summary VARCHAR)
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    category_id INT NOT NULL REFERENCES categories(category_id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(100) NOT NULL,
    model_no VARCHAR(100),
    slug VARCHAR(255) NOT NULL UNIQUE,
    image_url VARCHAR(512),
    description TEXT,
    specs_summary VARCHAR(500), -- Standard text specs: avoids slow JSONB queries
    release_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Multi-table lookup indexes
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_brand ON products(brand);
CREATE UNIQUE INDEX idx_products_slug ON products(slug);


-- 3. STORES REGISTER TABLE
CREATE TABLE stores (
    store_id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    logo_url VARCHAR(512),
    api_enabled BOOLEAN DEFAULT TRUE,
    rating NUMERIC(3,2) CHECK (rating >= 0 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing domains to prevent multi-registration conflicts
CREATE UNIQUE INDEX idx_stores_domain ON stores(domain);


-- 4. PRODUCT CURRENT PRICES TABLE (Operational Live Layer)
CREATE TABLE product_prices (
    price_id BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    store_id INT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    original_price NUMERIC(10,2) CHECK (original_price >= price),
    -- GENERATED STORED column ensures CPU efficiency by computing discount on write, not read
    discount NUMERIC(5,2) GENERATED ALWAYS AS (
        CASE WHEN original_price > 0 
        THEN ((original_price - price) / original_price) * 100 
        ELSE 0 END
    ) STORED,
    product_url VARCHAR(1024) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    last_scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Composite unique constraint guarantees a store has at most one live pricing row per gadget
    CONSTRAINT uq_product_store_price UNIQUE (product_id, store_id)
);

-- Speeds up query for finding minimum priced store for an item
CREATE INDEX idx_prices_product_price ON product_prices(product_id, price);
-- Fast filtering index for finding the biggest discount bargains
CREATE INDEX idx_prices_discount ON product_prices(discount) WHERE discount > 0;


-- 5. USERS TABLE
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash CHAR(60) NOT NULL, -- bcrypt hash length is exactly 60
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Fast credential verification on email login
CREATE UNIQUE INDEX idx_users_email ON users(email);


-- 6. WATCHLIST TABLE
CREATE TABLE watchlist (
    watchlist_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Composite unique constraints prevent bookmarking the same product twice
    CONSTRAINT uq_user_product_watchlist UNIQUE (user_id, product_id)
);

-- Fast loading of user watchlists dashboards
CREATE INDEX idx_watchlist_user ON watchlist(user_id);


-- 7. PRICE DROP ALERTS TABLE
CREATE TABLE price_alerts (
    alert_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    target_price NUMERIC(10,2) NOT NULL CHECK (target_price > 0),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    alert_sent BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Multi-column index matches active trigger updates beautifully
CREATE INDEX idx_alerts_product_target ON price_alerts (product_id, target_price);
CREATE INDEX idx_alerts_user_active ON price_alerts(user_id, is_active);
`;

export const completeDMLScript = `-- =========================================================================
-- SAMPLE DEMONSTRATION RECORD SEEDING (DML SCRIPT)
-- Optimized for fresher interview showcases. Runs standard plain SQL.
-- =========================================================================

-- Clear existing data tables in order of foreign key dependency resolution
TRUNCATE categories, products, stores, product_prices, users, watchlist, price_alerts RESTART IDENTITY;

-- 1. SEED CATEGORIES
INSERT INTO categories (name, slug, description) VALUES
('Smartphones & Tablets', 'smartphones-tablets', 'Cutting-edge handheld devices running iOS, Android, or iPadOS.'),
('Laptops & Desktops', 'laptops-desktops', 'High-performance computers, portable notebooks, and desktop gaming rigs.'),
('Smart Wearables', 'smart-wearables', 'Fitness bands, premium smartwatches, and biometrical health checkers.'),
('Audio Equipment', 'audio-equipment', 'Active noise-cancelling headphones, wireless ear buds, and hi-fi audio.');


-- 2. SEED STORES
INSERT INTO stores (name, domain, logo_url, api_enabled, rating) VALUES
('ElectroWorld', 'electroworld.com', 'https://images.unsplash.com/photo-1542744094-3a31f103e35f?w=100', true, 4.80),
('GadgetGalaxy', 'gadgetgalaxy.co', 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=100', true, 4.55),
('GizmoDepot', 'gizmodepot.org', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=100', false, 4.20),
('PrimeRetailer', 'primeretailer.net', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=100', true, 4.90);


-- 3. SEED PRODUCTS (Specs modeled as VARCHAR descriptions, no JSONB)
INSERT INTO products (category_id, name, brand, model_no, slug, description, specs_summary, release_date) VALUES
(1, 'Apple iPhone 15 Pro Max', 'Apple', 'A3106', 'apple-iphone-15-pro-max', 
 'Titanium chassis, Apple A17 Pro CPU chip, and 5x optical telephoto camera.',
 'RAM: 8GB, Storage: 512GB, Color: Natural Titanium, Display: 6.7-inch OLED, Battery: 4441mAh',
 '2023-09-22'),

(1, 'Samsung Galaxy S24 Ultra', 'Samsung', 'SM-S928U', 'samsung-galaxy-s24-ultra', 
 'Integrated Galaxy S-Pen stylus, Snapdragon 8 Gen 3 chipset, with high-durability Titanium Frame.',
 'RAM: 12GB, Storage: 256GB, Color: Titanium Gray, Display: 6.8-inch AMOLED, Battery: 5000mAh',
 '2024-01-31'),

(2, 'MacBook Air 15-inch M3', 'Apple', 'A3114', 'macbook-air-15-m3', 
 'Extremely slim profiling, fanless structure performance, powered by Apple M3 Silicon chip.',
 'RAM: 16GB, Storage: 512GB, Color: Midnight, Display: 15.3-inch Liquid Retina, Battery: 66.5Wh',
 '2024-03-08'),

(2, 'ASUS ROG Zephyrus G14', 'ASUS', 'GA403', 'asus-rog-zephyrus-g14', 
 'ROG OLED HDR high-end gaming laptop with Ryzen 9 CPU and NVIDIA RTX 4070 graphics.',
 'RAM: 32GB, Storage: 1TB, Color: Eclipse Gray, Display: 14.0-inch 120Hz OLED, Battery: 73Wh',
 '2024-02-15'),

(3, 'Apple Watch Ultra 2', 'Apple', 'A2986', 'apple-watch-ultra-2', 
 'Rugged adventure smartwatch with 3000-nits peak brightness display and dual-band GPS.',
 'RAM: 1GB, Storage: 64GB, Color: Alpine Loop Olive, Display: 1.92-inch Retina, Battery: 564mAh',
 '2023-09-22'),

(4, 'Sony WH-1000XM5 ANC Headset', 'Sony', 'WH1000XM5/B', 'sony-wh-1000xm5', 
 'Industry-leading Active Noise Cancelling (ANC) circumaural headphones with 30-hour uptime battery.',
 'RAM: N/A, Storage: N/A, Color: Matte Black, Connectivity: Bluetooth 5.2, Battery: 30 Hrs standby',
 '2022-05-20');


-- 4. SEED PRODUCT CURRENT PRICES
INSERT INTO product_prices (product_id, store_id, price, original_price, product_url, is_available) VALUES
-- Apple iPhone 15 Pro Max (MSRP $1399.00)
(1, 1, 1299.00, 1399.00, 'https://electroworld.com/shop/iphone-15-pro-max', true), -- 7.15% discount
(1, 2, 1319.99, 1399.00, 'https://gadgetgalaxy.co/products/iphone-15-pm', true),
(1, 3, 1399.00, 1399.00, 'https://gizmodepot.org/inventory/iphone15pm', true),
(1, 4, 1289.00, 1399.00, 'https://primeretailer.net/apple/iphone-15-pro-max-512', true), -- Lowest price!

-- Samsung Galaxy S24 Ultra (MSRP $1299.00)
(2, 1, 1199.00, 1299.00, 'https://electroworld.com/shop/galaxy-s24-ultra-titanium', true),
(2, 2, 1149.00, 1299.00, 'https://gadgetgalaxy.co/products/galaxy-s24-ultra', true), -- Lowest price! (11.55% disc)
(2, 3, 1249.99, 1299.00, 'https://gizmodepot.org/inventory/s24ultra', true),

-- MacBook Air M3 (MSRP $1499.00)
(3, 1, 1399.00, 1499.00, 'https://electroworld.com/shop/macbook-air-m3-15', true),
(3, 4, 1349.00, 1499.00, 'https://primeretailer.net/apple/macbook-air-15-m3', true), -- Lowest price! (10.01% disc)

-- ASUS ROG Zephyrus G14 (MSRP $1999.00)
(4, 2, 1799.00, 1999.00, 'https://gadgetgalaxy.co/products/asus-zephyrus-g14-2024', true), -- Lowest price! (10.01% disc)
(4, 3, 1899.99, 1999.00, 'https://gizmodepot.org/inventory/zephyrus-g14', true);


-- 5. SEED AUTHENTICATED USERS
-- Blowfish bcrypt pre-rendered password digests
INSERT INTO users (username, email, password_hash, role, is_verified) VALUES
('james_fresher', 'james@dealtracker.io', '$2b$12$6sI796OlyBf/39vI87N.OecV9Nl44q1Bskh8P31q.I.g0rCg9wEqO', 'admin', true),
('martha_gadget', 'martha.jones@gmail.com', '$2b$12$7H9796OlyBf/39vI87N.OecV9Nl44q1Bskh8P31q.I.g0rCg9wEqO', 'user', true),
('clara_tech', 'clara_oswald@tardis.net', '$2b$12$8K9796OlyBf/39vI87N.OecV9Nl44q1Bskh8P31q.I.g0rCg9wEqO', 'user', false);


-- 6. SEED BOOKMARK WATCHLISTS
INSERT INTO watchlist (user_id, product_id) VALUES
(2, 1), -- Martha tracks Apple iPhone 15 Pro Max
(2, 2), -- Martha tracks Samsung Galaxy S24 Ultra
(3, 2), -- Clara tracks Samsung Galaxy S24 Ultra
(3, 3); -- Clara tracks MacBook Air M3


-- 7. SEED PRICE DROP ALERTS
INSERT INTO price_alerts (user_id, product_id, target_price, is_active, alert_sent) VALUES
-- Martha sets S24 Ultra trigger point to $1100.00 (Untriggered: live lowest is $1149.00)
(2, 2, 1100.00, true, false),

-- Clara sets MacBook Air M3 trigger point to $1350.00 (Triggered! Current lowest is $1349.00)
(3, 3, 1350.00, true, false),

-- Martha sets S24 Ultra secondary alert to $1200.00 (Triggered! Current lowest is $1149.00)
(2, 2, 1200.00, true, false);
`;

export const simulationQueries: SimulationQuery[] = [
  {
    id: 'query-best-deal',
    title: 'Find the Absolute Best Deal for a Product',
    description: 'Queries product_prices to gather the lowest scrawl price, original MSRP, discount percent, and seller retail store details for Samsung Galaxy S24 Ultra.',
    sqlQuery: `SELECT 
    p.name AS product_name,
    p.brand,
    s.name AS store_name,
    pp.price AS lowest_price,
    pp.original_price AS original_msrp,
    ROUND(pp.discount, 1) AS discount_pct,
    pp.product_url
FROM product_prices pp
JOIN products p ON pp.product_id = p.product_id
JOIN stores s ON pp.store_id = s.store_id
WHERE p.slug = 'samsung-galaxy-s24-ultra' 
  AND pp.is_available = TRUE
ORDER BY pp.price ASC
LIMIT 1;`,
    explanation: 'Uses a composite indexed B-Tree (idx_prices_product_price) on (product_id, price) to execute an Index Scan. Bypasses the sorting database file cost, loading the cheap record directly in O(log N) time complexity.',
    indexTarget: 'idx_prices_product_price',
    mockResult: [
      { product_name: 'Samsung Galaxy S24 Ultra', brand: 'Samsung', store_name: 'GadgetGalaxy', lowest_price: 1149.00, original_msrp: 1299.00, discount_pct: 11.5, product_url: 'https://gadgetgalaxy.co/products/galaxy-s24-ultra' }
    ]
  },
  {
    id: 'query-biggest-discounts',
    title: 'Retrieve the Biggest Deals of the Day (Bargains Sorted)',
    description: 'Filters the live e-commerce pricing table to show all products exhibiting active discounts, sorting from highest percentage calculation to lowest.',
    sqlQuery: `SELECT 
    p.name AS product_name,
    s.name AS store_name,
    pp.price AS sale_price,
    pp.original_price AS original_msrp,
    pp.discount AS discount_percentage
FROM product_prices pp
JOIN products p ON pp.product_id = p.product_id
JOIN stores s ON pp.store_id = s.store_id
WHERE pp.discount > 5.00 AND pp.is_available = TRUE
ORDER BY pp.discount DESC
LIMIT 4;`,
    explanation: 'Leverages the index "idx_prices_discount" to directly query high bargain items. Bypasses standard sequential full table scans, sorting records instantly by the compiled index sequence order.',
    indexTarget: 'idx_prices_discount',
    mockResult: [
      { product_name: 'Samsung Galaxy S24 Ultra', store_name: 'GadgetGalaxy', sale_price: 1149.00, original_msrp: 1299.00, discount_percentage: 11.55 },
      { product_name: 'MacBook Air 15-inch M3', store_name: 'PrimeRetailer', sale_price: 1349.00, original_msrp: 1499.00, discount_percentage: 10.01 },
      { product_name: 'ASUS ROG Zephyrus G14', store_name: 'GadgetGalaxy', sale_price: 1799.00, original_msrp: 1999.00, discount_percentage: 10.01 },
      { product_name: 'Apple iPhone 15 Pro Max', store_name: 'ElectroWorld', sale_price: 1299.00, original_msrp: 1399.00, discount_percentage: 7.15 }
    ]
  },
  {
    id: 'query-active-alerts-matched',
    title: 'Trigger Price Drop Alerts Process',
    description: 'This query executes when prices are updated. It matches currently pending inactive or active alerts against the newly registered scrawl prices, discovering which users email targets have been hit.',
    sqlQuery: `SELECT 
    pa.alert_id,
    u.username,
    u.email,
    p.name AS product_name,
    pa.target_price,
    pp.price AS scrawl_lowest_price,
    s.name AS store_name
FROM price_alerts pa
JOIN products p ON pa.product_id = p.product_id
JOIN users u ON pa.user_id = u.user_id
-- Match the product's lowest scrawl price currently listed
JOIN (
    SELECT DISTINCT ON (product_id) product_id, store_id, price 
    FROM product_prices 
    WHERE is_available = TRUE 
    ORDER BY product_id, price ASC
) pp ON pa.product_id = pp.product_id
JOIN stores s ON pp.store_id = s.store_id
WHERE pa.is_active = TRUE 
  AND pa.alert_sent = FALSE 
  AND pp.price <= pa.target_price;`,
    explanation: 'Uses a composite indexed lookup index (idx_alerts_product_target) mapping target_price constraints. Evaluates matching alert records easily when a new crawl is logged, avoiding expensive scans of old sent alert queues.',
    indexTarget: 'idx_alerts_product_target',
    mockResult: [
      { alert_id: 2, username: 'clara_tech', email: 'clara_oswald@tardis.net', product_name: 'MacBook Air 15-inch M3', target_price: 1350.00, scrawl_lowest_price: 1349.00, store_name: 'PrimeRetailer' },
      { alert_id: 3, username: 'martha_gadget', email: 'martha.jones@gmail.com', product_name: 'Samsung Galaxy S24 Ultra', target_price: 1200.00, scrawl_lowest_price: 1149.00, store_name: 'GadgetGalaxy' }
    ]
  },
  {
    id: 'query-fresher-watchlist-join',
    title: 'Load User Personal Watchlist Dashboard',
    description: 'Builds a typical user-authenticated screen dashboard. Compiles all bookmark watchlists for a user, displaying product brands, names, specs, and the current lowest store price and purchase URL.',
    sqlQuery: `SELECT 
    u.username,
    p.brand,
    p.name AS product_name,
    p.specs_summary AS technical_specs,
    min_prices.lowest_price,
    min_prices.store_name,
    min_prices.product_url
FROM watchlist w
JOIN users u ON w.user_id = u.user_id
JOIN products p ON w.product_id = p.product_id
-- Subquery compiling the lowest pricing details for each watched gadget
JOIN (
    SELECT DISTINCT ON (product_id) product_id, price AS lowest_price, s.name AS store_name, product_url
    FROM product_prices pp
    JOIN stores s ON pp.store_id = s.store_id
    WHERE is_available = TRUE
    ORDER BY product_id, price ASC
) min_prices ON p.product_id = min_prices.product_id
WHERE u.username = 'martha_gadget';`,
    explanation: 'Bypasses O(N^2) query loops by using the critical index idx_watchlist_user. This reads the user bookmarked IDs instantly from index pages, matching nested properties via hashed primary key maps.',
    indexTarget: 'idx_watchlist_user',
    mockResult: [
      { username: 'martha_gadget', brand: 'Apple', product_name: 'Apple iPhone 15 Pro Max', technical_specs: 'RAM: 8GB, Storage: 512GB, Color: Natural Titanium...', lowest_price: 1289.00, store_name: 'PrimeRetailer', product_url: 'https://primeretailer.net/apple/iphone-15-pro-max-512' },
      { username: 'martha_gadget', brand: 'Samsung', product_name: 'Samsung Galaxy S24 Ultra', technical_specs: 'RAM: 12GB, Storage: 256GB, Color: Titanium Gray...', lowest_price: 1149.00, store_name: 'GadgetGalaxy', product_url: 'https://gadgetgalaxy.co/products/galaxy-s24-ultra' }
    ]
  }
];

export const architectQuiz: QuizQuestion[] = [
  {
    id: 1,
    question: 'Why did we separate the core catalog (products) and current live prices (product_prices) into different tables instead of hosting a single flat list?',
    category: 'Schema Modeling',
    options: [
      'To prevent redundant data. In a single flat table, a product brand or description would be repeated for every store selling it (violating 2NF), causing data inconsistencies if a brand is misspelled in some rows.',
      'Because PostgreSQL does not allow storing decimal numbers (prices) next to text columns (product names).',
      'Because primary keys are physically limited in size and can not catalog products and prices together.',
      'To force our application to run faster by restricting we only query one table at a time.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'Each product exists only once. A product can be sold at BestBuy, Amazon, or B&H at different prices. By separating products and product_prices, we model a classic 1-to-Many relationship. This represents 2nd Normal Form (2NF). It completely eliminates redundant text metadata, preventing anomalies if catalog entries are updated.',
      architectOpinion: 'For campus placements, demonstrating a firm understanding of normalization is essential. Explaining that split tables prevent update anomalies (e.g. changing an iPhone display size in one row vs hundreds of rows) shows interviewer-grade architectural discipline.'
    }
  },
  {
    id: 2,
    question: 'In PostgreSQL, what is the core benefit of the GENERATED ALWAYS AS (MSRP - Price) STORED column in the product_prices table?',
    category: 'Triggers & Constraints',
    options: [
      'It computes the discount mathematically once during write operations (INSERT/UPDATE) and physically stores it, allowing us to build an index to sort and retrieve big deals instantly.',
      'It recalculates the math expression in computer memory on every SELECT query, maximizing query load.',
      'It is used to dynamically download the discount rates from external partner API endpoints.',
      'It forces columns to be completely read-only, prohibiting stores from ever updating price logs again.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'Generated STORED columns evaluate their expression when a row is modified, storing the physical output right with the table block data. This lets database developers create a B-Tree index (idx_prices_discount) to instantly query bargain deals without paying calculation costs on reads.',
      architectOpinion: 'Interviewers love performance details! Pointing out that calculations on database reads (e.g. "original_price - price") prevent indexes from working unless we use computed indexes, is a highly professional tip. Expressing the value of a STORED column demonstrates deep SQL understanding.'
    }
  },
  {
    id: 3,
    question: 'Why is it critical to index foreign keys like category_id and store_id in our relational layout?',
    category: 'Indexing & Performance',
    options: [
      'FOREIGN KEY constraints do NOT automatically generate indexes in PostgreSQL. Adding indexed paths prevents sluggish Full Table Scans when executing JOIN statements.',
      'Indexing foreign keys is required to allow tables to cascade delete actions.',
      'It forces PostgreSQL to lock tables chronologically so rows are always inserted in order.',
      'It prevents users from registering duplicate email accounts during standard page validation.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'While PRIMARY KEYs automatically generate backing indexes, foreign keys in PostgreSQL do not. Since deal tracking often joins products-to-categories and products-to-prices, index keys are critical to locate matching foreign records instantly in O(log N) operations rather than crawling the table linearly.',
      architectOpinion: 'This is a signature professional interview answer! Many beginner candidates falsely assume foreign constraints are self-indexed. Proactively pointing out this performance gap and indexing category_id establishes exceptional engineering awareness.'
    }
  },
  {
    id: 4,
    question: 'What is the purpose of the composite unique constraint: "uq_product_store_price (product_id, store_id)" in the product_prices table?',
    category: 'Schema Modeling',
    options: [
      'It guarantees that any specific partner store (e.g. Amazon) can have at most one live tracking row per product, preventing database duplicate price records.',
      'It forces users to enter prices that are always unique from and higher than other retailers.',
      'It automatically joins the products table and stores tables during queries on discount calculations.',
      'It ensures categories can only hold products belonging to unique brands.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'Using uq_product_store_price, we define a composite unique rule. If a store crawler tries to insert a duplicate price row for a scrawled item rather than updating the existing one, the database blocks it, keeping catalog data consistent.',
      architectOpinion: 'Data hygiene is paramount. A database with duplicate store listings per product will return corrupted averages and deal matches. Using solid DBMS-level composite unique constraints solves this issue at the storage level rather than relying on buggy server-side application logic.'
    }
  },
  {
    id: 5,
    question: 'What deletion policies protect our catalog, and why did we choose ON DELETE RESTRICT on categories but ON DELETE CASCADE on product_prices?',
    category: 'Schema Modeling',
    options: [
      'RESTRICT stops categories from being accidentally deleted if active products are classified under them, while CASCADE ensures removing a discontinued product cleans out all matching old prices automatically.',
      'RESTRICT is required when primary keys contain strings. CASCADE is used only for integers.',
      'RESTRICT locks the server transaction context. CASCADE sends emails to registered active users.',
      'Database engines do not allow CASCADE and RESTRICT parameters to be combined in the same database.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'A category like "Smartphones" holds thousands of gadgets. ON DELETE RESTRICT on categories prevents accidental deletion which would orphan thousands of items. In contrast, on products, ON DELETE CASCADE ensures deleting a deprecated gadget sweeps away transient store price listings automatically.',
      architectOpinion: 'Using different deletion policies shows high schema design maturity. RESTRICT safeguards key structural taxonomic groups, while CASCADE handles clean housekeeping of transient, child records without requiring manually executed cleanup code.'
    }
  },
  {
    id: 6,
    question: 'What makes a composite index key on (product_id, price) in the product_prices table so optimal for loading product pages?',
    category: 'Indexing & Performance',
    options: [
      'It resolves both the "product filtering" constraint and the "cheapest-to-highest sort order" in a single B-Tree operation, completely bypassing slow database sorting costs.',
      'It merges duplicate store names, returning only one combined price text string in memory.',
      'It encrypts product decimal values, securing seller details from scraper competitors.',
      'It allows our Express.js backend to bypass database connections completely through cache pools.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'When a client loads a product detail page, they expect to see prices scrawled sorted from lowest to highest. A composite index on "(product_id, price)" maintains sorted price logs inside each product leaf. The SQL engine scans the matching product IDs and reads sequential leaf items, completely avoiding sorting computations on disk.',
      architectOpinion: 'Explaining how composite indexes satisfy "ORDER BY" scopes is an instant hire answer in standard placements, proving you understand how database query plan optimization works.'
    }
  },
  {
    id: 7,
    question: 'How do database indexes improve search speeds compared to sequential sweeps, and what are their storage tradeoffs?',
    category: 'Indexing & Performance',
    options: [
      'They speed up read queries from O(N) linear scans to O(log N) tree navigations, but increase disk storage footprint and can slightly slow down INSERT/UPDATE operations as indexes are updated on writes.',
      'They make tables infinitely fast to write to, but restrict we can only search up to 100 rows.',
      'They automatically duplicate tables, doubling query speeds but requiring separate servers.',
      'Indexes make databases read-only, so scrawlers can only run during offline maintenance hours.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'An index is a custom auxiliary table (conceptually like a book index) stored as a balanced B-Tree. Finding a row goes from querying every table block sequentially (O(N)) to following search node links (O(log N)). The tradeoff is storage disk space and matching write overhead calculations on database inserts.',
      architectOpinion: 'An interview classic! A realistic junior or mid-level engineer never pitches indexes as magic silver bullets. Acknowledging that every index slows down write operations slightly indicates you balance performance targets with real-world trade-offs.'
    }
  },
  {
    id: 8,
    question: 'In our 3NF schema, how does migrating categories to their own table solve structural data redundancy?',
    category: 'Normalization',
    options: [
      'It eliminates transitive dependencies (Product ID -> Category Name -> Category Description), keeping descriptions stored exactly once and avoiding redundancies.',
      'It stores category descriptions inside user credentials, saving index structures.',
      'It forces standard serial keys into text values to fit within simple SQL conditions.',
      'It decreases database table totals, making it easier to write simpler JOIN files.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'Under 2nd Normal Form, our products table might list categorized details. However, "Category Description" depends on "Category Name" (a non-key attribute) rather than "Product ID" directly. Separating categories removes this transitive dependency, ensuring each taxonomical change is edited in exactly one record.',
      architectOpinion: 'Achieving 3rd Normal Form is standard for placement-level projects. Presenting the concept of Transitive Dependency and demonstrating how a categories table resolves update anomalies is a cornerstone placement topic.'
    }
  },
  {
    id: 9,
    question: 'Why did we declare the users.password_hash data column as CHAR(60) instead of standard VARCHAR text fields?',
    category: 'Schema Modeling',
    options: [
      'Modern security hashing algorithms like bcrypt always output exactly 60 characters. Declaring it as CHAR(60) ensures pre-allocated, constant storage space per row, preventing fragmentation.',
      'To restrict users from creating plain text passwords longer than 10 characters during signup.',
      'PostgreSQL requires CHAR columns when generating secure unique constraints.',
      'CHAR datatypes automatically decrypt passwords in memory when loading login pages.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'Bcrypt produces a 1-way Blowfish cipher digest that has a fixed length of 60 characters. Unlike VARCHAR (which has variable length overhead byte markers), CHAR(60) maps exactly 60 bytes of storage, which avoids fragmentation and optimizes write execution.',
      architectOpinion: 'An outstanding detail! Proving you know secure user authentication hashing standards (Bcrypt) and matching them directly with physical CHAR datatypes shows professional engineering care.'
    }
  },
  {
    id: 10,
    question: 'How does PostgreSQL coordinate active price updates from scrappers while consumers browse product catalogs at the same time?',
    category: 'Concurrency & Isolation',
    options: [
      'PostgreSQL uses MVCC (Multi-Version Concurrency Control) so read queries read consistent past snapshots while write transactions proceed in parallel, avoiding blocking.',
      'By forcing user queries to buffer and wait in queue until scrappers finish writing blocks.',
      'The database drops indexes temporarily during scrawler writes, recreating them afterwards.',
      'By throwing locked row errors to the UI, forcing users to click reload repeatedly to browse.'
    ],
    correctAnswerIndex: 0,
    explanation: {
      overview: 'MVCC operates by keeping multiple copies of modified records. When a scraper transaction is executing updating checkouts, active customers read stable prior instances. Only when the scraper transaction successfully commits do new pricing values become visible.',
      architectOpinion: 'Familiarity with standard MVCC transaction controls is a major highlight in placements. It shows you understand concurrent full stack behaviors, ensuring high availability and robust data operations.'
    }
  }
];
