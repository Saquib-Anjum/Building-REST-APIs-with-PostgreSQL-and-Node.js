import db from "../config/database.js";
import bcrypt from "bcryptjs";
import Post from "./PostModel.js";
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
        lastName,
      ]);
      return new User(result.rows[0]);
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    const query = "SELECT * FROM users WHERE id = $1 AND is_active = true";

    try {
      const result = await db.query(query, [id]);
      return result.rows.length ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const query = "SELECT * FROM users WHERE email = $1 AND is_active = true";

    try {
      const result = await db.query(query, [email]);
      return result.rows.length ? new User(result.rows[0]) : null;
    } catch (error) {
      throw error;
    }
  }

  // Find user by username
  static async findByUsername(username) {
    const query =
      "SELECT * FROM users WHERE username = $1 AND is_active = true";

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

    const countQuery = "SELECT COUNT(*) FROM users WHERE is_active = true";

    try {
      const [users, count] = await Promise.all([
        db.query(query, [limit, offset]),
        db.query(countQuery),
      ]);

      return {
        users: users.rows.map((user) => new User(user)),
        totalCount: parseInt(count.rows[0].count),
        currentPage: page,
        totalPages: Math.ceil(parseInt(count.rows[0].count) / limit),
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
    Object.keys(updateData).forEach((key) => {
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
      SET ${fields.join(", ")}
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
    return Post.findByAuthor(this.id, page, limit);
  }

  // Convert to JSON (exclude password)
  toJSON() {
    const { password, ...userWithoutPassword } = this;
    return userWithoutPassword;
  }
}
export default User;
