-- Pabbly Flow Manager — initial schema (MySQL 8 / MariaDB 10.5+ / TiDB compatible)

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'viewer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  token_version INT NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flows (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  folder VARCHAR(120) NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'active',
  pabbly_url VARCHAR(1000) NULL,
  webhook_url VARCHAR(1000) NULL,
  trigger_app VARCHAR(120) NULL,
  description TEXT NULL,
  owner VARCHAR(120) NULL,
  tags VARCHAR(500) NULL,
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  updated_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_flows_name (name),
  KEY idx_flows_folder (folder),
  KEY idx_flows_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS steps (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flow_id INT UNSIGNED NOT NULL,
  parent_id INT UNSIGNED NULL,
  position INT NOT NULL DEFAULT 0,
  kind VARCHAR(20) NOT NULL,
  title VARCHAR(255) NULL,
  app VARCHAR(120) NULL,
  event VARCHAR(255) NULL,
  condition_text TEXT NULL,
  description TEXT NULL,
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_steps_flow (flow_id),
  KEY idx_steps_parent (parent_id),
  KEY idx_steps_app (app),
  CONSTRAINT fk_steps_flow FOREIGN KEY (flow_id) REFERENCES flows (id) ON DELETE CASCADE,
  CONSTRAINT fk_steps_parent FOREIGN KEY (parent_id) REFERENCES steps (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  user_name VARCHAR(120) NULL,
  action VARCHAR(20) NOT NULL,
  entity VARCHAR(20) NOT NULL,
  entity_id INT UNSIGNED NULL,
  flow_id INT UNSIGNED NULL,
  summary VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activity_flow (flow_id),
  KEY idx_activity_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
