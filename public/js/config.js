// config.js - Configuración de URLs para el frontend
window.APP_CONFIG = {
  // URL del backend API
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000'  // Desarrollo local
    : 'https://monitoreo-de-hardware.onrender.com', // Producción
  
  // URL del WebSocket
  WS_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'  // Desarrollo local
    : 'https://monitoreo-de-hardware.onrender.com', // Producción
  
  // Configuración de la aplicación
  APP_NAME: 'Sistema de Monitoreo de Hardware',
  VERSION: '1.0.0'
};

// Función helper para construir URLs de API
window.apiUrl = function(endpoint) {
  return window.APP_CONFIG.API_BASE_URL + endpoint;
};

// Función helper para construir URL de WebSocket
window.wsUrl = function() {
  return window.APP_CONFIG.WS_URL;
};

console.log('🔧 Configuración cargada:', window.APP_CONFIG);