CREATE DATABASE IF NOT EXISTS tosm_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tosm_db;

CREATE TABLE IF NOT EXISTS users (
  id           INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  username     VARCHAR(50)    NOT NULL UNIQUE,
  email        VARCHAR(255)   NOT NULL UNIQUE,
  password_hash VARCHAR(255)  NOT NULL,
  role         ENUM('user', 'admin') DEFAULT 'user',
  last_login   DATETIME       NULL,
  created_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email)
) ENGINE=InnoDB;
