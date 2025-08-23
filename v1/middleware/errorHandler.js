const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error("Error:", err);

  // PostgreSQL errors
  if (err.code) {
    switch (err.code) {
      case "23505": // Unique violation
        const field = err.constraint?.includes("email") ? "Email" : "Username";
        error.message = `${field} already exists`;
        error.statusCode = 400;
        break;
      case "23503": // Foreign key violation
        error.message = "Referenced record not found";
        error.statusCode = 400;
        break;
      case "23502": // Not null violation
        error.message = "Required field is missing";
        error.statusCode = 400;
        break;
      default:
        error.message = "Database error";
        error.statusCode = 500;
    }
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error.message = "Invalid token";
    error.statusCode = 401;
  }

  if (err.name === "TokenExpiredError") {
    error.message = "Token expired";
    error.statusCode = 401;
  }

  // Validation errors
  if (err.name === "ValidationError") {
    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
    error.message = message;
    error.statusCode = 400;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
