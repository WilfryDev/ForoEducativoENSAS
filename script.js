// script.js

// === IMPORTAR FUNCIONES DE FIREBASE ===
// Estas funciones vienen de los scripts que pusimos en el index.html
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    onSnapshot,
    Timestamp,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// === INICIALIZAR FIREBASE Y FIRESTORE ===
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // ¡Nuestra base de datos!

// === Elementos del DOM (igual que antes) ===
const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleIcon = themeToggleBtn.querySelector('i');
const loginSection = document.getElementById('login-section');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');
const welcomeSection = document.getElementById('welcome-section');
const displayUsername = document.getElementById('display-username');
const logoutBtn = document.getElementById('logout-btn');
const opinionSection = document.getElementById('opinion-section');
const opinionTextarea = document.getElementById('opinion-text');
const submitOpinionBtn = document.getElementById('submit-opinion-btn');
const opinionsList = document.getElementById('opinions-list');

// El nombre de usuario ahora se guarda en una variable simple, no en localStorage
let currentUsername = ''; 

// Detecta el tema guardado o usa 'dark' por defecto
let currentTheme = localStorage.getItem('theme') || 'dark'; // <--- TEMA OSCURO POR DEFECTO

// === Funciones de Tema (igual que antes) ===
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

// === Funciones de Login/Logout (lógica de UI) ===
const updateLoginUI = () => {
    if (currentUsername) {
        loginSection.classList.add('hidden');
        welcomeSection.classList.remove('hidden');
        opinionSection.classList.remove('hidden');
        displayUsername.textContent = currentUsername;
    } else {
        loginSection.classList.remove('hidden');
        welcomeSection.classList.add('hidden');
        opinionSection.classList.add('hidden');
        usernameInput.value = ''; 
    }
};

loginBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        currentUsername = username;
        // Guardamos el nombre en localStorage para "recordarlo"
        localStorage.setItem('forumUsername', username); 
        updateLoginUI();
    } else {
        alert('Por favor, ingresa tu nombre para unirte al foro.');
    }
});

logoutBtn.addEventListener('click', () => {
    currentUsername = '';
    localStorage.removeItem('forumUsername');
    updateLoginUI();
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        loginBtn.click();
    }
});

// === FUNCIONES DE FIREBASE (¡LO NUEVO!) ===

/**
 * Carga todas las opiniones desde Firebase en TIEMPO REAL.
 * onSnapshot "escucha" la base de datos.
 */
const loadOpinions = () => {
    const opinionsRef = collection(db, "opinions");
    // Ordenamos por fecha, las más nuevas primero
    const q = query(opinionsRef, orderBy("timestamp", "desc"));

    // onSnapshot es el "oyente" en tiempo real
    onSnapshot(q, (querySnapshot) => {
        opinionsList.innerHTML = ''; // Limpiamos la lista
        querySnapshot.forEach((doc) => {
            const opinion = doc.data(); // Los datos del documento
            opinion.id = doc.id;      // El ID del documento
            addOpinionToDOM(opinion); // Lo añadimos al HTML
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

    // Convertimos el Timestamp de Firebase a una fecha legible
    const opinionDate = opinion.timestamp ? opinion.timestamp.toDate().toLocaleString() : new Date().toLocaleString();

    opinionDiv.innerHTML = `
        <div class="opinion-header">
            <span class="opinion-author">${opinion.username}</span>
            <span class="opinion-date">${opinionDate}</span>
        </div>
        <p class="opinion-content">${opinion.text.replace(/\n/g, '<br>')}</p> 
        <div class="opinion-actions">
            <button class="btn-reply">Responder</button>
        </div>
        <div class="replies-container"></div>
        <div class="reply-form-container"></div>
    `;

    opinionsList.appendChild(opinionDiv); // Añadir al cargar

    // --- Cargar Respuestas (Replies) ---
    const repliesContainer = opinionDiv.querySelector('.replies-container');
    // Creamos la referencia a la sub-colección de respuestas
    const repliesRef = collection(db, "opinions", opinion.id, "replies");
    const qReplies = query(repliesRef, orderBy("timestamp", "asc")); // Las respuestas en orden
    
    // Escuchamos las respuestas en tiempo real
    onSnapshot(qReplies, (replySnapshot) => {
        repliesContainer.innerHTML = ''; // Limpiamos respuestas
        replySnapshot.forEach((doc) => {
            const reply = doc.data();
            reply.id = doc.id;
            addReplyToDOM(reply, repliesContainer);
        });
    });


    // --- Evento del botón Responder ---
    const replyBtn = opinionDiv.querySelector('.btn-reply');
    const replyFormContainer = opinionDiv.querySelector('.reply-form-container');
    
    replyBtn.addEventListener('click', () => {
        if (!currentUsername) {
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
const addReplyToDOM = (reply, repliesContainer) => {
    const replyDiv = document.createElement('div');
    replyDiv.classList.add('reply-item');
    replyDiv.dataset.replyId = reply.id;
    
    const replyDate = reply.timestamp ? reply.timestamp.toDate().toLocaleString() : new Date().toLocaleString();

    replyDiv.innerHTML = `
        <div class="opinion-header">
            <span class="opinion-author">${reply.username}</span>
            <span class="opinion-date">${replyDate}</span>
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
        // Creamos la referencia a la sub-colección "replies" DENTRO de la opinión
        const repliesRef = collection(db, "opinions", parentOpinionId, "replies");
        
        // Añadimos el nuevo documento de respuesta
        await addDoc(repliesRef, {
            username: currentUsername,
            text: text,
            timestamp: Timestamp.now() // ¡Usamos la marca de tiempo de Firebase!
        });
        
        // No necesitamos añadir al DOM, ¡el "oyente" onSnapshot lo hará por nosotros!
        
    } catch (error) {
        console.error("Error al añadir respuesta: ", error);
        alert("Error al publicar la respuesta.");
    }
};

submitOpinionBtn.addEventListener('click', async () => {
    const opinionText = opinionTextarea.value.trim();
    if (opinionText && currentUsername) {
        
        try {
            // Añadimos un nuevo documento a la colección "opinions"
            await addDoc(collection(db, "opinions"), {
                username: currentUsername,
                text: opinionText,
                timestamp: Timestamp.now() // Marca de tiempo del servidor
            });
            
            // No necesitamos añadir al DOM, ¡onSnapshot lo hará!
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

// === INICIALIZACIÓN ===
applyTheme(currentTheme); 

// Comprobamos si el usuario ya "inició sesión" (con localStorage)
currentUsername = localStorage.getItem('forumUsername') || '';
updateLoginUI(); 

// ¡Cargamos las opiniones desde Firebase!
loadOpinions();