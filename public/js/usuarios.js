// Estructura inicial para gestión de usuarios
// Aquí se implementarán las funciones para listar, crear, editar, activar/inactivar y resetear contraseña

document.addEventListener('DOMContentLoaded', () => {
    // Aquí irá la lógica para cargar usuarios y manejar eventos
    cargarUsuarios();
    document.getElementById('btnCrearUsuario').addEventListener('click', mostrarFormularioCrear);
    mostrarListaUsuarios();
});

function cargarUsuarios() {
    fetch('/api/usuarios')
        .then(res => res.json())
        .then(usuarios => {
            const tbody = document.querySelector('#tablaUsuarios tbody');
            tbody.innerHTML = '';
            usuarios.forEach(u => {
                tbody.innerHTML += `<tr>
                    <td>${u.nombre}</td>
                    <td>${u.email}</td>
                    <td>${u.rol_id == 1 ? 'Admin' : 'Consulta'}</td>
                    <td>${u.estado}</td>
                    <td></td>
                    <td>
                        <button onclick="editarUsuario(${u.id})">Editar</button>
                        <button onclick="cambiarEstadoUsuario(${u.id}, '${u.estado === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'}')">${u.estado === 'ACTIVO' ? 'Inactivar' : 'Activar'}</button>
                        <button onclick="resetearPassword(${u.id})">ResetPass</button>
                        <button onclick="eliminarUsuario(${u.id})" style="color:red;">Eliminar</button>
                    </td>
                </tr>`;
            });
function eliminarUsuario(id) {
    if (confirm('¿Estás seguro de eliminar este usuario?')) {
        fetch(`/api/usuarios/${id}`, {
            method: 'DELETE'
        })
        .then(res => res.json())
        .then(() => {
            cargarUsuarios();
            mostrarListaUsuarios();
        });
    }
}
        });
}

function mostrarFormularioCrear() {
    document.getElementById('tituloModalUsuario').innerText = 'Crear Usuario';
    document.getElementById('usuarioId').value = '';
    document.getElementById('nombreUsuario').value = '';
    document.getElementById('emailUsuario').value = '';
    document.getElementById('rolUsuario').value = '2';
    document.getElementById('passwordUsuario').value = '';
    document.getElementById('labelPassword').style.display = '';
    document.getElementById('passwordUsuario').style.display = '';
    document.getElementById('modalUsuario').style.display = 'flex';
}

function cerrarModalUsuario() {
    document.getElementById('modalUsuario').style.display = 'none';
}

document.getElementById('formUsuario').addEventListener('submit', function(e) {
    e.preventDefault();
    const id = document.getElementById('usuarioId').value;
    const nombre = document.getElementById('nombreUsuario').value;
    const email = document.getElementById('emailUsuario').value;
    const rol_id = document.getElementById('rolUsuario').value;
    const password = document.getElementById('passwordUsuario').value;
    if (id) {
        // Editar usuario
        fetch(`/api/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, rol_id })
        }).then(() => {
            cerrarModalUsuario();
            cargarUsuarios();
            mostrarListaUsuarios();
        });
    } else {
        // Crear usuario
        fetch('/api/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, rol_id, password })
        }).then(() => {
            cerrarModalUsuario();
            cargarUsuarios();
            mostrarListaUsuarios();
        });
    }
});

function editarUsuario(id) {
    fetch(`/api/usuarios`)
        .then(res => res.json())
        .then(usuarios => {
            const u = usuarios.find(u => u.id === id);
            if (u) {
                document.getElementById('tituloModalUsuario').innerText = 'Editar Usuario';
                document.getElementById('usuarioId').value = u.id;
                document.getElementById('nombreUsuario').value = u.nombre;
                document.getElementById('emailUsuario').value = u.email;
                document.getElementById('rolUsuario').value = u.rol_id;
                document.getElementById('labelPassword').style.display = 'none';
                document.getElementById('passwordUsuario').style.display = 'none';
                document.getElementById('modalUsuario').style.display = 'flex';
            }
        });
}

function cambiarEstadoUsuario(id, nuevoEstado) {
    fetch(`/api/usuarios/${id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado })
    }).then(() => {
        cargarUsuarios();
        mostrarListaUsuarios();
    });
}

function resetearPassword(id) {
    const nueva = prompt('Nueva contraseña para el usuario:');
    if (nueva) {
        fetch(`/api/usuarios/${id}/resetpass`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: nueva })
        }).then(() => alert('Contraseña reseteada.'));
    }
}
