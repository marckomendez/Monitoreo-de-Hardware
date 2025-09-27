// /middlewares/authMiddleware.js
const jwt = require('jsonwebtoken');

const Roles = {
  ADMIN: 1,
  TECNICO: 2,
  CONSULTA: 3
};

function roleName(rol_id) {
  return ({1:'ADMIN',2:'TECNICO',3:'CONSULTA'})[rol_id] || String(rol_id);
}

exports.requireAuth = (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autorizado: token faltante' });
    }
    const token = h.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) {
      return res.status(401).json({ error: 'No autorizado: token inválido' });
    }
    req.user = {
      id: decoded.id,
      email: decoded.email,
      rol_id: decoded.rol_id,
      rol: roleName(decoded.rol_id)
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'No autorizado: token inválido/expirado' });
  }
};

exports.requireRole = (...allowed) => {
  const allowedNorm = allowed.map(r => (typeof r === 'string' ? r.toUpperCase() : r));
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autorizado' });
    const matches =
      allowedNorm.includes(req.user.rol_id) ||
      allowedNorm.includes(req.user.rol?.toUpperCase?.());
    if (!matches) return res.status(403).json({ error: 'Prohibido: rol insuficiente' });
    next();
  };
};

exports.Roles = Roles;
