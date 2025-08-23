const validateRegistration = (req, res, next) => {
  const { username, email, password, firstName, lastName } = req.body;
  const errors = [];

  // Username validation
  if (!username) {
    errors.push("Username is required");
  } else if (username.length < 3 || username.length > 50) {
    errors.push("Username must be between 3 and 50 characters");
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push("Username can only contain letters, numbers, and underscores");
  }

  // Email validation
  if (!email) {
    errors.push("Email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Please provide a valid email address");
  }

  // Password validation
  if (!password) {
    errors.push("Password is required");
  } else if (password.length < 6) {
    errors.push("Password must be at least 6 characters long");
  } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    errors.push(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    );
  }

  // Name validation
  if (firstName && firstName.length > 50) {
    errors.push("First name cannot exceed 50 characters");
  }
  if (lastName && lastName.length > 50) {
    errors.push("Last name cannot exceed 50 characters");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) {
    errors.push("Email is required");
  }

  if (!password) {
    errors.push("Password is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

const validatePost = (req, res, next) => {
  const { title, content } = req.body;
  const errors = [];

  if (!title) {
    errors.push("Title is required");
  } else if (title.length > 255) {
    errors.push("Title cannot exceed 255 characters");
  }

  if (!content) {
    errors.push("Content is required");
  }

  if (
    req.body.status &&
    !["draft", "published", "archived"].includes(req.body.status)
  ) {
    errors.push("Status must be one of: draft, published, archived");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
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
      message: "Page must be a positive integer",
    });
  }

  if (limit && (isNaN(limit) || limit < 1 || limit > 100)) {
    return res.status(400).json({
      success: false,
      message: "Limit must be between 1 and 100",
    });
  }

  next();
};

export {
  validateRegistration,
  validateLogin,
  validatePost,
  validatePagination,
};
