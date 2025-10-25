document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = '';
    try {
        const res = await fetch(apiUrl('/api/auth/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (res.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = 'index.html';
        } else {
            errorDiv.textContent = data.error || 'Error al iniciar sesión';
        }
    } catch (err) {
        errorDiv.textContent = 'Error de conexión con el servidor';
    }
});
