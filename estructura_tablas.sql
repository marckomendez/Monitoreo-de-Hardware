-- Estructura recomendada para la tabla dimo.Usuario
CREATE TABLE dimo.Usuario (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL,
    email NVARCHAR(100) NOT NULL UNIQUE,
    hash NVARCHAR(255) NOT NULL,
    estado NVARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    rol_id INT NOT NULL,
    ultimo_acceso DATETIME NULL
);

-- Estructura recomendada para la tabla dimo.Bitacora
CREATE TABLE dimo.Bitacora (
    id INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT NOT NULL,
    accion NVARCHAR(50) NOT NULL,
    detalle NVARCHAR(255),
    creado_en DATETIME NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (usuario_id) REFERENCES dimo.Usuario(id)
);
