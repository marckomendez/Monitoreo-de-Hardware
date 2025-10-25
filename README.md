# Sistema de Monitoreo de Hardware (DIMO)

Sistema web para monitoreo en tiempo real de hardware de servidores con alertas automáticas y generación de reportes.

## 🚀 Demo en Vivo

- **Backend**: https://monitoreo-de-hardware.onrender.com
- **Frontend**: [Por desplegar en Vercel]

## 🛠️ Tecnologías

### Backend
- **Node.js** + **Express.js**
- **Socket.IO** para WebSockets
- **Azure SQL Database**
- **Systeminformation** para monitoreo de hardware
- **JWT** para autenticación
- **bcrypt** para seguridad de contraseñas

### Frontend
- **HTML5** + **CSS3** + **JavaScript**
- **jsPDF** para generación de reportes
- **WebSockets** para actualizaciones en tiempo real

### Infraestructura
- **Backend**: Render.com
- **Base de Datos**: Azure SQL Database
- **Frontend**: Vercel (próximamente)

## 📋 Funcionalidades

- ✅ Monitoreo en tiempo real de CPU, RAM, almacenamiento
- ✅ Sistema de alertas configurable por umbrales
- ✅ Generación automática de reportes PDF
- ✅ Gestión de usuarios y permisos
- ✅ Bitácora de eventos del sistema
- ✅ Dashboard interactivo con gráficos

## 🔧 Configuración Local

### Prerrequisitos
- Node.js 16+
- Acceso a Azure SQL Database

### Instalación
```bash
git clone https://github.com/marckomendez/Monitoreo-de-Hardware.git
cd Monitoreo-de-Hardware
npm install
```

### Variables de Entorno
Crear archivo `.env`:
```env
DB_HOST=tu-servidor.database.windows.net
DB_PORT=1433
DB_NAME=DIMO_DB
DB_USER=tu-usuario
DB_PASS=tu-password
DB_ENCRYPT=true
JWT_SECRET=tu-jwt-secret
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
CAPTURE_ENABLED=true
CAPTURE_EVERY_SEC=60
```

### Ejecutar
```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

## 🏗️ Estructura del Proyecto

```
├── controllers/          # Controladores de la API
├── db.js                # Configuración de base de datos
├── middlewares/         # Middlewares de autenticación
├── public/              # Archivos estáticos del frontend
│   ├── css/            # Estilos
│   └── js/             # JavaScript del cliente
├── routes/              # Rutas de la API
├── server.js            # Servidor principal
├── utils/               # Utilidades y monitores
├── views/               # Páginas HTML
└── vercel.json          # Configuración para Vercel

```

## 📊 API Endpoints

- `GET /healthz` - Estado del servidor
- `POST /api/auth/login` - Autenticación
- `GET /api/hardware` - Información de hardware
- `GET /api/monitor` - Datos de monitoreo
- `GET /api/alertas` - Alertas del sistema
- `GET /api/reportes` - Generación de reportes

## 🔒 Seguridad

- Autenticación JWT
- Encriptación de contraseñas con bcrypt
- CORS configurado para producción
- Conexión segura a Azure SQL (TLS/SSL)

## 🚀 Despliegue

### Backend (Render)
1. Conectar repositorio GitHub
2. Configurar variables de entorno
3. Deploy automático

### Frontend (Vercel)
1. Importar proyecto desde GitHub
2. Deploy automático con configuración `vercel.json`

## 👥 Autor

**Marco Méndez** - [GitHub](https://github.com/marckomendez)

## 📄 Licencia

Este proyecto está bajo la Licencia MIT.