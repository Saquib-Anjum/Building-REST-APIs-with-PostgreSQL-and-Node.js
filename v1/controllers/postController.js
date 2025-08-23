import Post from "../models/PostModel.js";

class PostController {
  // Create new post
  static async createPost(req, res, next) {
    try {
      const { title, content, status, featuredImage, tags } = req.body;
      const authorId = req.user.id;

      // Generate slug from title
      const slug = Post.generateSlug(title) + "-" + Date.now();

      const post = await Post.create({
        title,
        content,
        authorId,
        slug,
        status: status || "draft",
        featuredImage,
        tags,
      });

      res.status(201).json({
        success: true,
        message: "Post created successfully",
        data: { post },
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
        tags: req.query.tags ? req.query.tags.split(",") : undefined,
      };

      const result = await Post.findAll(filters, page, limit);

      res.json({
        success: true,
        data: result,
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
          message: "Post not found",
        });
      }

      res.json({
        success: true,
        data: { post },
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
          message: "Post not found",
        });
      }

      // Check if user owns the post
      if (post.authorId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own posts",
        });
      }

      const updateData = {};
      if (title) {
        updateData.title = title;
        updateData.slug = Post.generateSlug(title) + "-" + Date.now();
      }
      if (content) updateData.content = content;
      if (status) updateData.status = status;
      if (featuredImage) updateData.featuredImage = featuredImage;
      if (tags) updateData.tags = tags;

      const updatedPost = await post.update(updateData);

      res.json({
        success: true,
        message: "Post updated successfully",
        data: { post: updatedPost },
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
          message: "Post not found",
        });
      }

      // Check if user owns the post
      if (post.authorId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own posts",
        });
      }

      await post.delete();

      res.json({
        success: true,
        message: "Post deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PostController;
