const API_URL = 'http://localhost:3000/api';
let authToken = null;  // Forzado a null
let currentUser = null;

// LIMPIAR TOKEN AL INICIAR (para que siempre pida login)
localStorage.removeItem('token');

// Elementos
const tabs = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const loginModal = document.getElementById('loginModal');
const appContent = document.getElementById('appContent');
const logoutBtn = document.getElementById('logoutBtn');

function showLogin() {
    appContent.style.display = 'none';
    loginModal.style.display = 'flex';
}

function showApp() {
    appContent.style.display = 'flex';
    loginModal.style.display = 'none';
}

// Cambiar tabs
tabs.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        tabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === tabId) content.classList.add('active');
        });
        
        const titles = {
            encargados: 'Gestión de Encargados',
            limpieza: 'Limpieza de Datos'
        };
        document.getElementById('pageTitle').textContent = titles[tabId];
        
        if (tabId === 'encargados') loadEncargados();
    });
});

// Login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (data.success && data.user.role === 'admin') {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            showApp();
            document.getElementById('userName').textContent = currentUser.fullName;
            document.getElementById('userRole').textContent = '👑 Administrador';
            document.getElementById('loginStatus').className = 'login-status connected';
            document.getElementById('loginStatus').textContent = '✅ Conectado';
            loadEncargados();
        } else {
            alert('Acceso denegado. Solo administradores.');
        }
    } catch (error) {
        alert('Error de conexión: ' + error.message);
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    showLogin();
    document.getElementById('userName').textContent = 'No conectado';
    document.getElementById('userRole').textContent = '';
    document.getElementById('loginStatus').className = 'login-status disconnected';
    document.getElementById('loginStatus').textContent = '❌ Desconectado';
});

// Cargar encargados
async function loadEncargados() {
    try {
        const response = await fetch(`${API_URL}/admin/encargados`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            document.getElementById('encargadosList').innerHTML = data.data.map(e => `
                <tr>
                    <td>${e.id}</td>
                    <td>${e.full_name}</td>
                    <td>${e.email}</td>
                    <td>${e.phone}</td>
                    <td>${e.zona_asignada || '-'}</td>
                    <td>${e.vehiculos_count || 0}</td>
                    <td>
                        <button class="btn btn-edit" onclick="editEncargado(${e.id})">✎ Editar</button>
                        <button class="btn btn-delete" onclick="deleteEncargado(${e.id})">🗑 Eliminar</button>
                    </td>
                </tr>
            `).join('');
        } else {
            document.getElementById('encargadosList').innerHTML = '<tr><td colspan="7" style="text-align:center">No hay encargados registrados</td></tr>';
        }
        
        document.getElementById('searchEncargados').oninput = (e) => {
            const search = e.target.value.toLowerCase();
            document.querySelectorAll('#encargadosList tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
            });
        };
    } catch (error) {
        console.error('Error:', error);
    }
}

// Abrir modal encargado
function openEncargadoModal(encargado = null) {
    document.getElementById('modalTitle').textContent = encargado ? 'Editar Encargado' : 'Nuevo Encargado';
    if (encargado) {
        document.getElementById('editEncargadoId').value = encargado.id;
        document.getElementById('encargadoNombre').value = encargado.full_name;
        document.getElementById('encargadoEmail').value = encargado.email;
        document.getElementById('encargadoPhone').value = encargado.phone;
        document.getElementById('encargadoZona').value = encargado.zona_asignada || '';
        document.getElementById('encargadoPassword').placeholder = 'Dejar en blanco para mantener';
        document.getElementById('encargadoPassword').value = '';
    } else {
        document.getElementById('encargadoForm').reset();
        document.getElementById('editEncargadoId').value = '';
        document.getElementById('encargadoPassword').placeholder = 'Nueva contraseña';
    }
    document.getElementById('encargadoModal').style.display = 'flex';
}

function closeEncargadoModal() {
    document.getElementById('encargadoModal').style.display = 'none';
}

// Guardar encargado
document.getElementById('encargadoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('editEncargadoId').value;
    const data = {
        full_name: document.getElementById('encargadoNombre').value,
        email: document.getElementById('encargadoEmail').value,
        phone: document.getElementById('encargadoPhone').value,
        zona_asignada: document.getElementById('encargadoZona').value,
        role: 'encargado'
    };
    
    const password = document.getElementById('encargadoPassword').value;
    if (password) data.password = password;
    
    const url = id ? `${API_URL}/admin/encargados/${id}` : `${API_URL}/admin/encargados`;
    const method = id ? 'PUT' : 'POST';
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if (result.success) {
            alert(id ? 'Encargado actualizado' : 'Encargado creado');
            closeEncargadoModal();
            loadEncargados();
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Editar encargado
window.editEncargado = async (id) => {
    try {
        const response = await fetch(`${API_URL}/admin/encargados/${id}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.data) openEncargadoModal(data.data);
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Eliminar encargado
window.deleteEncargado = async (id) => {
    if (!confirm('¿Eliminar este encargado? También se eliminarán sus vehículos.')) return;
    try {
        const response = await fetch(`${API_URL}/admin/encargados/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            alert('Encargado eliminado');
            loadEncargados();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Guardar configuración
window.guardarConfiguracion = async () => {
    const config = {
        dias_movimientos: document.getElementById('diasMovimientos').value,
        dias_viajes: document.getElementById('diasViajes').value
    };
    try {
        const response = await fetch(`${API_URL}/admin/configuracion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(config)
        });
        const data = await response.json();
        alert(data.message || 'Configuración guardada');
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Limpiar movimientos
window.limpiarMovimientosViejos = async () => {
    if (!confirm('¿Eliminar movimientos antiguos?')) return;
    try {
        const response = await fetch(`${API_URL}/admin/limpiar-movimientos`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        alert(data.message);
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Limpiar viajes
window.limpiarViajesViejos = async () => {
    if (!confirm('¿Eliminar viajes completados antiguos?')) return;
    try {
        const response = await fetch(`${API_URL}/admin/limpiar-viajes`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        alert(data.message);
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Iniciar mostrando el login directamente
showLogin();