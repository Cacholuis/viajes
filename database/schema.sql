-- Crear base de datos
CREATE DATABASE IF NOT EXISTS viajes;
USE viajes;

-- Eliminar tablas si existen (para limpiar)
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS drivers;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS users;

-- Tabla de usuarios
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    role ENUM('user', 'driver', 'admin') DEFAULT 'user',
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_role (role)
);

-- Tabla de vehículos
CREATE TABLE vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plate VARCHAR(10) UNIQUE NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INT NOT NULL,
    capacity INT NOT NULL,
    traction ENUM('4x2', '4x4') NOT NULL,
    conditions_ok BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    admin_approved BOOLEAN DEFAULT FALSE,
    admin_approved_by INT,
    admin_approved_at TIMESTAMP NULL,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_plate (plate),
    INDEX idx_active_approved (active, admin_approved)
);

-- Tabla de conductores
CREATE TABLE drivers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    vehicle_id INT,
    available BOOLEAN DEFAULT TRUE,
    active BOOLEAN DEFAULT TRUE,
    rating DECIMAL(2,1) DEFAULT 5.0,
    total_trips INT DEFAULT 0,
    last_lat DECIMAL(10,8),
    last_lng DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL,
    INDEX idx_available (available, active),
    INDEX idx_user_id (user_id)
);

-- Tabla de viajes
CREATE TABLE trips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    driver_id INT,
    origin_lat DECIMAL(10,8) NOT NULL,
    origin_lng DECIMAL(11,8) NOT NULL,
    destination_address VARCHAR(500) NOT NULL,
    distance_km DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    status ENUM('requesting', 'searching', 'accepted', 'in_progress', 'completed', 'cancelled', 'no_drivers') DEFAULT 'requesting',
    assigned_at TIMESTAMP NULL,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    review TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id),
    INDEX idx_user_id (user_id),
    INDEX idx_driver_id (driver_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC)
);

-- Insertar vehículos de ejemplo
INSERT INTO vehicles (plate, model, year, capacity, traction, conditions_ok, admin_approved) VALUES
('ABC123', 'Toyota Hilux', 2022, 5, '4x4', 1, 1),
('DEF456', 'Ford Ranger', 2021, 5, '4x4', 1, 1),
('GHI789', 'Chevrolet S10', 2023, 5, '4x4', 1, 0);

-- Insertar usuario de prueba
INSERT INTO users (email, password_hash, full_name, phone, role) VALUES
('usuario@test.com', '$2a$10$YourHashedPasswordHere', 'Usuario Test', '123456789', 'user');

-- Mostrar tablas creadas
SHOW TABLES;