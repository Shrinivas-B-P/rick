import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Check for required environment variables
if (!process.env.DB_URI) {
  console.warn("DB_URI environment variable is not set");
}

// Export configuration object
export const config = {
  port: process.env.PORT || 3000,
  mongoUri: `${process.env.DB_URI}/${process.env.DB_NAME || "jarvis"}`,
  corsOrigin: process.env.CORS_ORIGIN || "*",
  jwtSecret: process.env.JWT_SECRET || "your-secret-key",
  jwtExpiration: process.env.JWT_EXPIRATION || "1d",

  // Email configuration
  email: {
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true",
    user: process.env.EMAIL_USER || "",
    password: process.env.EMAIL_PASSWORD || "",
    from: process.env.EMAIL_FROM || "RFQ System <noreply@example.com>",
  },

  // Application URL for email links
  appUrl: process.env.APP_URL || "http://localhost:8080",
  ultronBaseUrl: process.env.ULTRON_BASE_URL || "http://localhost:8080",
};

// Type assertion to ensure all config values are strings
export type Config = typeof config;
