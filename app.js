// ==========================================
// 1. CONFIGURACIÓN SUPABASE
// ==========================================
const SUPABASE_URL = 'https://rblhjdwpznpwjdkeukxk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_TngSMyX8JcRPAh9Puenqmg_Egq50KV3';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 2. LÓGICA DE AUTENTICACIÓN
// ==========================================
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');

async function checkAuth() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            loginScreen.style.display = 'none';
            appScreen.style.display = 'block';
            document.getElementById('user-email-display').textContent = session.user.email;
            fetchTasks();
        } else {
            loginScreen.style.display = 'flex';
            appScreen.style.display = 'none';
        }
    } catch(e) {
        console.error('Auth error:', e);
        loginScreen.style.display = 'flex';
        appScreen.style.display = 'none';
    }
}

// Loguearse
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('btn-login');
    const errorMsg = document.getElementById('login-error');

    btn.textContent = 'Cargando...';
    btn.disabled = true;

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
        errorMsg.style.display = 'block';
        errorMsg.textContent = "Error: " + error.message;
        btn.textContent = 'Ingresar';
        btn.disabled = false;
    } else {
        errorMsg.style.display = 'none';
        checkAuth();
    }
});

// Cerrar sesión
document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    checkAuth();
});

checkAuth();

// ==========================================
// 3. CRUD DE AGENDA (TAREAS)
// ==========================================
const taskForm = document.getElementById('task-form');
const taskContainer = document.getElementById('task-list-container');
const btnSave = document.getElementById('btn-save-task');
const btnCancel = document.getElementById('btn-cancel-edit');

async function fetchTasks() {
    taskContainer.innerHTML = `
        <div class="empty-state">
            <i class="fa-solid fa-circle-notch fa-spin"></i>
            <p>Cargando tareas...</p>
        </div>`;

    const { data, error } = await supabaseClient
        .from('agenda')
        .select('*')
        .eq('estado', 1)
        .order('fecha_agendada', { ascending: true });

    if (error) {
        console.error("Error cargando tareas:", error);
        taskContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-triangle-exclamation"></i>
                <p>Error al cargar tareas: ${error.message}</p>
            </div>`;
        return;
    }

    renderTasks(data);

    document.getElementById('stat-total').textContent = `Total: ${data.length}`;
    document.getElementById('stat-high').textContent = `Urgentes: ${data.filter(t => t.prioridad === 'high').length}`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function renderTasks(tasks) {
    if (tasks.length === 0) {
        taskContainer.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-mug-hot"></i>
                <p>No hay tareas pendientes en este momento.</p>
            </div>`;
        return;
    }

    taskContainer.innerHTML = '';

    tasks.forEach(task => {
        let fechaString = task.fecha_agendada;
        if (!fechaString.endsWith('Z') && !fechaString.includes('+') && !fechaString.includes('-')) {
            fechaString += 'Z';
        }
        
        const dateObj = new Date(fechaString);
        const targetMs = dateObj.getTime();
        
        // ========================================================
        // AQUI GENERAMOS LA FECHA Y HORA VISIBLE PARA LA DERECHA
        // ========================================================
        const displayDate = dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + 
                            dateObj.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        
        const safeTitulo = escapeHTML(task.titulo);
        const safeDesc = escapeHTML(task.descripcion);

        const html = `
        <div class="task-item ${task.prioridad}">
            <div class="task-main">
                <div class="task-header">
                    <span class="badge ${task.prioridad}">${task.prioridad.toUpperCase()}</span>
                    <h4>${task.titulo}</h4>
                </div>
                <p class="task-desc">${task.descripcion || ''}</p>
                <div class="task-countdown" data-target="${targetMs}">
                    <i class="fa-regular fa-clock"></i> <span class="countdown-text">Calculando...</span>
                </div>
            </div>
            
            <!-- ZONA DERECHA: FECHA AGENDADA Y BOTONES -->
            <div class="task-actions" style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
                
                <!-- CAJITA CON LA HORA EXACTA -->
                <div style="font-family: 'Roboto Mono', monospace; font-size: 0.85rem; color: var(--text-main); font-weight: 600; background: var(--bg-body); padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border);">
                    <i class="fa-regular fa-calendar-check" style="color: var(--primary);"></i> ${displayDate}
                </div>
                
                <div class="btn-group">
                    <button class="btn-icon btn-edit" onclick="editTask(${task.id}, '${safeTitulo}', '${safeDesc}', '${task.fecha_agendada}', '${task.prioridad}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon btn-del" onclick="archiveTask(${task.id})" title="Archivar"><i class="fa-solid fa-box-archive"></i></button>
                </div>
            </div>
        </div>`;
        taskContainer.insertAdjacentHTML('beforeend', html);
    });
}

// Guardar / Actualizar
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = document.getElementById('task-id').value;
    const titulo = document.getElementById('task-title').value;
    const descripcion = document.getElementById('task-desc').value;
    const rawDate = document.getElementById('task-date').value;
    const prioridad = document.getElementById('task-prio').value;

    btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    btnSave.disabled = true;

    const fecha_agendada = new Date(rawDate).toISOString();

    let error;

    if (id) {
        ({ error } = await supabaseClient.from('agenda').update({ titulo, descripcion, fecha_agendada, prioridad }).eq('id', parseInt(id)));
    } else {
        ({ error } = await supabaseClient.from('agenda').insert([{ titulo, descripcion, fecha_agendada, prioridad }]));
    }

    if (error) alert('Error al guardar: ' + error.message);

    taskForm.reset();
    document.getElementById('task-id').value = '';
    btnSave.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';
    btnSave.disabled = false;
    btnCancel.style.display = 'none';
    
    fetchTasks();
});

// Editar
window.editTask = function(id, titulo, desc, fecha, prio) {
    document.getElementById('task-id').value = id;
    document.getElementById('task-title').value = titulo.replace(/&quot;/g, '"');
    document.getElementById('task-desc').value = desc.replace(/&quot;/g, '"');

    let fechaString = fecha;
    if (!fechaString.endsWith('Z') && !fechaString.includes('+') && !fechaString.includes('-')) {
        fechaString += 'Z';
    }
    const dateObj = new Date(fechaString);
    const tzOffset = dateObj.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(dateObj - tzOffset)).toISOString().slice(0, 16);
    
    document.getElementById('task-date').value = localISOTime;
    document.getElementById('task-prio').value = prio;

    btnSave.innerHTML = '<i class="fa-solid fa-rotate"></i> Actualizar';
    btnCancel.style.display = 'flex';
    taskForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

btnCancel.addEventListener('click', () => {
    taskForm.reset();
    document.getElementById('task-id').value = '';
    btnSave.innerHTML = '<i class="fa-solid fa-plus"></i> Agregar';
    btnCancel.style.display = 'none';
});

window.archiveTask = async function(id) {
    if (confirm('¿Estás seguro de archivar esta tarea?')) {
        const { error } = await supabaseClient.from('agenda').update({ estado: 0 }).eq('id', parseInt(id));
        if (error) alert('Error al archivar: ' + error.message);
        else fetchTasks();
    }
}

// ==========================================
// 4. SEMÁFOROS (Cuenta regresiva)
// ==========================================
function updateSemaphores() {
    const now = new Date().getTime();
    const countdowns = document.querySelectorAll('.task-countdown');

    countdowns.forEach(badge => {
        const targetTime = parseInt(badge.dataset.target);
        if (isNaN(targetTime)) return;

        const diff = targetTime - now;
        const textSpan = badge.querySelector('.countdown-text');
        const taskCard = badge.closest('.task-item');

        badge.classList.remove('countdown-safe', 'countdown-warning', 'countdown-critical', 'countdown-overdue');
        taskCard.classList.remove('blink-critical-card');

        if (diff > 0) {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / 1000 / 60) % 60);
            const s = Math.floor((diff / 1000) % 60);

            if (diff <= 10 * 60 * 1000) {
                textSpan.textContent = `¡URGENTE! En ${m}m ${s}s`;
                badge.classList.add('countdown-critical');
                taskCard.classList.add('blink-critical-card');
            } else if (diff <= 60 * 60 * 1000) {
                textSpan.textContent = `Próxima: en ${m} min`;
                badge.classList.add('countdown-warning');
            } else {
                let timeStr = "En ";
                if (d > 0) timeStr += `${d} días y `;
                timeStr += `${h} hr ${m} min`;
                textSpan.textContent = timeStr;
                badge.classList.add('countdown-safe');
            }
        } else {
            const absDiff = Math.abs(diff);
            const oD = Math.floor(absDiff / (1000 * 60 * 60 * 24));
            const oH = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
            const oM = Math.floor((absDiff / 1000 / 60) % 60);

            let overdueStr = "Vencida hace ";
            if (oD > 0) overdueStr += `${oD}d `;
            if (oH > 0) overdueStr += `${oH}h `;
            overdueStr += `${oM}m`;

            textSpan.textContent = overdueStr;
            badge.classList.add('countdown-overdue');
        }
    });
}
setInterval(updateSemaphores, 1000);

// ==========================================
// 5. RELOJ AM/PM
// ==========================================
function updateClock() {
    const now = new Date();
    let h = now.getHours(), m = now.getMinutes(), s = now.getSeconds();
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12; h = h ? h : 12; 
    h = h < 10 ? '0' + h : h; m = m < 10 ? '0' + m : m; s = s < 10 ? '0' + s : s;
    
    document.getElementById('live-clock').textContent = h + ':' + m + ':' + s + ' ' + ampm;
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('live-date').textContent = now.toLocaleDateString('es-CL', options);
}
setInterval(updateClock, 1000);
updateClock(); 

// ==========================================
// 6. MODO OSCURO
// ==========================================
const toggleMode = document.getElementById('dark-mode-toggle');
if (localStorage.getItem('dark') === 'true') document.body.classList.add('dark-mode');
toggleMode.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('dark', document.body.classList.contains('dark-mode'));
});

// ==========================================
// 7. TICKER NOTICIAS RSS (GOOGLE NEWS CHILE)
// ==========================================
async function fetchNews() {
    const newsContainer = document.getElementById('news-container');
    const rssUrl = 'https://news.google.com/rss?hl=es-419&gl=CL&ceid=CL:es-419';
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.status === 'ok' && data.items && data.items.length > 0) {
            let newsHtml = '';
            const limit = Math.min(data.items.length, 10);
            
            for (let i = 0; i < limit; i++) {
                const item = data.items[i];
                const cleanTitle = item.title.split(' - ')[0].trim(); 
                newsHtml += `<span class="news-item"><a href="${item.link}" target="_blank" class="news-link">${cleanTitle}</a></span>`;
            }
            
            newsContainer.innerHTML = newsHtml;
            newsContainer.style.animationDuration = `${limit * 10}s`; 
            
        } else {
            newsContainer.innerHTML = '<span class="news-item">Últimas noticias...</span>';
        }
    } catch (error) {
        newsContainer.innerHTML = '<span class="news-item">Actualizando noticias...</span>';
    }
}
fetchNews();
setInterval(fetchNews, 900000);