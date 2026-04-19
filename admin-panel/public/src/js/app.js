const API_URL = 'http://localhost:3000/api';
let authToken = localStorage.getItem('token');
let currentUser = null;

// Elementos
const tabs = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const loginModal = document.getElementById('loginModal');
const appContent = document.getElementById('appContent');
const logoutBtn = document.getElementById('logoutBtn');

// Mostrar/Ocultar
function showLogin() {
    appContent.style.display = 'none';
    loginModal.style.display = 'flex';
}

function showApp() {
    appContent.style.display = 'flex';
    loginModal.style.display = 'none';
}

// Verificar si es administrador
function isAdmin() {
    return currentUser && currentUser.role === 'admin';
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
            dashboard: 'Panel',
            vehicles: 'Vehículos',
            register: 'Registrar Vehículo',
            encargados: 'Gestión de Encargados',
            movimientos: 'Registro de Movimientos',
            limpieza: 'Limpieza de Datos'
        };
        document.getElementById('pageTitle').textContent = titles[tabId] || 'Viajes';
        
        if (tabId === 'vehicles') loadVehicles();
        if (tabId === 'dashboard') loadDashboard();
        if (tabId === 'encargados' && isAdmin()) loadEncargados();
        if (tabId === 'movimientos' && isAdmin()) loadMovimientos();
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
        
        if (data.success) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            showApp();
            document.getElementById('userName').textContent = currentUser.fullName;
            document.getElementById('userRole').textContent = currentUser.role === 'admin' ? '👑 Administrador' : '👤 Encargado';
            document.getElementById('loginStatus').className = 'login-status connected';
            document.getElementById('loginStatus').textContent = '✅ Conectado';
            loadDashboard();
            loadVehicles();
            
            // Mostrar/ocultar botones de admin según rol
            const adminButtons = document.querySelectorAll('[data-tab="encargados"], [data-tab="movimientos"], [data-tab="limpieza"]');
            adminButtons.forEach(btn => {
                btn.style.display = currentUser.role === 'admin' ? 'block' : 'none';
            });
        } else {
            alert('Error: ' + data.message);
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

// Registrar vehículo
document.getElementById('vehicleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const vehicleData = {
        plate: document.getElementById('plate').value.toUpperCase(),
        model: document.getElementById('model').value,
        year: parseInt(document.getElementById('year').value),
        capacity: parseInt(document.getElementById('capacity').value),
        traction: document.getElementById('traction').value,
        conditions_ok: document.getElementById('conditionsOk').checked
    };
    
    try {
        const response = await fetch(`${API_URL}/vehicles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(vehicleData)
        });
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Vehículo registrado correctamente');
            document.getElementById('vehicleForm').reset();
            loadVehicles();
            loadDashboard();
            document.querySelector('[data-tab="vehicles"]').click();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// Cargar vehículos
async function loadVehicles() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_URL}/vehicles`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            document.getElementById('vehiclesList').innerHTML = data.data.map(v => `
                <tr>
                    <td>${v.id}</td>
                    <td>${v.plate}</td>
                    <td>${v.model} (${v.year})</td>
                    <td>${v.year}</td>
                    <td>${v.traction}</td>
                    <td>${v.capacity}</td>
                    <td>${v.admin_approved ? '<span class="badge-approved">Aprobado</span>' : '<span class="badge-pending">Pendiente</span>'}</td>
                    <td>${v.encargado_nombre || '-'}</td>
                    <td>
                        ${!v.admin_approved ? `<button class="btn btn-approve" onclick="approveVehicle(${v.id})">✓ Aprobar</button>` : ''}
                        <button class="btn btn-edit" onclick='openEditModal(${v.id}, "${v.plate}", "${v.model}", ${v.year}, ${v.capacity}, "${v.traction}")'>✎ Editar</button>
                        <button class="btn btn-delete" onclick="deleteVehicle(${v.id})">🗑 Eliminar</button>
                    </td>
                </tr>
            `).join('');
        } else {
            document.getElementById('vehiclesList').innerHTML = '<tr><td colspan="9" style="text-align:center">No hay vehículos registrados</td></tr>';
        }
        
        document.getElementById('searchVehicles').oninput = (e) => {
            const search = e.target.value.toLowerCase();
            document.querySelectorAll('#vehiclesList tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
            });
        };
    } catch (error) {
        console.error('Error:', error);
    }
}

// Cargar dashboard
async function loadDashboard() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_URL}/vehicles`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        const vehicles = data.data || [];
        const pending = vehicles.filter(v => !v.admin_approved).length;
        const approved = vehicles.filter(v => v.admin_approved).length;
        
        document.getElementById('totalCount').textContent = vehicles.length;
        document.getElementById('approvedCount').textContent = approved;
        document.getElementById('pendingCount').textContent = pending;
        
        // Cargar encargados solo si es admin
        if (isAdmin()) {
            const encResponse = await fetch(`${API_URL}/admin/encargados`, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            });
            const encData = await encResponse.json();
            document.getElementById('totalEncargados').textContent = encData.data?.length || 0;
        } else {
            document.getElementById('totalEncargados').textContent = '-';
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// Aprobar vehículo
window.approveVehicle = async (id) => {
    if (!confirm('¿Aprobar este vehículo?')) return;
    try {
        const response = await fetch(`${API_URL}/vehicles/${id}/approve`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            alert('✅ Vehículo aprobado');
            loadVehicles();
            loadDashboard();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Eliminar vehículo
window.deleteVehicle = async (id) => {
    if (!confirm('¿Eliminar este vehículo?')) return;
    try {
        const response = await fetch(`${API_URL}/vehicles/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            alert('✅ Vehículo eliminado');
            loadVehicles();
            loadDashboard();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Editar vehículo
window.openEditModal = (id, plate, model, year, capacity, traction) => {
    document.getElementById('editId').value = id;
    document.getElementById('editPlate').value = plate;
    document.getElementById('editModel').value = model;
    document.getElementById('editYear').value = year;
    document.getElementById('editCapacity').value = capacity;
    document.getElementById('editTraction').value = traction;
    document.getElementById('editModal').style.display = 'flex';
};

window.closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
};

document.getElementById('editForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const vehicleData = {
        plate: document.getElementById('editPlate').value.toUpperCase(),
        model: document.getElementById('editModel').value,
        year: parseInt(document.getElementById('editYear').value),
        capacity: parseInt(document.getElementById('editCapacity').value),
        traction: document.getElementById('editTraction').value
    };
    
    try {
        const response = await fetch(`${API_URL}/vehicles/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify(vehicleData)
        });
        const data = await response.json();
        if (data.success) {
            alert('✅ Vehículo actualizado');
            closeEditModal();
            loadVehicles();
            loadDashboard();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
});

// ============ FUNCIONES DE ADMINISTRADOR ============

// Cargar encargados
async function loadEncargados() {
    if (!isAdmin()) return;
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
                    <td><span class="role-badge role-encargado">Encargado</span></td>
                    <td>${e.vehiculos_count || 0}</td>
                    <td>
                        <button class="btn btn-edit" onclick="editEncargado(${e.id})">✎</button>
                        <button class="btn btn-delete" onclick="deleteEncargado(${e.id})">🗑</button>
                    </td>
                </tr>
            `).join('');
        } else {
            document.getElementById('encargadosList').innerHTML = '<tr><td colspan="8" style="text-align:center">No hay encargados</td></tr>';
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

// Cargar movimientos
async function loadMovimientos() {
    if (!isAdmin()) return;
    try {
        const response = await fetch(`${API_URL}/admin/movimientos`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            document.getElementById('movimientosList').innerHTML = data.data.map(m => `
                <tr>
                    <td>${new Date(m.created_at).toLocaleString()}</td>
                    <td>${m.usuario_nombre}</td>
                    <td>${m.accion}</td>
                    <td>${m.tabla_afectada ? m.tabla_afectada + ' #' + m.registro_id : '-'}</td>
                    <td>${m.ip_address || '-'}</td>
                </tr>
            `).join('');
        } else {
            document.getElementById('movimientosList').innerHTML = '<tr><td colspan="5" style="text-align:center">No hay movimientos</td></tr>';
        }
        
        document.getElementById('searchMovimientos').oninput = (e) => {
            const search = e.target.value.toLowerCase();
            document.querySelectorAll('#movimientosList tr').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(search) ? '' : 'none';
            });
        };
    } catch (error) {
        console.error('Error:', error);
    }
}

// Abrir modal encargado
function openEncargadoModal(encargado = null) {
    if (!isAdmin()) return;
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
    if (!isAdmin()) return;
    
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
            loadDashboard();
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
    if (!confirm('¿Eliminar este encargado? También se eliminarán sus vehículos asignados.')) return;
    try {
        const response = await fetch(`${API_URL}/admin/encargados/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        if (data.success) {
            alert('Encargado eliminado');
            loadEncargados();
            loadDashboard();
        } else {
            alert('Error: ' + data.message);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Guardar configuración
window.guardarConfiguracion = async () => {
    if (!isAdmin()) return;
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

// Limpiar movimientos viejos
window.limpiarMovimientosViejos = async () => {
    if (!isAdmin()) return;
    if (!confirm('¿Eliminar movimientos antiguos según la configuración?')) return;
    try {
        const response = await fetch(`${API_URL}/admin/limpiar-movimientos`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        alert(data.message);
        if (data.success) loadMovimientos();
    } catch (error) {
        alert('Error: ' + error.message);
    }
};

// Limpiar viajes viejos
window.limpiarViajesViejos = async () => {
    if (!isAdmin()) return;
    if (!confirm('¿Eliminar viajes completados antiguos? Esta acción no se puede deshacer.')) return;
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

// Verificar autenticación
async function checkAuth() {
    if (!authToken) {
        showLogin();
        return;
    }
    try {
        const response = await fetch(`${API_URL}/vehicles`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 401) {
            localStorage.removeItem('token');
            showLogin();
        } else {
            showApp();
            document.getElementById('loginStatus').className = 'login-status connected';
            document.getElementById('loginStatus').textContent = '✅ Conectado';
            document.getElementById('userName').textContent = 'Administrador';
            document.getElementById('userRole').textContent = '👑 Administrador';
            currentUser = { role: 'admin', fullName: 'Administrador' };
            loadDashboard();
            loadVehicles();
        }
    } catch (error) {
        showLogin();
    }
}

checkAuth();