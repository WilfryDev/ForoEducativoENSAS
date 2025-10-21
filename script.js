// script.js

// === IMPORTAR FUNCIONES DE FIREBASE ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, orderBy, 
    onSnapshot, Timestamp, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
// ¡NUEVAS IMPORTACIONES DE AUTH!
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, 
    signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// === TU CONFIGURACIÓN DE FIREBASE ===
const firebaseConfig = {
  apiKey: "AIzaSyCziZFNaaTxDMlANX3GybGBEy76mrtAOa4",
  authDomain: "foro-ensas-2025.firebaseapp.com",
  projectId: "foro-ensas-2025",
  storageBucket: "foro-ensas-2025.firebasestorage.app",
  messagingSenderId: "744648047081",
  appId: "1:744648047081:web:43a2ec14b6812fe8ec3378",
  measurementId: "G-QCVKV2MH1L"
};

// === INICIALIZAR FIREBASE Y SERVICIOS ===
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);      // Base de datos
const auth = getAuth(app);         // Autenticación
const provider = new GoogleAuthProvider(); // Proveedor de Google

// === Elementos del DOM ===
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleIcon = themeToggleBtn.querySelector('i');
const loginSection = document.getElementById('login-section');
const googleLoginBtn = document.getElementById('google-login-btn'); // Botón de Google
const welcomeSection = document.getElementById('welcome-section');
const displayUsername = document.getElementById('display-username');
const logoutBtn = document.getElementById('logout-btn');
const opinionSection = document.getElementById('opinion-section');
const opinionTextarea = document.getElementById('opinion-text');
const submitOpinionBtn = document.getElementById('submit-opinion-btn');
const opinionsList = document.getElementById('opinions-list');

// === VARIABLES GLOBALES ===
let currentUser = null; // Reemplaza a currentUsername
let currentTheme = localStorage.getItem('theme') || 'dark';
let unsubscribeOpinions = null; // Para el 'oyente' de Firebase

// === Funciones de Tema ===
const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggleIcon.classList.toggle('fa-moon', theme === 'light');
    themeToggleIcon.classList.toggle('fa-sun', theme === 'dark');
    localStorage.setItem('theme', theme);
    currentTheme = theme;
};

themeToggleBtn.addEventListener('click', () => {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
});

// === NUEVAS Funciones de Login/Logout con Google Auth ===

// 1. Oyente principal de Autenticación
// Esto se dispara al cargar la página y cada vez que el estado de login cambia
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Usuario ha iniciado sesión
        currentUser = user; // Guardamos el objeto de usuario (contiene uid, displayName, email, photoURL)
        updateLoginUI(true, user.displayName);
        loadOpinions(); // Carga opiniones ahora que sabemos quién es el usuario
    } else {
        // Usuario ha cerrado sesión
        currentUser = null;
        updateLoginUI(false, null);
        loadOpinions(); // Carga opiniones sin usuario (no se mostrarán botones de eliminar)
    }
});

// 2. Función de UI
const updateLoginUI = (isLoggedIn, username) => {
    if (isLoggedIn) {
        loginSection.classList.add('hidden');
        welcomeSection.classList.remove('hidden');
        opinionSection.classList.remove('hidden');
        displayUsername.textContent = username; // Muestra el nombre de Google
    } else {
        loginSection.classList.remove('hidden');
        welcomeSection.classList.add('hidden');
        opinionSection.classList.add('hidden');
    }
};

// 3. Eventos de clic para Iniciar y Cerrar Sesión
googleLoginBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
        // onAuthStateChanged se encargará del resto
    } catch (error) {
        console.error("Error al iniciar sesión con Google: ", error);
        alert("Error al iniciar sesión.");
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        // onAuthStateChanged se encargará del resto
    } catch (error) {
        console.error("Error al cerrar sesión: ", error);
    }
});


// === FUNCIONES DE FIREBASE (ACTUALIZADAS) ===

const loadOpinions = () => {
    if (unsubscribeOpinions) {
        unsubscribeOpinions();
    }

    const opinionsRef = collection(db, "opinions");
    const q = query(opinionsRef, orderBy("timestamp", "desc"));

    unsubscribeOpinions = onSnapshot(q, (querySnapshot) => {
        opinionsList.innerHTML = ''; 
        querySnapshot.forEach((doc) => {
            const opinion = doc.data(); 
            opinion.id = doc.id;      
            addOpinionToDOM(opinion); 
        });
    });
};

/**
 * Añade una OPINIÓN PRINCIPAL al DOM
 */
const addOpinionToDOM = (opinion) => {
    const opinionDiv = document.createElement('div');
    opinionDiv.classList.add('opinion-item');
    opinionDiv.dataset.opinionId = opinion.id; 

    const opinionDate = opinion.timestamp ? opinion.timestamp.toDate().toLocaleString() : new Date().toLocaleString();

    // ¡NUEVO CHECK DE SEGURIDAD!
    // Compara el ID de usuario de Google (currentUser.uid)
    let deleteButtonHTML = '';
    if (currentUser && opinion.userId === currentUser.uid) {
        deleteButtonHTML = `<button class="btn-delete" data-opinion-id="${opinion.id}">Eliminar</button>`;
    }

    opinionDiv.innerHTML = `
        <div class="opinion-header">
            <span class="opinion-author">${opinion.username}</span>
            <span class="opinion-date">${opinionDate}</span>
        </div>
        <p class="opinion-content">${opinion.text.replace(/\n/g, '<br>')}</p> 
        <div class="opinion-actions">
            <button class="btn-reply">Responder</button>
            ${deleteButtonHTML} 
        </div>
        <div class="replies-container"></div>
        <div class="reply-form-container"></div>
    `;

    opinionsList.appendChild(opinionDiv); 

    // --- Cargar Respuestas (Replies) ---
    const repliesContainer = opinionDiv.querySelector('.replies-container');
    const repliesRef = collection(db, "opinions", opinion.id, "replies");
    const qReplies = query(repliesRef, orderBy("timestamp", "asc")); 
    
    onSnapshot(qReplies, (replySnapshot) => {
        repliesContainer.innerHTML = ''; 
        replySnapshot.forEach((doc) => {
            const reply = doc.data();
            reply.id = doc.id;
            addReplyToDOM(reply, repliesContainer, opinion.id); 
        });
    });

    // --- Evento del botón Responder ---
    const replyBtn = opinionDiv.querySelector('.btn-reply');
    const replyFormContainer = opinionDiv.querySelector('.reply-form-container');
    
    replyBtn.addEventListener('click', () => {
        if (!currentUser) { // Comprueba si el usuario está logueado
            alert('Debes iniciar sesión para responder.');
            return;
        }
        if (replyFormContainer.querySelector('.reply-form')) {
            replyFormContainer.innerHTML = '';
        } else {
            showReplyForm(replyFormContainer, opinion.id);
        }
    });
};

/**
 * Añade una RESPUESTA (anidada) al DOM
 */
const addReplyToDOM = (reply, repliesContainer, opinionId) => {
    const replyDiv = document.createElement('div');
    replyDiv.classList.add('reply-item');
    replyDiv.dataset.replyId = reply.id;
    
    const replyDate = reply.timestamp ? reply.timestamp.toDate().toLocaleString() : new Date().toLocaleString();

    // ¡NUEVO CHECK DE SEGURIDAD!
    let deleteReplyButtonHTML = '';
    if (currentUser && reply.userId === currentUser.uid) {
        deleteReplyButtonHTML = `
            <button class="btn-delete-reply" 
                    data-opinion-id="${opinionId}" 
                    data-reply-id="${reply.id}">
                Eliminar
            </button>`;
    }

    replyDiv.innerHTML = `
        <div class="opinion-header">
            <div>
                <span class="opinion-author">${reply.username}</span>
                <span class="opinion-date">${replyDate}</span>
            </div>
            ${deleteReplyButtonHTML} 
        </div>
        <p class="opinion-content">${reply.text.replace(/\n/g, '<br>')}</p>
    `;
    repliesContainer.appendChild(replyDiv);
};

/**
 * Muestra el formulario para responder
 */
const showReplyForm = (container, parentOpinionId) => {
    container.innerHTML = `
        <form class="reply-form">
            <textarea class="reply-textarea" placeholder="Escribe tu respuesta..."></textarea>
            <div class="reply-form-actions">
                <button type="submit" class="btn-reply-submit">Publicar</button>
                <button type="button" class="btn-reply-cancel">Cancelar</button>
            </div>
        </form>
    `;

    const form = container.querySelector('.reply-form');
    const cancelBtn = container.querySelector('.btn-reply-cancel');
    const textarea = form.querySelector('.reply-textarea');
    
    textarea.focus(); 

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const replyText = textarea.value.trim();
        
        if (replyText) {
            handleReplySubmit(replyText, parentOpinionId);
            container.innerHTML = ''; 
        }
    });

    cancelBtn.addEventListener('click', () => {
        container.innerHTML = ''; 
    });
};

/**
 * Guarda la NUEVA RESPUESTA en Firebase
 */
const handleReplySubmit = async (text, parentOpinionId) => {
    try {
        const repliesRef = collection(db, "opinions", parentOpinionId, "replies");
        await addDoc(repliesRef, {
            username: currentUser.displayName, // Nombre de Google
            userId: currentUser.uid,         // ID de Google
            text: text,
            timestamp: Timestamp.now()
        });
    } catch (error) {
        console.error("Error al añadir respuesta: ", error);
        alert("Error al publicar la respuesta.");
    }
};

/**
 * Guarda la NUEVA OPINIÓN en Firebase
 */
submitOpinionBtn.addEventListener('click', async () => {
    const opinionText = opinionTextarea.value.trim();
    if (opinionText && currentUser) {
        try {
            await addDoc(collection(db, "opinions"), {
                username: currentUser.displayName, // Nombre de Google
                userId: currentUser.uid,         // ID de Google
                text: opinionText,
                timestamp: Timestamp.now()
            });
            opinionTextarea.value = ''; 
        } catch (error) {
            console.error("Error al añadir opinión: ", error);
            alert("Error al publicar la opinión.");
        }
    } else if (!opinionText) {
        alert('Por favor, escribe tu opinión antes de publicar.');
    } else {
        alert('Debes iniciar sesión para publicar una opinión.');
    }
});


// === NUEVAS FUNCIONES DE ELIMINAR ===

const handleDeleteOpinion = async (opinionId) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta opinión? Esta acción no se puede deshacer.")) {
        return;
    }
    
    try {
        const opinionRef = doc(db, "opinions", opinionId);
        await deleteDoc(opinionRef);
    } catch (error) {
        console.error("Error al eliminar la opinión: ", error);
        alert("No se pudo eliminar la opinión.");
    }
};

const handleDeleteReply = async (opinionId, replyId) => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta respuesta?")) {
        return;
    }
    
    try {
        const replyRef = doc(db, "opinions", opinionId, "replies", replyId);
        await deleteDoc(replyRef);
    } catch (error) {
        console.error("Error al eliminar la respuesta: ", error);
        alert("No se pudo eliminar la respuesta.");
    }
};

// === Event Listener Global para Clics ===
opinionsList.addEventListener('click', (e) => {
    // Busca el botón más cercano que coincida
    const deleteOpinionBtn = e.target.closest('.btn-delete');
    const deleteReplyBtn = e.target.closest('.btn-delete-reply');

    if (deleteOpinionBtn) {
        const opinionId = deleteOpinionBtn.dataset.opinionId;
        handleDeleteOpinion(opinionId);
        return; // Detiene la ejecución
    }
    
    if (deleteReplyBtn) {
        const opinionId = deleteReplyBtn.dataset.opinionId;
        const replyId = deleteReplyBtn.dataset.replyId;
        handleDeleteReply(opinionId, replyId);
        return; // Detiene la ejecución
    }
});


// === INICIALIZACIÓN ===
applyTheme(currentTheme); 
// No es necesario llamar a updateLoginUI o loadOpinions aquí.
// onAuthStateChanged() se disparará automáticamente al cargar 
// y se encargará de todo.