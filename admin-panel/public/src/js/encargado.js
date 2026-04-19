const API_URL = 'http://localhost:3000/api';
let authToken = localStorage.getItem('token');
let currentUser = null;

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
            dashboard: 'Mi Panel',
            vehicles: 'Mis Vehículos',
            register: 'Registrar Vehículo',
            movimientos: 'Mis Movimientos'
        };
        document.getElementById('pageTitle').textContent = titles[tabId];
        
        if (tabId === 'vehicles') loadVehicles();
        if (tabId === 'dashboard') loadDashboard();
        if (tabId === 'movimientos') loadMovimientos();
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
        
        if (data.success && data.user.role === 'encargado') {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('token', authToken);
            showApp();
            document.getElementById('userName').textContent = currentUser.fullName;
            document.getElementById('userZone').textContent = `📍 ${currentUser.zona_asignada || 'Sin zona'}`;
            document.getElementById('loginStatus').className = 'login-status connected';
            document.getElementById('loginStatus').textContent = '✅ Conectado';
            loadDashboard();
            loadVehicles();
        } else {
            alert('Acceso denegado. Solo encargados.');
        }
    } catch (error) {
        alert('Error de conexión: ' + error.message);
    }
});

logoutBtn.addEventListener('click', () => {
    authToken = null;
    currentUser = null;
    localStorage.removeItem('token');
    showLogin();
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
            alert('✅ Vehículo registrado');
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

// Cargar vehículos del encargado
async function loadVehicles() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_URL}/encargado/vehiculos`, {
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
                    <td>
                        <button class="btn btn-edit" onclick='openEditModal(${v.id}, "${v.plate}", "${v.model}", ${v.year}, ${v.capacity}, "${v.traction}")'>✎ Editar</button>
                        <button class="btn btn-delete" onclick="deleteVehicle(${v.id})">🗑 Eliminar</button>
                    </td>
                </tr>
            `).join('');
        } else {
            document.getElementById('vehiclesList').innerHTML = '<tr><td colspan="8" style="text-align:center">No hay vehículos registrados</td><td colspan="1"></td><td colspan="1"></td><td colspan="1"></td><td colspan="1"></td><td colspan="1"></td><td colspan="1"></td><td colspan="1"></td></tr>';
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

// Dashboard
async function loadDashboard() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_URL}/encargado/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        document.getElementById('totalCount').textContent = data.total || 0;
        document.getElementById('approvedCount').textContent = data.aprobados || 0;
        document.getElementById('pendingCount').textContent = data.pendientes || 0;
    } catch (error) {
        console.error('Error:', error);
    }
}

// Movimientos
async function loadMovimientos() {
    if (!authToken) return;
    try {
        const response = await fetch(`${API_URL}/encargado/movimientos`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
            document.getElementById('movimientosList').innerHTML = data.data.map(m => `
                <tr>
                    <td>${new Date(m.created_at).toLocaleString()}</td>
                    <td>${m.accion}</td>
                    <td>${m.tabla_afectada ? m.tabla_afectada + ' #' + m.registro_id : '-'}</td>
                </tr>
            `).join('');
        } else {
            document.getElementById('movimientosList').innerHTML = '<tr><td colspan="3" style="text-align:center">No hay movimientos</td></tr>';
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

// Verificar autenticación
async function checkAuth() {
    if (!authToken) {
        showLogin();
        return;
    }
    try {
        const response = await fetch(`${API_URL}/encargado/dashboard`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.status === 401) {
            localStorage.removeItem('token');
            showLogin();
        } else {
            showApp();
            document.getElementById('loginStatus').className = 'login-status connected';
            document.getElementById('loginStatus').textContent = '✅ Conectado';
            document.getElementById('userName').textContent = 'Encargado';
            loadDashboard();
            loadVehicles();
        }
    } catch (error) {
        showLogin();
    }
}

checkAuth();