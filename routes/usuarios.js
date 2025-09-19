const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');


router.get('/', usuariosController.listarUsuarios);
router.post('/', usuariosController.crearUsuario);
router.put('/:id', usuariosController.editarUsuario);
router.patch('/:id/estado', usuariosController.cambiarEstadoUsuario);
router.patch('/:id/resetpass', usuariosController.resetearPassword);
router.delete('/:id', usuariosController.eliminarUsuario);

module.exports = router;
