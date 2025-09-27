// /routes/usuarios.js
const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const { requireAuth, requireRole, Roles } = require('../middlewares/authMiddleware');

// Todas las rutas de usuarios requieren autenticación y rol ADMIN
router.use(requireAuth);
router.use(requireRole(Roles.ADMIN, 'ADMIN'));

// CRUD de usuarios
router.get('/', usuariosController.listarUsuarios);
router.post('/', usuariosController.crearUsuario);
router.put('/:id', usuariosController.editarUsuario);
router.patch('/:id/estado', usuariosController.cambiarEstadoUsuario);
router.patch('/:id/resetpass', usuariosController.resetearPassword);
router.delete('/:id', usuariosController.eliminarUsuario);

module.exports = router;
