export interface LineExplanation {
  lines: string;
  code: string;
  explanation: string;
}

export interface InterviewQnA {
  question: string;
  answer: string;
  architectTip: string;
}

export interface BackendFile {
  path: string;
  name: string;
  category: string;
  purpose: string;
  code: string;
  explanations: LineExplanation[];
  interviewQuestions: InterviewQnA[];
}

export const backendFiles: Record<string, BackendFile> = {
  dbConfig: {
    path: 'src/config/db.ts',
    name: 'db.ts',
    category: 'Database Config',
    purpose: 'Sets up and manages the database connection pool using the PostgreSQL "pg" library, monitors unexpected client losses, and provides robust parameterized transaction helpers.',
    code: `import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const { Pool } = pg;

// Connection Pool Configuration settings
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_secure_password',
  database: process.env.DB_DATABASE || 'deal_tracker',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // Connection Pool Tuning Parameters
  max: 20,                       // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,      // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Error out if connection takes longer than 2 seconds
};

// Initialize the pg Pool instance
const pool = new Pool(
  process.env.DATABASE_URL 
    ? { connectionString: process.env.DATABASE_URL, max: 20 } 
    : poolConfig
);

// Event listener to monitor the pool for unexpected idle client losses
pool.on('error', (err) => {
  console.error('Unexpected database client error in connection pool:', err);
});

/**
 * Thread-Safe SQL Query Helper
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.NODE_ENV !== 'production') {
    console.log(\`[SQL EXEC] executed query: \${text.split('\\n')[0]}... took \${duration}ms\`);
  }
  return res;
};

/**
 * Transaction Helper
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

export default {
  query,
  getClient,
  pool
};`,
    explanations: [
      {
        lines: '1 - 5',
        code: `import pg from 'pg';\nimport dotenv from 'dotenv';\ndotenv.config();\nconst { Pool } = pg;`,
        explanation: 'Imports the PostgreSQL library and dotenv helper. Calling dotenv.config() loads variables from .env file into standard Node.js process.env parameters. Destructures Pool class.'
      },
      {
        lines: '8 - 18',
        code: `const poolConfig = {\n  host: process.env.DB_HOST...\n  max: 20,\n  idleTimeoutMillis: 30000,\n  connectionTimeoutMillis: 2000\n};`,
        explanation: 'Stores database credentials and configures connection pooling constraints. "max: 20" caps concurrent active DB client connections. "idleTimeoutMillis: 30000" frees unused client resources after 30 seconds to reclaim memory. "connectionTimeoutMillis: 2000" avoids system threads hanging forever if database goes offline.'
      },
      {
        lines: '21 - 25',
        code: `const pool = new Pool(...process.env.DATABASE_URL...);`,
        explanation: 'Instantiates the unified pg connection pool object. Uses a single unified database URI string if supplied, otherwise falls back to properties. In Node.js, we only create one single Pool instance and share it.'
      },
      {
        lines: '35 - 45',
        code: `export const query = async (text: string, params?: any[]) => {\n  const res = await pool.query(text, params);\n  return res;\n};`,
        explanation: 'Defines a parameterized thread-safe query utility. It receives a SQL string text with generic placeholder ($1, $2) mappings and a variables array "params". It safely manages internal pooling checkout/checkin lifecycle under the hood, absolutely shielding resources from leaks!'
      }
    ],
    interviewQuestions: [
      {
        question: 'What is the core difference between using a "Pool" and a "Client" in pg, and why are Pools preferred in web servers?',
        answer: 'A Client represents a single, persistent TCP connection to the PostgreSQL database. Every query must run sequentially on this single thread. In contrast, a Pool holds and manages a collection of many pre-opened Client connections. Whenever Express receives concurrent request APIs, the Pool checks out an idle Connection to run the query, and checks it back in immediately upon resolution. Pools are highly preferred for scalable web backends to avoid TCP connection overhead delays on every HTTP request.',
        architectTip: 'Emphasize that opening concrete TCP sockets repeatedly is mathematically one of the most hardware-expensive operations in network systems!'
      },
      {
        question: 'How do parameterized queries ($1, $2) mitigate SQL injection attacks at the database driver level?',
        answer: 'Parameterized queries completely separate user input from raw database execution commands. Instead of interpolating variables with string-concatenation (which lets hackers inject custom SQL commands like "OR 1=1"), variables are passed to the PostgreSQL engine separately as parameters ($1). The database engine compiles the query template structure and treats user variables strictly as literal scalar values, not executable syntax.',
        architectTip: 'State that parameterized variables also let Postgres cache query execution plans, enhancing database performance on recurring queries.'
      },
      {
        question: 'Why do we need a separate "getClient" helper in our pool utility if we already have the "query" method?',
        answer: 'The pool.query helper is a shortcut that checks out a client, runs a single query, and releases it instantly. However, for database Transactions (where we have multiple sequential commands started by BEGIN and completed with COMMIT or ROLLBACK), we need the exact same client connection for the whole duration to preserve transaction boundaries. Calling getClient lets us fetch and persist a single client across multiple commands before releasing it.',
        architectTip: 'Mention that we must call client.release() inside a "finally" block to ensure we never lock out clients if queries crash.'
      }
    ]
  },
  errorHandler: {
    path: 'src/middleware/errorHandler.ts',
    name: 'errorHandler.ts',
    category: 'Middleware',
    purpose: 'Standardizes API error responses. Categorizes operational issues from critical server failures, and maps native Postgres codes (like unique or foreign key crashes) into helpful, clean JSON objects.',
    code: `import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  public status: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = \`\${statusCode}\`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (err.statusCode === 500) {
    console.error('[CRITICAL FAILURE]', err);
  }

  let errorResponse = {
    status: err.status,
    message: err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  };

  // '23505' - PostgreSQL Unique Violation Code
  if (err.code === '23505') {
    errorResponse.message = 'A record with this identifier already exists.';
    res.status(409).json({
      status: 'fail',
      message: errorResponse.message
    });
    return;
  }

  // '23503' - PostgreSQL Foreign Key Violation Code
  if (err.code === '23503') {
    errorResponse.message = 'Referenced related item does not exist in our catalog.';
    res.status(400).json({
      status: 'fail',
      message: errorResponse.message
    });
    return;
  }

  res.status(err.statusCode).json({
    status: errorResponse.status,
    message: errorResponse.message,
    ...(errorResponse.stack && { stack: errorResponse.stack })
  });
};`,
    explanations: [
      {
        lines: '3 - 15',
        code: `export class AppError extends Error {\n  public statusCode: number;\n  public isOperational: boolean;\n  constructor(...) {\n    super(message);\n    this.isOperational = true;\n  }\n}`,
        explanation: 'Declares an custom error helper extending standard JS Error. Distinguishes predicted operational problems (such as duplicate emails) from unhandled node code bugs. Captures stack traces properly.'
      },
      {
        lines: '17 - 23',
        code: `export const errorHandler = (\n  err: any, req: Request, res: Response, next: NextFunction\n): void => {\n  err.statusCode = err.statusCode || 500;`,
        explanation: 'Declares standard Express error catcher. Express identifies this exactly as an error-handling middleware because it strictly has exactly four signature arguments: (err, req, res, next).'
      },
      {
        lines: '34 - 52',
        code: `if (err.code === '23505') {\n  // Handles Postgres UNIQUE violation\n}\nif (err.code === '23503') {\n  // Handles Postgres FOREIGN KEY constraint failure\n}`,
        explanation: 'Interprets native raw PostgreSQL server codes. Translates database system errors (like "23505" unique constraints or "23503" foreign constraints) into clean, client-friendly error structures automatically.'
      }
    ],
    interviewQuestions: [
      {
        question: 'What differentiates Express error-handling middleware from general route middleware?',
        answer: 'Express distinguishes middleware functions by the number of arguments they define. Standard routing middleware defines three arguments: (req, res, next). Error-handling middleware MUST define exactly four arguments: (err, req, res, next). If you omit the "next" argument or have fewer than four, Express will treat it as regular middleware, fail to intercept thrown exceptions, and the server will hang or throw default exceptions.',
        architectTip: 'Remind the interviewer that we must place our error-handling middleware at the very bottom of our Express stack (after all router initializations), otherwise it will never catch exceptions!'
      },
      {
        question: 'What is the utility of "isOperational" property in custom AppErrors?',
        answer: 'Operational errors correspond to expected failures in production (e.g., resource not found, invalid email format, expired token). Programmer errors are bugs (e.g., referencing undefined properties, database connection failure, syntax typos). By setting isOperational=true on expected errors, our global express handler can cleanly inform users of their specific mistake, while unexpected programmer errors (where isOperational is undefined) can hide raw system dumps and warn admins instead.',
        architectTip: 'In production systems, programmer errors require a graceful process restart to avoid corrupt state!'
      },
      {
        question: 'Why is it important to prevent raw database stack traces or system messages from leaking to client responses in production?',
        answer: 'Raw database or framework stack traces are a massive vulnerability. They expose internal table configurations, column naming structures, database engine directories, and sometimes library version configurations. Hackers exploit this metadata to design highly targeted SQL injection or access bypass attacks. In production, we always replace system stack dumps with helpful human-friendly translations, while logging the real stack privately in a telemetry dashboard.',
        architectTip: 'Demonstrates outstanding security discipline to mention setting NODE_ENV=production to automatically hide stack traces!'
      }
    ]
  },
  authGuard: {
    path: 'src/middleware/auth.ts',
    name: 'auth.ts',
    category: 'Middleware',
    purpose: 'Secures and restricts api access to logged-in users only. Parses JWT variables, validates expirations, and binds user identities into the Express context thread. Also implements user role-based access rules.',
    code: `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.ts';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        username: string;
        email: string;
        role: string;
      };
    }
  }
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(
        new AppError('You are not logged in. Please sign in to request this page.', 401)
      );
    }

    const jwtSecret = process.env.JWT_SECRET || 'your_jwt_signing_token_key_change_me_in_production';
    
    const decoded = jwt.verify(token, jwtSecret) as {
      userId: number;
      username: string;
      email: string;
      role: string;
    };

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role
    };

    next();
  } catch (err: any) {
    if (err.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid authentication token signature.', 401));
    }
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Your session login has expired. Please sign in again.', 401));
    }
    next(err);
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError('Permission Denied. You do not hold permissions to operate this action.', 403)
      );
    }
    next();
  };
};`,
    explanations: [
      {
        lines: '5 - 16',
        code: `declare global {\n  namespace Express {\n    interface Request {\n      user?: { ... };\n    }\n  }\n}`,
        explanation: 'Extends standard TypeScript Express definition files. Leverages module-merging namespaces. Overwrites Request interfaces, allowing developers to type-safely access "req.user" across consecutive controllers!'
      },
      {
        lines: '21 - 29',
        code: `if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {\n  token = req.headers.authorization.split(' ')[1];\n}`,
        explanation: 'Extracts token from standard HTTP Header layout: "Authorization: Bearer <JWT_VALUE>". Standardized approach for token exchanges in Single Page Applications (SPA) and mobile APIs.'
      },
      {
        lines: '39 - 44',
        code: `const decoded = jwt.verify(token, jwtSecret) as {\n  userId: number...\n};`,
        explanation: 'Decrypts and verifies JWT signature with cryptographical HMAC checks using the private server secret. Prevents clients from tempering or forging credentials.'
      },
      {
        lines: '46 - 51',
        code: `req.user = {\n  userId: decoded.userId...\n};`,
        explanation: 'Binds the verified user credential payload to current Request context, then passes execution down the pipeline via next(). Consecutive controller scopes can immediately access user details.'
      }
    ],
    interviewQuestions: [
      {
        question: 'What is the standard anatomy of a JSON Web Token (JWT) and where is it stored?',
        answer: 'A JWT is structured into three parts separated by periods: Header (specifies hash algorithms used), Payload (contains user properties / claims like userId and roles), and Signature (a cryptographic checksum of header and payload generated with a private server secret). In the client-side browser, it is stored in Memory or Secure Cookies. Under typical API requests, it is dispatched inside HTTP "Authorization: Bearer <token>" headers.',
        architectTip: 'Avoid storing sensitive or huge payloads inside the decodable JWT, as it is only base64 encoded and can be parsed by anyone!'
      },
      {
        question: 'How does type-merging "declare global" in TypeScript help when designing Express middleware structures?',
        answer: 'Express Request holds no generic custom fields out of the box. If we try to bind "req.user = data" in standard TypeScript, compiler builds will fail indicating "property user does not exist on type Request". By type-merging the Express Namespace in our global auth guard, we inform TypeScript of this custom property addition, preserving strict compiler safety and autocomplete benefits throughout controllers.',
        architectTip: 'This shows deep TypeScript core proficiency that senior engineers look for when evaluating junior architects!'
      },
      {
        question: 'How do you handle role-based Authorization (e.g. users vs admins) dynamically inside routing gates?',
        answer: 'We use closures! By implementing a decorator pattern like restrictTo("admin", "superadmin"), we return an Express middleware function. Since closures remember outer parameter scope, the inner middleware function can cleanly compare req.user.role (appended by our protect gate) against the permitted roles. If authorized, next() is executed, else we throw a 403 Forbidden Exception.',
        architectTip: 'Mention that restrictTo middleware must always be mounted AFTER the protect middleware so req.user is guaranteed to exist!'
      }
    ]
  },
  authController: {
    path: 'src/controllers/authController.ts',
    name: 'authController.ts',
    category: 'Controller',
    purpose: 'Handles registration and authentication pipelines. Validates parameters, salts and hashes user passwords, registers rows securely, and seals secure, serialized token seals as a response payload.',
    code: `import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

const signToken = (payload: { userId: number; username: string; email: string; role: string }) => {
  const secret = process.env.JWT_SECRET || 'your_jwt_signing_token_key_change_me_in_production';
  const expiry = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign(payload, secret, { expiresIn: expiry });
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return next(new AppError('Please provide registration details: username, email, password.', 400));
    }

    if (password.length < 6) {
      return next(new AppError('Password must contain at least 6 characters for safety.', 400));
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const sql = \`
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING user_id, username, email, role, created_at;
    \`;
    
    const result = await db.query(sql, [username.trim(), email.toLowerCase().trim(), hashedPassword]);
    const newUser = result.rows[0];

    const token = signToken({
      userId: newUser.user_id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role
    });

    res.status(201).json({
      status: 'success',
      token,
      data: {
        user: {
          userId: newUser.user_id,
          username: newUser.username,
          email: newUser.email,
          role: newUser.role,
          createdAt: newUser.created_at
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return next(new AppError('Please enter email and account password.', 400));
    }

    const sql = \`
      SELECT user_id, username, email, password_hash, role
      FROM users
      WHERE email = $1;
    \`;
    const result = await db.query(sql, [email.toLowerCase().trim()]);

    if (result.rows.length === 0) {
      return next(new AppError('Incorrect email or account password.', 401));
    }

    const matchedUser = result.rows[0];

    const isMatched = await bcrypt.compare(password, matchedUser.password_hash);

    if (!isMatched) {
      return next(new AppError('Incorrect email or account password.', 401));
    }

    const token = signToken({
      userId: matchedUser.user_id,
      username: matchedUser.username,
      email: matchedUser.email,
      role: matchedUser.role
    });

    res.status(200).json({
      status: 'success',
      token,
      data: {
        user: {
          userId: matchedUser.user_id,
          username: matchedUser.username,
          email: matchedUser.email,
          role: matchedUser.role
        }
      }
    });
  } catch (err) {
    next(err);
  }
};`,
    explanations: [
      {
        lines: '6 - 11',
        code: `const signToken = (payload) => {\n  return jwt.sign(payload, secret, { expiresIn: expiry });\n};`,
        explanation: 'Encapsulates JSON Web Token generation. Combines token claims (userId, role) with secret signature and binds a duration parameter (idle limits like "7d") to guarantee authorization limits automatic expiration.'
      },
      {
        lines: '30 - 32',
        code: `const salt = await bcrypt.genSalt(12);\nconst hashedPassword = await bcrypt.hash(password, salt);`,
        explanation: 'Salting and hashing raw passwords with blowfish bcrypt algorithm before storing. The salt rounds value of 12 increases database hash computation complexity to protect credentials against heavy brute force and dictionary tables lookup cracking.'
      },
      {
        lines: '34 - 40',
        code: `const sql = \`INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING user_id, role...\`;\nconst result = await db.query(sql, [username, email, hashedPassword]);`,
        explanation: 'Executes inserting of credentials safely. Uses parameterized SQL placeholders. Invokes "RETURNING" clause to immediately retrieve newly generated autoincrement ID and defaults directly, avoiding a second SELECT database hit!'
      },
      {
        lines: '101 - 105',
        code: `const isMatched = await bcrypt.compare(password, matchedUser.password_hash);`,
        explanation: 'Uses bcrypt.compare() to verify matching hashes. Bcrypt performs a constant-time cryptographic comparison, shielding the validation checks from side-channel timing analysis attacks.'
      }
    ],
    interviewQuestions: [
      {
        question: 'Why should we never store passwords in plain text, and why do we prefer "Salting" alongside a cryptographic hash?',
        answer: 'If a databases file is leaked or compromised, plain text passwords expose every client account instantly. A cryptographic hash (like MD0/SHA) is a one-way mathematical function. However, identical input yields identical hashes, letting attackers use pre-computed maps (Rainbow Tables) to reverse generic passwords. "Salting" solves this by prepending a unique cryptographically random sequence of bytes to each password before hashing, producing entirely distinct hashes for identical passwords.',
        architectTip: 'Explain that bcryptjs is specifically designed to be slow, requiring substantial CPU compute time which effectively deters offline brute-force attempts!'
      },
      {
        question: 'What is a "timing attack" (or side-channel analysis), and how does bcrypt.compare mitigate it?',
        answer: 'A timing attack occurs when an attacker measures the microsecond differences in server evaluation times to guess credentials. If your database comparison uses standard string matches (e.g. "if (str1 === str2)"), the processor breaks early upon the very first mismatch character, meaning correct starting characters take longer to refuse. "bcrypt.compare" uses constant-time string comparison algorithms, checking all chars sequentially for identical duration regardless of where an error is, neutralizing timing attacks.',
        architectTip: 'This is a premium, high-scoring answer that highlights exquisite cryptographic security awareness!'
      },
      {
        question: 'Explain the purpose of the "RETURNING" clause in PostgreSQL INSERT statements.',
        answer: 'In standard SQL systems (like MySQL), after inserting a row, you must call a separate "LAST_INSERT_ID()" function or fire a second select query to retrieve the auto-increment primary key. PostgreSQL provides the "RETURNING" clause, which completes the INSERT and returns specified row properties in a single database round trip, substantially saving server network and execution costs.',
        architectTip: 'Highly efficient database interactions are key. Always use RETURNING user_id, created_at, role to avoid extra roundtrips.'
      }
    ]
  },
  productController: {
    path: 'src/controllers/productController.ts',
    name: 'productController.ts',
    category: 'Controller',
    purpose: 'Bridges REST clients to the product database tables. Implements fast, indexed dual-filters, paginates search boundaries responsibly, and resolves complex JOIN models cheap.',
    code: `import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const getAllProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string || '10', 10);
    const page = parseInt(req.query.page as string || '1', 10);
    const offset = (page - 1) * limit;

    const categoryId = req.query.category_id;
    const brand = req.query.brand;

    let queryParams: any[] = [];
    let filterClauses: string[] = [];

    if (categoryId) {
      queryParams.push(categoryId);
      filterClauses.push(\`p.category_id = $\${queryParams.length}\`);
    }

    if (brand) {
      queryParams.push(brand);
      filterClauses.push(\`p.brand = $\${queryParams.length}\`);
    }

    const whereString = filterClauses.length > 0 
      ? \`WHERE \${filterClauses.join(' AND ')}\` 
      : '';

    const querySql = \`
      SELECT 
        p.product_id, p.name, p.brand, p.model_no, p.slug, p.image_url, p.specs_summary, 
        c.name AS category_name, min_p.cheapest_price, min_p.store_name
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS cheapest_price, s.name AS store_name
        FROM product_prices pp
        JOIN stores s ON pp.store_id = s.store_id
        WHERE pp.is_available = TRUE
        ORDER BY product_id, pp.price ASC
      ) min_p ON p.product_id = min_p.product_id
      \${whereString}
      ORDER BY p.product_id ASC
      LIMIT $\${queryParams.length + 1} OFFSET $\${queryParams.length + 2};
    \`;

    queryParams.push(limit, offset);
    const result = await db.query(querySql, queryParams);

    let countParams = queryParams.slice(0, queryParams.length - 2);
    const countSql = \`SELECT COUNT(*) FROM products p \${whereString};\`;
    const countResult = await db.query(countSql, countParams);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      pagination: {
        totalItems: totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit
      },
      data: { products: result.rows }
    });
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      return next(new AppError('Invalid numeric product parameter.', 400));
    }

    const productSql = \`
      SELECT p.*, c.name AS category_name
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.product_id = $1;
    \`;
    const productResult = await db.query(productSql, [productId]);

    if (productResult.rows.length === 0) {
      return next(new AppError('No gadget catalog entry found.', 404));
    }

    const product = productResult.rows[0];

    const pricesSql = \`
      SELECT pp.price_id, pp.price, pp.original_price, pp.discount, pp.product_url, pp.is_available, pp.last_scraped_at, 
             s.name AS store_name, s.rating AS store_rating, s.logo_url AS store_logo
      FROM product_prices pp
      JOIN stores s ON pp.store_id = s.store_id
      WHERE pp.product_id = $1
      ORDER BY pp.price ASC;
    \`;
    const pricesResult = await db.query(pricesSql, [productId]);

    res.status(200).json({
      status: 'success',
      data: { product, storesPricing: pricesResult.rows }
    });
  } catch (err) {
    next(err);
  }
};

export const searchProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const searchTerm = req.params.query;

    if (!searchTerm || searchTerm.trim().length === 0) {
      return next(new AppError('Empty query search parameters.', 400));
    }

    const sql = \`
      SELECT p.product_id, p.name, p.brand, p.slug, p.image_url, p.specs_summary, c.name as category_name
      FROM products p
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.name ILIKE $1 
         OR p.brand ILIKE $1 
         OR p.specs_summary ILIKE $1
      ORDER BY p.name ASC
      LIMIT 15;
    \`;

    const searchWildcard = \`%\${searchTerm.trim()}%\`;
    const result = await db.query(sql, [searchWildcard]);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: { products: result.rows }
    });
  } catch (err) {
    next(err);
  }
};`,
    explanations: [
      {
        lines: '9 - 13',
        code: `const limit = parseInt(req.query.limit... || '10');\nconst page = parseInt(req.query.page... || '1');\nconst offset = (page - 1) * limit;`,
        explanation: 'Enforces pagination calculation. Pagination is mandatory for scalable REST standards to prevent a single query from locking the database by fetching millions of records unexpectedly.'
      },
      {
        lines: '36 - 44',
        code: `SELECT DISTINCT ON (product_id) product_id, price AS cheapest_price...\nFROM product_prices pp\nORDER BY product_id, pp.price ASC`,
        explanation: 'Excellent PostgreSQL trick! Generates a single consolidated list mapping each product_id to its absolute cheapest live partner store price entry in a single optimized LEFT JOIN query.'
      },
      {
        lines: '137 - 149',
        code: `WHERE p.name ILIKE $1 OR p.brand ILIKE $1 OR p.specs_summary ILIKE $1`,
        explanation: 'Uses case-insensitive wildcards search mapping ("ILIKE"). Combined with parameterized wildcards safeguards (e.g. "%phone%"), this safely scans database categories safely without risks of escapes.'
      }
    ],
    interviewQuestions: [
      {
        question: 'Explain the working mechanism of PostgreSQL "SELECT DISTINCT ON" keyword in our product search query, and what is its performance benefit?',
        answer: 'SELECT DISTINCT ON (product_id) evaluates columns per product_id block, keeping only the very first tuple for that block based on the custom ORDER BY. Since we order product_prices by "product_id, price ASC", the first row Postgres scans in each block is guaranteed to have the minimum price. This executes the grouping and minimum price identification in a single high-speed database pass, entirely skipping slow sub-select loops or bulky aggregate GROUP BY expressions.',
        architectTip: 'Point out that the columns in DISTINCT ON must exactly match the left-most columns in the ORDER BY clause, which is a common PostgreSQL rule!'
      },
      {
        question: 'Why is offset-based pagination eventually problematic for ultra-large tables, and what is the alternative?',
        answer: 'Offset-based pagination (LIMIT / OFFSET) is easy to write but scales with O(N) complexity on deep pages. PostgreSQL does not magically jump to OFFSET 1,000,000; it must sequentially read and discard the first 1,000,000 rows in memory before returning the next 10 items. For millions of rows, this spikes disk reads. The alternative is Cursor-Based or Keyset pagination (e.g., "WHERE product_id > last_seen_id LIMIT 10"), which uses index scans to access deep rows in O(log N) time.',
        architectTip: 'This shows massive scalability awareness. Interrogators love candidates who explain the pitfalls of classic OFFSET clauses!'
      },
      {
        question: 'How does ILIKE operate, and why did we choose to search by specs_summary instead of JSONB query paths?',
        answer: 'PostgreSQL "ILIKE" represents case-insensitive pattern matching. Combining products and specs_summary in plain VARCHAR, we can index the specifications safely and search via relative wildcard paths. While JSONB query structures are powerful for highly loose schemas, they require complex operator strings and special indexing models. A standard VARCHAR specifications summary is highly performant and extremely easy for beginner-to-intermediate developers to read and debug.',
        architectTip: 'Saying we keep specifications flat in a VARCHAR text and searchable with indexes demonstrates beautiful, pragmatic architectural discipline.'
      }
    ]
  },
  watchlistController: {
    path: 'src/controllers/watchlistController.ts',
    name: 'watchlistController.ts',
    category: 'Controller',
    purpose: 'Manages user bookmarked gadgets. Uses authenticated JWT profile IDs to retrieve individual lists on the dashboard and strictly verifies ownership before executing drops to secure data private limits.',
    code: `import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const getWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const sql = \`
      SELECT 
        w.watchlist_id, w.added_at, p.product_id, p.name AS product_name, p.brand, p.specs_summary, p.image_url, 
        min_p.lowest_live_price, min_p.store_name AS purchase_outlet
      FROM watchlist w
      JOIN products p ON w.product_id = p.product_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS lowest_live_price, s.name AS store_name
        FROM product_prices pp
        JOIN stores s ON pp.store_id = s.store_id
        WHERE pp.is_available = TRUE
        ORDER BY product_id, pp.price ASC
      ) min_p ON p.product_id = min_p.product_id
      WHERE w.user_id = $1
      ORDER BY w.added_at DESC;
    \`;

    const result = await db.query(sql, [userId]);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: { watchlist: result.rows }
    });
  } catch (err) {
    next(err);
  }
};

export const addToWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { productId } = req.body;

    if (!productId) {
      return next(new AppError('Please provide raw productId in post payload.', 400));
    }

    const productCheck = await db.query('SELECT product_id FROM products WHERE product_id = $1;', [productId]);
    if (productCheck.rows.length === 0) {
      return next(new AppError('No catalog product found matching this identifier.', 404));
    }

    const sql = \`
      INSERT INTO watchlist (user_id, product_id)
      VALUES ($1, $2)
      RETURNING watchlist_id, added_at, user_id, product_id;
    \`;

    const result = await db.query(sql, [userId, productId]);

    res.status(201).json({
      status: 'success',
      message: 'Product added to watchlist success.',
      data: { watchlistEntry: result.rows[0] }
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return next(new AppError('This gadget is already on your watchlist catalog.', 400));
    }
    next(err);
  }
};

export const removeFromWatchlist = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const watchlistId = parseInt(req.params.id, 10);

    if (isNaN(watchlistId)) {
      return next(new AppError('Invalid watchlist identifier.', 400));
    }

    const ownerCheck = await db.query('SELECT user_id FROM watchlist WHERE watchlist_id = $1;', [watchlistId]);

    if (ownerCheck.rows.length === 0) {
      return next(new AppError('Bookmark record not found.', 404));
    }

    if (ownerCheck.rows[0].user_id !== userId) {
      return next(new AppError('Unauthorized. You do not hold ownership permission over this bookmark.', 403));
    }

    const deleteSql = 'DELETE FROM watchlist WHERE watchlist_id = $1;';
    await db.query(deleteSql, [watchlistId]);

    res.status(200).json({
      status: 'success',
      message: 'Product successfully removed from your watchlist.'
    });
  } catch (err) {
    next(err);
  }
};`,
    explanations: [
      {
        lines: '9 - 10',
        code: `const userId = req.user!.userId;`,
        explanation: 'Extracts the user credential context directly from Express req.user metadata (which our secure Auth guard appends upon decryption). Completely avoids client spoofing vulnerabilities.'
      },
      {
        lines: '53 - 56',
        code: `const productCheck = await db.query('SELECT product_id...');\nif (productCheck.rows.length === 0) { ... }`,
        explanation: 'Enforces catalog reference validation. Before completing a bookmark insert, we query the Products catalogue to verify if target items exist, dodging orphaned references at controller limits.'
      },
      {
        lines: '89 - 102',
        code: `const ownerCheck = await db.query('SELECT user_id FROM watchlist...');\nif (ownerCheck.rows[0].user_id !== userId) { ... }`,
        explanation: 'Implements absolute resource ownership protection! Validates that the active session user owns the targeted bookmark ID before deletion. Stymies Horizontal Privilege Escalation hacks.'
      }
    ],
    interviewQuestions: [
      {
        question: 'What is horizontal privilege escalation (IDOR vulnerability), and how do we protect our API delete handlers from it?',
        answer: 'Horizontal Privilege Escalation (Insecure Direct Object Reference) is a massive security bug. It occurs if an API lets a user access or modify someone else\'s private data simply by guessing or replacing a record database ID parameter (e.g. sending "DELETE /api/watchlist/455"). We neutralize this vulnerability by checking the resource owners ID ("user_id") inside the database against the authenticated user ID ("req.user.userId" from JWT) on the server, blocking the query with a 403 Forbidden code if they don\'t match.',
        architectTip: 'Never trust user parameters implicitly. Always authenticate ownership on every update/delete on the server!'
      },
      {
        question: 'What is a "Junction Table" (or Join Table) in relational algebra, and how does "watchlist" fit into this pattern?',
        answer: 'A Junction table resolves a Many-to-Many relationship between two database entities. A registered User can bookmark many distinct Products, and a Product can be bookmarked by many Users. Since tables shouldn\'t contain repeating arrays (violating 1NF), the watchlist table acts as a clean bridge holding two primary foreign keys: "user_id" and "product_id", along with a composite unique index constraint to enforce singular linkage uniqueness.',
        architectTip: 'State that junction tables keep relations clean and fully normalized of transactional data duplication.'
      },
      {
        question: 'How do CASCADE rules on foreign keys behave under database deletion sequences?',
        answer: 'Our watchlist table defines a foreign constraint: "REFERENCES users(user_id) ON DELETE CASCADE". This tells PostgreSQL that if a master user account row is permanently deleted, the database engine must automatically cascade and scrub all corresponding bookmarks records in the watchlist table on disk. This avoids dead, orphaned rows, preserving perfect database Referential Integrity without requiring slow manual sweeps.',
        architectTip: 'While cascade deletion is beautiful for transient profiles or bookmarks, suggest caution when cascading critical tables like Payments or Logs!'
      }
    ]
  },
  alertController: {
    path: 'src/controllers/alertController.ts',
    name: 'alertController.ts',
    category: 'Controller',
    purpose: 'Handles creation and removal of clients price ceilings targets, checking for correct numeric formats and validating ownership limits.',
    code: `import { Request, Response, NextFunction } from 'express';
import db from '../config/db.ts';
import { AppError } from '../middleware/errorHandler.ts';

export const createAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { productId, targetPrice } = req.body;

    if (!productId || !targetPrice) {
      return next(new AppError('Please supply product ID and a valid target price threshold.', 400));
    }

    const numericalPrice = parseFloat(targetPrice);
    if (isNaN(numericalPrice) || numericalPrice <= 0) {
      return next(new AppError('Target price must equal a valid positive dollar amount.', 400));
    }

    const productCheck = await db.query('SELECT name FROM products WHERE product_id = $1;', [productId]);
    if (productCheck.rows.length === 0) {
      return next(new AppError('Catalog gadget does not exist.', 404));
    }

    const sql = \`
      INSERT INTO price_alerts (user_id, product_id, target_price)
      VALUES ($1, $2, $3)
      RETURNING alert_id, user_id, product_id, target_price, is_active, alert_sent, created_at;
    \`;

    const result = await db.query(sql, [userId, productId, numericalPrice]);

    res.status(201).json({
      status: 'success',
      message: \`Price drop alert registered successfully at \$\${numericalPrice}.\`,
      data: { alert: result.rows[0] }
    });
  } catch (err) {
    next(err);
  }
};

export const getUserAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const sql = \`
      SELECT 
        pa.alert_id, pa.target_price, pa.is_active, pa.alert_sent, pa.created_at, 
        p.product_id, p.name AS product_name, p.brand, p.image_url, min_p.lowest_live_price
      FROM price_alerts pa
      JOIN products p ON pa.product_id = p.product_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id) product_id, price AS lowest_live_price
        FROM product_prices
        WHERE is_available = TRUE
        ORDER BY product_id, price ASC
      ) min_p ON pa.product_id = min_p.product_id
      WHERE pa.user_id = $1
      ORDER BY pa.created_at DESC;
    \`;

    const result = await db.query(sql, [userId]);

    res.status(200).json({
      status: 'success',
      results: result.rows.length,
      data: { alerts: result.rows }
    });
  } catch (err) {
    next(err);
  }
};

export const deleteAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const alertId = parseInt(req.params.id, 10);

    if (isNaN(alertId)) {
      return next(new AppError('Invalid alert parameter.', 400));
    }

    const alertResult = await db.query('SELECT user_id FROM price_alerts WHERE alert_id = $1;', [alertId]);

    if (alertResult.rows.length === 0) {
      return next(new AppError('No alert settings found.', 404));
    }

    if (alertResult.rows[0].user_id !== userId) {
      return next(new AppError('Forbidden. You do not hold ownership authority over this alert.', 403));
    }

    await db.query('DELETE FROM price_alerts WHERE alert_id = $1;', [alertId]);

    res.status(200).json({
      status: 'success',
      message: 'Pricing drop alert removed successfully.'
    });
  } catch (err) {
    next(err);
  }
};`,
    explanations: [
      {
        lines: '15 - 19',
        code: `const numericalPrice = parseFloat(targetPrice);\nif (isNaN(numericalPrice) || numericalPrice <= 0) { ... }`,
        explanation: 'Enforces type casting and range check validation. Sanitizes raw inputs into precise numbers, blocking negative or garbage inputs from disrupting price engine metrics.'
      },
      {
        lines: '39 - 62',
        code: `SELECT pa.alert_id... FROM price_alerts pa... WHERE pa.user_id = $1`,
        explanation: 'Fetches customized alarm configurations for target active profiles. Evaluates cheapest vendor prices simultaneously utilizing our high-speed subquery maps, printing alert lists cleanly.'
      },
      {
        lines: '89 - 101',
        code: `const alertResult = await db.query('SELECT user_id FROM price_alerts...');\nif (alertResult.rows[0].user_id !== userId) { ... }`,
        explanation: 'Safeguards sensitive alarm configurations. Authenticates ownership checks to prevent malicious requestors from deleting active pricing rules created by other users.'
      }
    ],
    interviewQuestions: [
      {
        question: 'Why must we perform type validation and range checks on inputs like "targetPrice" instead of saving them directly into numeric database tables?',
        answer: 'Unvalidated database writes are a massive runtime hazard. If a client sends "targetPrice" as "-15.00" or a string of characters ("infinity"), and we pass it to SQL directly: (1) Check constraints in SQL will fail, crashing the connection, or (2) It can corrupt our continuous price scraper checks, triggering fake notifications. Checking the value is a valid, positive float is mandatory to protect database integrity.',
        architectTip: 'State that we also use NUMERIC(10, 2) in Postgres because floating-point binary types (like REAL or DOUBLE) suffer from precision rounding flaws, which is fatal for financial math!'
      },
      {
        question: 'How would you scale price drop checking when crawl scripts record new store prices in real-time?',
        answer: 'When a crawler records a new cheapest price for a product, we evaluate matching alerts using: "SELECT * FROM price_alerts WHERE product_id = $1 AND target_price >= $2 AND is_active = TRUE AND alert_sent = FALSE". By indexing on (product_id, target_price), this lookup is O(log N) fast. We can run this block asynchronously after a cron scrape logs new data, fetching triggered rows and feeding them to an email queue like standard Node streams or bulk SMTP dispatch loaders.',
        architectTip: 'This represents standard, optimal production scaling logic that interview examiners absolutely admire!'
      },
      {
        question: 'What is the utility of "alert_sent" deduplication column in price_alerts layout?',
        answer: 'Deduplication is a vital UX defense. If we don\'t track notification status and the product price drops below a user\'s target, our background scraper checks will fire warning emails repeatedly (every few minutes of crawler crons) until the user logs in and disables the alert. By setting "alert_sent = TRUE" instantly when dispatching the main alert, we prevent spamming the user, resetting the status only if they edit or reactivate the trigger.',
        architectTip: 'Emphasize that keeping users happy includes shielding them from repetitive email spam!'
      }
    ]
  },
  routesApi: {
    path: 'src/routes/api.ts',
    name: 'api.ts',
    category: 'Router',
    purpose: 'Aggregates and namespaces all resource sub-routers (Auth, products, watchlists, alerts) under standard REST API prefix gateways, ensuring scalable Express structures.',
    code: `import { Router } from 'express';
import authRouter from './authRoutes.ts';
import productRouter from './productRoutes.ts';
import watchlistRouter from './watchlistRoutes.ts';
import alertRouter from './alertRoutes.ts';

const router = Router();

router.use('/auth', authRouter);
router.use('/products', productRouter);
router.use('/watchlist', watchlistRouter);
router.use('/alerts', alertRouter);

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'E-Commerce Gadget Deal Tracker REST APIs are fully active and healthy.',
    timestamp: new Date().toISOString()
  });
});

export default router;`,
    explanations: [
      {
        lines: '1 - 5',
        code: `import { Router } from \'express\';\nimport authRouter from \'./authRoutes.ts\';\nimport productRouter...`,
        explanation: 'Imports Express and its main sub-routers. Consolidating individual routers keeps the root server entrypoint cleanly organized.'
      },
      {
        lines: '9 - 12',
        code: `router.use(\'/auth\', authRouter);\nrouter.use(\'/products\', productRouter);`,
        explanation: 'Namespaces routes dynamically. For instance, catalog lookups inside productRouter are automatically prefixed as "/api/v1/products", keeping things completelyREST-compliant.'
      },
      {
        lines: '14 - 21',
        code: `router.get(\'/health\', (req, res) => { ... });`,
        explanation: 'Exposes basic service health-check endpoints. It reports engine status, time signatures, and acts as an integration target for system monitoring crons.'
      }
    ],
    interviewQuestions: [
      {
        question: 'Why do we namespace routes (e.g. "/api/v1") instead of nesting them together at the root level?',
        answer: 'Routing segmentation is central to API governance. By modularizing sub-handlers into their independent router files, we preserve MVC separation. More critically, prefixing routes under standard versioning parameters like "/api/v1" guarantees that if we completely overhaul or reflow endpoints in the future (releasing "v2"), existing mobile applications or external clients do not crash. It creates backward-compatibility gateways.',
        architectTip: 'Versioning is standard for professional architectures, making it a very smart answer to bring up autonomously!'
      },
      {
        question: 'Explain the role of the "/health" routing check in Cloud orchestration environments.',
        answer: 'In advanced container networks (like Kubernetes, GCP Cloud Run, or AWS ECS), the orchestrator regularly polls a "/health" endpoint via a Liveness Probe check. If the container locks up or crashes, the health check fails, letting the system automatically kill and restart the container, preserving high uptime metrics. It is also mapped to Readiness Probes, checking if database sockets are open before allowing client requests to hit the container.',
        architectTip: 'This is high-value backend infrastructure knowledge that proves outstanding practical expertise!'
      }
    ]
  },
  server: {
    path: 'src/server.ts',
    name: 'server.ts',
    category: 'Root Server',
    purpose: 'Bootstraps and runs the entire web application. Loads environmental values, initializes safety middleware structures, mounts consolidated API entryways, maps error catching fallbacks, and listens for requests.',
    code: `import express from 'express';
import dotenv from 'dotenv';
import apiRouter from './routes/api.ts';
import { errorHandler, AppError } from './middleware/errorHandler.ts';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

app.use('/api/v1', apiRouter);

app.all('*', (req, res, next) => {
  next(new AppError(\`Cannot find the requested endpoint: [\${req.method}] \${req.originalUrl} on this server.\`, 404));
});

app.use(errorHandler);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(\`================================================================\`);
  console.log(\`🚀 SENIOR ARCHITECT EXPENDITURE PORTAL - LIVE AND READY\`);
  console.log(\`📡 Backend listening at: http://0.0.0.0:\${PORT}\`);
  console.log(\`🔧 Run Mode: \${process.env.NODE_ENV || 'development'}\`);
  console.log(\`================================================================\`);
});

process.on('unhandledRejection', (err: any) => {
  console.error('[UNHANDLED REJECTION] Shutting down server gracefully...', err);
  server.close(() => {
    process.exit(1);
  });
});`,
    explanations: [
      {
        lines: '1 - 4',
        code: `import express from \'express\';\nimport dotenv from \'dotenv\';\nimport apiRouter from \'./routes/api.ts\';`,
        explanation: 'Loads Express frameworks and env configuration helpers. Brings in unified routing grids.'
      },
      {
        lines: '11',
        code: `app.use(express.json());`,
        explanation: 'Plugs in standard Express parser middleware. Translates JSON payload packets into Node.js object entities, binding them values onto req.body dynamically. Essential for receiving registration or alarm criteria.'
      },
      {
        lines: '15 - 17',
        code: `app.all(\'*\', (req, res, next) => {\n  next(new AppError(...));\n});`,
        explanation: 'Standard catches for unmapped endpoints. It triggers a consolidated 404 AppError and forwards it down the Express exception stack via next(), bypassing default HTML error frames.'
      },
      {
        lines: '29 - 34',
        code: `process.on(\'unhandledRejection\', (err) => {\n  server.close(() => { process.exit(1); });\n});`,
        explanation: 'Crucial server guard! Intercepts unhandled asynchronous script crashes (like database connection pool crashes). Shuts down the thread gracefully inside app bounds, preventing port lockups.'
      }
    ],
    interviewQuestions: [
      {
        question: 'Wait, what is "express.json()" and why is it necessary for handling incoming API data?',
        answer: 'By default, Node.js sees incoming HTTP request bodies as a raw stream of buffered binary byte chunks. Express does not automatically parse this stream in memory. "express.json()" is a built-in middleware that intercepts incoming requests, reads the stream buffers completed, checks if the Content-Type header matches "application/json", deserializes raw text into standard JavaScript objects, and attaches it onto "req.body" before our controllers run.',
        architectTip: 'Always mention that express.json() is a parsing middleware, saving candidates from writing cumbersome manual stream-reading blocks!'
      },
      {
        question: 'What is the purpose of subscribing to "unhandledRejection" and "uncaughtException" events in Node.js?',
        answer: 'Node.js is single-threaded. If an asynchronous database query or middleware throws an exception that is not explicitly caught in try/catch or promise-catch lines, it triggers an "unhandledRejection". Left unhandled, Node logs the error, but the server or process can continue running in a corrupted, unstable state (dangling db connections, memory leaks, unreleased clients). Subscribing to this lets us close database pool sockets cleanly and stop the server process gracefully to let container orchestrators safely reboot a clean instance.',
        architectTip: 'This shows massive enterprise-grade engineering experience in production Node environments!'
      }
    ]
  }
};
