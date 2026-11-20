-- Opsional: server membuat tabel ini otomatis. Cukup jalankan baris CREATE DATABASE.
CREATE DATABASE IF NOT EXISTS libiverse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE libiverse;
CREATE TABLE IF NOT EXISTS users ( id BIGINT PRIMARY KEY, name VARCHAR(150), email VARCHAR(190) UNIQUE, passwordHash VARCHAR(255), role VARCHAR(20), nim VARCHAR(50), phone VARCHAR(50), address TEXT, active TINYINT(1) DEFAULT 1, created VARCHAR(20), extra JSON NULL) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS categories (name VARCHAR(100) PRIMARY KEY, urut INT) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS books ( id BIGINT PRIMARY KEY, title VARCHAR(255), author VARCHAR(255), publisher VARCHAR(255), year INT, isbn VARCHAR(50), cat VARCHAR(100), stock INT DEFAULT 0, img VARCHAR(255), abstract TEXT, synopsis TEXT, extra JSON NULL) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS loans ( id BIGINT PRIMARY KEY, userId BIGINT, bookId BIGINT, days INT, date VARCHAR(20), due VARCHAR(20), status VARCHAR(50), extra JSON NULL, INDEX (userId), INDEX (bookId)) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS reviews ( id BIGINT PRIMARY KEY, userId BIGINT, bookId BIGINT, rating TINYINT, text TEXT, date VARCHAR(20), extra JSON NULL, INDEX (userId), INDEX (bookId)) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS threads ( id BIGINT PRIMARY KEY, userId BIGINT, topic VARCHAR(20), subject VARCHAR(150), bookId BIGINT NULL, status VARCHAR(30), created VARCHAR(30), updated VARCHAR(30), unreadUser TINYINT(1) DEFAULT 0, unreadAdmin TINYINT(1) DEFAULT 0, extra JSON NULL, INDEX (userId)) CHARACTER SET utf8mb4;
CREATE TABLE IF NOT EXISTS messages ( id BIGINT PRIMARY KEY, threadId BIGINT, sender VARCHAR(10), senderId BIGINT, text TEXT, time VARCHAR(30), extra JSON NULL, INDEX (threadId)) CHARACTER SET utf8mb4;
