# Complete REST API Course: Node.js + PostgreSQL

## Table of Contents
1. [Project Setup](#project-setup)
2. [Database Design & Connection](#database-design--connection)
3. [Basic Express Server Setup](#basic-express-server-setup)
4. [Creating Models](#creating-models)
5. [Building REST Endpoints](#building-rest-endpoints)
6. [Authentication & Security](#authentication--security)
7. [Advanced Features](#advanced-features)
8. [Error Handling & Validation](#error-handling--validation)
9. [Testing](#testing)
10. [Best Practices](#best-practices)

---

## 1. Project Setup

### Initialize Project
```bash
mkdir nodejs-postgresql-api
cd nodejs-postgresql-api
npm init -y
```

### Install Dependencies
```bash
# Core dependencies
npm install express pg dotenv bcryptjs jsonwebtoken cors helmet express-rate-limit

# Development dependencies
npm install --save-dev nodemon jest supertest
```

### Package.json Scripts
```json
{
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest"
  }
}
```

### Project Structure
```
src/
├── config/
│   ├── database.js
│   └── config.js
├── controllers/
│   ├── authController.js
│   ├── userController.js
│   └── postController.js
├── middleware/
│   ├── auth.js
│   ├── validation.js
│   └── errorHandler.js
├── models/
│   ├── User.js
│   └── Post.js
├── routes/
│   ├── auth.js
│   ├── users.js
│   └── posts.js
├── utils/
│   └── helpers.js
└── server.js
```

---

## 2. Database Design & Connection

### Environment Variables (.env)
```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database
DB_USER=your_username
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRE=7d
```

### Database Configuration (src/config/database.js)
```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
```

### Database Schema (SQL)
```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  avatar_url VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Posts table
CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  slug VARCHAR(255) UNIQUE,
  status VARCHAR(20) DEFAULT 'draft',
  featured_image VARCHAR(255),
  tags TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments table
CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
```

---

## 3. Basic Express Server Setup

### Main Server File (src/server.js)
```javascript
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
```

---

## 4. Creating Models

### User Model (src/models/User.js)
```javascript
const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.firstName = data.first_name;
    this.lastName = data.last_name;
    this.avatarUrl = data.avatar_url;
    this.isActive = data.is_active;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create new user
  static async create(userData) {
    const { username, email, password, firstName, lastName } = userData;
    
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (username, email, password, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    try {
      const result = await db.query(query, [
        username, 
        email, 
        hashedPassword, 
        firstName, 
        lastName
      ]);
      return new User(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    
    try {
      const result = await db.query(query, [id]);
      return result.rows.length ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    
    try {
      const result = await db.query(query, [email]);
      return result.rows.length ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Find user by username
  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1 AND is_active = true';
    
    try {
      const result = await db.query(query, [username]);
      return result.rows.length ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Get all users with pagination
  static async findAll(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT id, username, email, first_name, last_name, avatar_url, created_at
      FROM users 
      WHERE is_active = true
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const countQuery = 'SELECT COUNT(*) FROM users WHERE is_active = true';

    try {
      const [users, count] = await Promise.all([
        db.query(query, [limit, offset]),
        db.query(countQuery)
      ]);

      return {
        users: users.rows.map(user => new User(user)),
        totalCount: parseInt(count.rows[0].count),
        currentPage: page,
        totalPages: Math.ceil(parseInt(count.rows[0].count) / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  // Update user
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Dynamically build update query
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(this.id);

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await db.query(query, values);
      return new User(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Soft delete user
  async delete() {
    const query = `
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await db.query(query, [this.id]);
      return new User(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Compare password
  async comparePassword(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Get user's posts
  async getPosts(page = 1, limit = 10) {
    const Post = require('./Post');
    return Post.findByAuthor(this.id, page, limit);
  }

  // Convert to JSON (exclude password)
  toJSON() {
    const { password, ...userWithoutPassword } = this;
    return userWithoutPassword;
  }
}

module.exports = User;
```

### Post Model (src/models/Post.js)
```javascript
const db = require('../config/database');

class Post {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.content = data.content;
    this.authorId = data.author_id;
    this.slug = data.slug;
    this.status = data.status;
    this.featuredImage = data.featured_image;
    this.tags = data.tags;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Create new post
  static async create(postData) {
    const { title, content, authorId, slug, status = 'draft', featuredImage, tags } = postData;

    const query = `
      INSERT INTO posts (title, content, author_id, slug, status, featured_image, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    try {
      const result = await db.query(query, [
        title, content, authorId, slug, status, featuredImage, tags
      ]);
      return new Post(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Find post by ID
  static async findById(id) {
    const query = `
      SELECT p.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = $1
    `;

    try {
      const result = await db.query(query, [id]);
      if (result.rows.length) {
        const postData = result.rows[0];
        const post = new Post(postData);
        post.author = {
          id: postData.author_id,
          username: postData.username,
          firstName: postData.first_name,
          lastName: postData.last_name,
          avatarUrl: postData.avatar_url
        };
        return post;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  // Find posts by author
  static async findByAuthor(authorId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;

    const query = `
      SELECT * FROM posts 
      WHERE author_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const countQuery = 'SELECT COUNT(*) FROM posts WHERE author_id = $1';

    try {
      const [posts, count] = await Promise.all([
        db.query(query, [authorId, limit, offset]),
        db.query(countQuery, [authorId])
      ]);

      return {
        posts: posts.rows.map(post => new Post(post)),
        totalCount: parseInt(count.rows[0].count),
        currentPage: page,
        totalPages: Math.ceil(parseInt(count.rows[0].count) / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  // Get all posts with filters
  static async findAll(filters = {}, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    let whereConditions = [];
    let queryParams = [];
    let paramCount = 1;

    // Build WHERE conditions dynamically
    if (filters.status) {
      whereConditions.push(`p.status = $${paramCount}`);
      queryParams.push(filters.status);
      paramCount++;
    }

    if (filters.author) {
      whereConditions.push(`u.username ILIKE $${paramCount}`);
      queryParams.push(`%${filters.author}%`);
      paramCount++;
    }

    if (filters.search) {
      whereConditions.push(`(p.title ILIKE $${paramCount} OR p.content ILIKE $${paramCount})`);
      queryParams.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`p.tags && $${paramCount}`);
      queryParams.push(filters.tags);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      SELECT p.*, u.username, u.first_name, u.last_name, u.avatar_url
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*)
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ${whereClause}
    `;

    queryParams.push(limit, offset);

    try {
      const [posts, count] = await Promise.all([
        db.query(query, queryParams),
        db.query(countQuery, queryParams.slice(0, -2))
      ]);

      const postsWithAuthors = posts.rows.map(row => {
        const post = new Post(row);
        post.author = {
          id: row.author_id,
          username: row.username,
          firstName: row.first_name,
          lastName: row.last_name,
          avatarUrl: row.avatar_url
        };
        return post;
      });

      return {
        posts: postsWithAuthors,
        totalCount: parseInt(count.rows[0].count),
        currentPage: page,
        totalPages: Math.ceil(parseInt(count.rows[0].count) / limit)
      };
    } catch (error) {
      throw error;
    }
  }

  // Update post
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        fields.push(`${dbKey} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      return this;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(this.id);

    const query = `
      UPDATE posts 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    try {
      const result = await db.query(query, values);
      return new Post(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Delete post
  async delete() {
    const query = 'DELETE FROM posts WHERE id = $1 RETURNING *';

    try {
      const result = await db.query(query, [this.id]);
      return result.rows[0] ? new Post(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Generate slug from title
  static generateSlug(title) {
    return title
      .toLowerCase()
      .replace(/[^\w ]+/g, '')
      .replace(/ +/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

module.exports = Post;
```

---

## 5. Building REST Endpoints

### Authentication Controller (src/controllers/authController.js)
```javascript
const User = require('../models/User');
const jwt = require('jsonwebtoken');

class AuthController {
  // Register new user
  static async register(req, res, next) {
    try {
      const { username, email, password, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      const existingUsername = await User.findByUsername(username);
      if (existingUsername) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }

      // Create new user
      const user = await User.create({
        username,
        email,
        password,
        firstName,
        lastName
      });

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: user.toJSON(),
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Login user
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: user.toJSON(),
          token
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get current user profile
  static async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: { user: user.toJSON() }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update current user profile
  static async updateProfile(req, res, next) {
    try {
      const { firstName, lastName, avatarUrl } = req.body;
      
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const updatedUser = await user.update({
        first_name: firstName,
        last_name: lastName,
        avatar_url: avatarUrl
      });

      res.json({
        success: true,
        message: 'Profile updated successfully',
        data: { user: updatedUser.toJSON() }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
```

### User Controller (src/controllers/userController.js)
```javascript
const User = require('../models/User');

class UserController {
  // Get all users
  static async getAllUsers(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const result = await User.findAll(page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user by ID
  static async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: { user: user.toJSON() }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get user's posts
  static async getUserPosts(req, res, next) {
    try {
      const { id } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const posts = await user.getPosts(page, limit);

      res.json({
        success: true,
        data: posts
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete user (admin only)
  static async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      
      if (req.user.id === parseInt(id)) {
        return res.status(400).json({
          success: false,
          message: 'You cannot delete your own account'
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await user.delete();

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = UserController;
```

### Post Controller (src/controllers/postController.js)
```javascript
const Post = require('../models/Post');

class PostController {
  // Create new post
  static async createPost(req, res, next) {
    try {
      const { title, content, status, featuredImage, tags } = req.body;
      const authorId = req.user.id;

      // Generate slug from title
      const slug = Post.generateSlug(title) + '-' + Date.now();

      const post = await Post.create({
        title,
        content,
        authorId,
        slug,
        status: status || 'draft',
        featuredImage,
        tags
      });

      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: { post }
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all posts with filters
  static async getAllPosts(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      
      const filters = {
        status: req.query.status,
        author: req.query.author,
        search: req.query.search,
        tags: req.query.tags ? req.query.tags.split(',') : undefined
      };

      const result = await Post.findAll(filters, page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  // Get post by ID
  static async getPostById(req, res, next) {
    try {
      const { id } = req.params;
      const post = await Post.findById(id);

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      res.json({
        success: true,
        data: { post }
      });
    } catch (error) {
      next(error);
    }
  }

  // Update post
  static async updatePost(req, res, next) {
    try {
      const { id } = req.params;
      const { title, content, status, featuredImage, tags } = req.body;

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      // Check if user owns the post
      if (post.authorId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only update your own posts'
        });
      }

      const updateData = {};
      if (title) {
        updateData.title = title;
        updateData.slug = Post.generateSlug(title) + '-' + Date.now();
      }
      if (content) updateData.content = content;
      if (status) updateData.status = status;
      if (featuredImage) updateData.featuredImage = featuredImage;
      if (tags) updateData.tags = tags;

      const updatedPost = await post.update(updateData);

      res.json({
        success: true,
        message: 'Post updated successfully',
        data: { post: updatedPost }
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete post
  static async deletePost(req, res, next) {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      // Check if user owns the post
      if (post.authorId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own posts'
        });
      }

      await post.delete();

      res.json({
        success: true,
        message: 'Post deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PostController;
```

---

## 6. Authentication & Security

### JWT Authentication Middleware (src/middleware/auth.js)
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is not valid.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token is not valid.'
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = { auth, optionalAuth };
```

### Input Validation Middleware (src/middleware/validation.js)
```javascript
const validateRegistration = (req, res, next) => {
  const { username, email, password, firstName, lastName } = req.body;
  const errors = [];

  // Username validation
  if (!username) {
    errors.push('Username is required');
  } else if (username.length < 3 || username.length > 50) {
    errors.push('Username must be between 3 and 50 characters');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }

  // Email validation
  if (!email) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Please provide a valid email address');
  }

  // Password validation
  if (!password) {
    errors.push('Password is required');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number');
  }

  // Name validation
  if (firstName && firstName.length > 50) {
    errors.push('First name cannot exceed 50 characters');
  }
  if (lastName && lastName.length > 50) {
    errors.push('Last name cannot exceed 50 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) {
    errors.push('Email is required');
  }

  if (!password) {
    errors.push('Password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

const validatePost = (req, res, next) => {
  const { title, content } = req.body;
  const errors = [];

  if (!title) {
    errors.push('Title is required');
  } else if (title.length > 255) {
    errors.push('Title cannot exceed 255 characters');
  }

  if (!content) {
    errors.push('Content is required');
  }

  if (req.body.status && !['draft', 'published', 'archived'].includes(req.body.status)) {
    errors.push('Status must be one of: draft, published, archived');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }

  next();
};

const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page);
  const limit = parseInt(req.query.limit);

  if (page && (isNaN(page) || page < 1)) {
    return res.status(400).json({
      success: false,
      message: 'Page must be a positive integer'
    });
  }

  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    return res.status(400).json({
      success: false,
      message: 'Limit must be between 1 and 100'
    });
  }

  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validatePost,
  validatePagination
};
```

### Error Handler Middleware (src/middleware/errorHandler.js)
```javascript
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error('Error:', err);

  // PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        const field = err.constraint?.includes('email') ? 'Email' : 'Username';
        error.message = `${field} already exists`;
        error.statusCode = 400;
        break;
      case '23503': // Foreign key violation
        error.message = 'Referenced record not found';
        error.statusCode = 400;
        break;
      case '23502': // Not null violation
        error.message = 'Required field is missing';
        error.statusCode = 400;
        break;
      default:
        error.message = 'Database error';
        error.statusCode = 500;
    }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    error.statusCode = 401;
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error.message = message;
    error.statusCode = 400;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
```

---

## 7. Advanced Features

### Route Files

#### Auth Routes (src/routes/auth.js)
```javascript
const express = require('express');
const AuthController = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', validateRegistration, AuthController.register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', validateLogin, AuthController.login);

// @route   GET /api/auth/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, AuthController.getProfile);

// @route   PUT /api/auth/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile', auth, AuthController.updateProfile);

module.exports = router;
```

#### User Routes (src/routes/users.js)
```javascript
const express = require('express');
const UserController = require('../controllers/userController');
const { auth } = require('../middleware/auth');
const { validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users
// @access  Private
router.get('/', auth, validatePagination, UserController.getAllUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private
router.get('/:id', auth, UserController.getUserById);

// @route   GET /api/users/:id/posts
// @desc    Get user's posts
// @access  Private
router.get('/:id/posts', auth, validatePagination, UserController.getUserPosts);

// @route   DELETE /api/users/:id
// @desc    Delete user (admin only)
// @access  Private
router.delete('/:id', auth, UserController.deleteUser);

module.exports = router;
```

#### Post Routes (src/routes/posts.js)
```javascript
const express = require('express');
const PostController = require('../controllers/postController');
const { auth, optionalAuth } = require('../middleware/auth');
const { validatePost, validatePagination } = require('../middleware/validation');

const router = express.Router();

// @route   POST /api/posts
// @desc    Create new post
// @access  Private
router.post('/', auth, validatePost, PostController.createPost);

// @route   GET /api/posts
// @desc    Get all posts with filters
// @access  Public
router.get('/', optionalAuth, validatePagination, PostController.getAllPosts);

// @route   GET /api/posts/:id
// @desc    Get post by ID
// @access  Public
router.get('/:id', optionalAuth, PostController.getPostById);

// @route   PUT /api/posts/:id
// @desc    Update post
// @access  Private
router.put('/:id', auth, validatePost, PostController.updatePost);

// @route   DELETE /api/posts/:id
// @desc    Delete post
// @access  Private
router.delete('/:id', auth, PostController.deletePost);

module.exports = router;
```

### Advanced Database Features

#### Database Migration System (src/utils/migrate.js)
```javascript
const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

class Migration {
  static async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    try {
      await db.query(query);
      console.log('Migrations table created successfully');
    } catch (error) {
      console.error('Error creating migrations table:', error);
      throw error;
    }
  }

  static async getExecutedMigrations() {
    try {
      const result = await db.query('SELECT name FROM migrations ORDER BY id');
      return result.rows.map(row => row.name);
    } catch (error) {
      console.error('Error fetching executed migrations:', error);
      return [];
    }
  }

  static async executeMigration(migrationName, sql) {
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
      await client.query('COMMIT');
      
      console.log(`Migration ${migrationName} executed successfully`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`Error executing migration ${migrationName}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  static async runMigrations() {
    try {
      await this.createMigrationsTable();
      
      const migrationsDir = path.join(__dirname, '../migrations');
      const migrationFiles = await fs.readdir(migrationsDir);
      const executedMigrations = await this.getExecutedMigrations();
      
      for (const file of migrationFiles.sort()) {
        if (file.endsWith('.sql') && !executedMigrations.includes(file)) {
          const filePath = path.join(migrationsDir, file);
          const sql = await fs.readFile(filePath, 'utf8');
          await this.executeMigration(file, sql);
        }
      }
      
      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    }
  }
}

module.exports = Migration;
```

#### Search and Filtering Utilities (src/utils/queryBuilder.js)
```javascript
class QueryBuilder {
  constructor() {
    this.conditions = [];
    this.params = [];
    this.paramCount = 1;
  }

  addCondition(field, operator, value) {
    if (value !== undefined && value !== null && value !== '') {
      switch (operator) {
        case 'LIKE':
        case 'ILIKE':
          this.conditions.push(`${field} ${operator} ${this.paramCount}`);
          this.params.push(`%${value}%`);
          break;
        case 'IN':
          if (Array.isArray(value) && value.length > 0) {
            const placeholders = value.map(() => `${this.paramCount++}`).join(',');
            this.conditions.push(`${field} IN (${placeholders})`);
            this.params.push(...value);
            this.paramCount--;
          }
          break;
        case 'BETWEEN':
          if (Array.isArray(value) && value.length === 2) {
            this.conditions.push(`${field} BETWEEN ${this.paramCount} AND ${this.paramCount + 1}`);
            this.params.push(value[0], value[1]);
            this.paramCount++;
          }
          break;
        default:
          this.conditions.push(`${field} ${operator} ${this.paramCount}`);
          this.params.push(value);
      }
      this.paramCount++;
    }
    return this;
  }

  addTextSearch(fields, searchTerm) {
    if (searchTerm && fields.length > 0) {
      const searchConditions = fields.map(field => 
        `${field} ILIKE ${this.paramCount}`
      ).join(' OR ');
      
      this.conditions.push(`(${searchConditions})`);
      fields.forEach(() => this.params.push(`%${searchTerm}%`));
      this.paramCount++;
    }
    return this;
  }

  addDateRange(field, startDate, endDate) {
    if (startDate) {
      this.addCondition(field, '>=', startDate);
    }
    if (endDate) {
      this.addCondition(field, '<=', endDate);
    }
    return this;
  }

  build() {
    return {
      whereClause: this.conditions.length > 0 ? `WHERE ${this.conditions.join(' AND ')}` : '',
      params: this.params
    };
  }
}

module.exports = QueryBuilder;
```

### File Upload Support (src/utils/fileUpload.js)
```javascript
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow only specific file types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// File upload controller
class FileUploadController {
  static async uploadImage(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const fileUrl = `/uploads/${req.file.filename}`;

      res.json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          url: fileUrl
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteFile(req, res, next) {
    try {
      const { filename } = req.params;
      const filePath = path.join(__dirname, '../uploads', filename);

      try {
        await fs.unlink(filePath);
        res.json({
          success: true,
          message: 'File deleted successfully'
        });
      } catch (error) {
        if (error.code === 'ENOENT') {
          return res.status(404).json({
            success: false,
            message: 'File not found'
          });
        }
        throw error;
      }
    } catch (error) {
      next(error);
    }
  }
}

module.exports = { upload, FileUploadController };
```

---

## 8. Error Handling & Validation

### Custom Error Classes (src/utils/customErrors.js)
```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError
};
```

### Response Formatter Utility (src/utils/response.js)
```javascript
class ResponseFormatter {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  }

  static error(res, message = 'Error occurred', statusCode = 500, errors = null) {
    const response = {
      success: false,
      message
    };

    if (errors) {
      response.errors = errors;
    }

    if (process.env.NODE_ENV === 'development' && statusCode === 500) {
      response.stack = new Error().stack;
    }

    return res.status(statusCode).json(response);
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.json({
      success: true,
      message,
      data,
      pagination: {
        currentPage: pagination.currentPage,
        totalPages: pagination.totalPages,
        totalCount: pagination.totalCount,
        hasNext: pagination.currentPage < pagination.totalPages,
        hasPrev: pagination.currentPage > 1
      }
    });
  }
}

module.exports = ResponseFormatter;
```

---

## 9. Testing

### Test Setup (tests/setup.js)
```javascript
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.test' });

// Test database configuration
const testDb = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME + '_test',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Setup test database
beforeAll(async () => {
  // Create test tables
  await testDb.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      first_name VARCHAR(50),
      last_name VARCHAR(50),
      avatar_url VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await testDb.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      slug VARCHAR(255) UNIQUE,
      status VARCHAR(20) DEFAULT 'draft',
      featured_image VARCHAR(255),
      tags TEXT[],
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Clean up after each test
afterEach(async () => {
  await testDb.query('DELETE FROM posts');
  await testDb.query('DELETE FROM users');
});

// Close database connection
afterAll(async () => {
  await testDb.end();
});

module.exports = testDb;
```

### Auth Tests (tests/auth.test.js)
```javascript
const request = require('supertest');
const app = require('../src/server');

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(userData.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should not register user with invalid email', async () => {
      const userData = {
        username: 'testuser',
        email: 'invalid-email',
        password: 'Password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should not register user with weak password', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    let testUser;

    beforeEach(async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData);

      testUser = response.body.data.user;
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
    });

    it('should not login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
```

### Post Tests (tests/posts.test.js)
```javascript
const request = require('supertest');
const app = require('../src/server');

describe('Posts', () => {
  let authToken;
  let testUser;

  beforeEach(async () => {
    // Register and login user
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123',
      firstName: 'Test',
      lastName: 'User'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    authToken = registerResponse.body.data.token;
    testUser = registerResponse.body.data.user;
  });

  describe('POST /api/posts', () => {
    it('should create a new post', async () => {
      const postData = {
        title: 'Test Post',
        content: 'This is a test post content',
        status: 'published'
      };

      const response = await request(app)
        .post('/api/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(postData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.post.title).toBe(postData.title);
      expect(response.body.data.post.authorId).toBe(testUser.id);
    });

    it('should not create post without authentication', async () => {
      const postData = {
        title: 'Test Post',
        content: 'This is a test post content'
      };

      const response = await request(app)
        .post('/api/posts')
        .send(postData);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/posts', () => {
    beforeEach(async () => {
      // Create test posts
      const posts = [
        { title: 'Post 1', content: 'Content 1', status: 'published' },
        { title: 'Post 2', content: 'Content 2', status: 'draft' },
        { title: 'Post 3', content: 'Content 3', status: 'published' }
      ];

      for (const post of posts) {
        await request(app)
          .post('/api/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send(post);
      }
    });

    it('should get all posts', async () => {
      const response = await request(app).get('/api/posts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(3);
    });

    it('should filter posts by status', async () => {
      const response = await request(app).get('/api/posts?status=published');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(2);
    });

    it('should paginate posts', async () => {
      const response = await request(app).get('/api/posts?page=1&limit=2');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toHaveLength(2);
      expect(response.body.data.currentPage).toBe(1);
      expect(response.body.data.totalPages).toBe(2);
    });
  });
});
```

---

## 10. Best Practices

### Configuration Management (src/config/config.js)
```javascript
require('dotenv').config();

const config = {
  app: {
    name: process.env.APP_NAME || 'Node.js REST API',
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    pool: {
      min: 2,
      max: 10,
      acquire: 30000,
      idle: 10000
    }
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRE || '7d'
  },

  security: {
    bcryptSaltRounds: 12,
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMaxRequests: 100
  },

  upload: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif
    