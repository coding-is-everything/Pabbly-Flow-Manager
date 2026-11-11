-- Switch from password login to email one-time codes (OTP)

-- Passwords are no longer used: allow NULL and remove the stored hashes.
ALTER TABLE users MODIFY password_hash VARCHAR(100) NULL;
UPDATE users SET password_hash = NULL;

-- One row per code sent. Only a hash of the code is stored.
CREATE TABLE IF NOT EXISTS login_otps (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  consumed_at DATETIME NULL,
  ip VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_login_otps_user (user_id, id),
  KEY idx_login_otps_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
