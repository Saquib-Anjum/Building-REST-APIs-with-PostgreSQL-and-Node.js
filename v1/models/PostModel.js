import db from "../config/database";

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
    const {
      title,
      content,
      authorId,
      slug,
      status = "draft",
      featuredImage,
      tags,
    } = postData;

    const query = `
      INSERT INTO posts (title, content, author_id, slug, status, featured_image, tags)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    try {
      const result = await db.query(query, [
        title,
        content,
        authorId,
        slug,
        status,
        featuredImage,
        tags,
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
          avatarUrl: postData.avatar_url,
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

    const countQuery = "SELECT COUNT(*) FROM posts WHERE author_id = $1";

    try {
      const [posts, count] = await Promise.all([
        db.query(query, [authorId, limit, offset]),
        db.query(countQuery, [authorId]),
      ]);

      return {
        posts: posts.rows.map((post) => new Post(post)),
        totalCount: parseInt(count.rows[0].count),
        currentPage: page,
        totalPages: Math.ceil(parseInt(count.rows[0].count) / limit),
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
      whereConditions.push(
        `(p.title ILIKE $${paramCount} OR p.content ILIKE $${paramCount})`
      );
      queryParams.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters.tags && filters.tags.length > 0) {
      whereConditions.push(`p.tags && $${paramCount}`);
      queryParams.push(filters.tags);
      paramCount++;
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")}`
        : "";

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
        db.query(countQuery, queryParams.slice(0, -2)),
      ]);

      const postsWithAuthors = posts.rows.map((row) => {
        const post = new Post(row);
        post.author = {
          id: row.author_id,
          username: row.username,
          firstName: row.first_name,
          lastName: row.last_name,
          avatarUrl: row.avatar_url,
        };
        return post;
      });

      return {
        posts: postsWithAuthors,
        totalCount: parseInt(count.rows[0].count),
        currentPage: page,
        totalPages: Math.ceil(parseInt(count.rows[0].count) / limit),
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

    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
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
      SET ${fields.join(", ")}
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
    const query = "DELETE FROM posts WHERE id = $1 RETURNING *";

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
      .replace(/[^\w ]+/g, "")
      .replace(/ +/g, "-")
      .replace(/^-+|-+$/g, "");
  }
}

export default Post;
