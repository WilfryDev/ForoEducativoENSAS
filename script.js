// script.js

// === IMPORTAR FUNCIONES DE FIREBASE ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getFirestore, collection, addDoc, query, orderBy, 
    onSnapshot, Timestamp, doc, deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
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

// === VARIABLES GLOBALES ===
let currentUser = null; 
let currentTheme = localStorage.getItem('theme') || 'dark'; // Oscuro por defecto si no hay nada guardado
let unsubscribeOpinions = null; 

// === ESPERAR A QUE EL DOM ESTÉ LISTO ===
// Todo el código que interactúa con el HTML va DENTRO de este bloque
document.addEventListener('DOMContentLoaded', () => {

    // === Elementos del DOM (Movidos aquí dentro) ===
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeToggleIcon = themeToggleBtn.querySelector('i'); // Ahora seguro porque themeToggleBtn existe
    const loginSection = document.getElementById('login-section');
    const googleLoginBtn = document.getElementById('google-login-btn'); 
    const welcomeSection = document.getElementById('welcome-section');
    const displayUsername = document.getElementById('display-username');
    const logoutBtn = document.getElementById('logout-btn');
    const opinionSection = document.getElementById('opinion-section');
    const opinionTextarea = document.getElementById('opinion-text');
    const submitOpinionBtn = document.getElementById('submit-opinion-btn');
    const opinionsList = document.getElementById('opinions-list');

    // === Funciones de Tema ===
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        // Asegurarse de que themeToggleIcon exista antes de usarlo
        if (themeToggleIcon) { 
            themeToggleIcon.classList.toggle('fa-moon', theme === 'light');
            themeToggleIcon.classList.toggle('fa-sun', theme === 'dark');
        }
        localStorage.setItem('theme', theme);
        currentTheme = theme;
    };

    // Aplicar tema inicial AHORA que los elementos existen
    applyTheme(currentTheme); 

    // Event listener del botón de tema (Ahora seguro)
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
        });
    }

    // === Funciones de Login/Logout con Google Auth ===
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user; 
            updateLoginUI(true, user.displayName);
            loadOpinions(); 
        } else {
            currentUser = null;
            updateLoginUI(false, null);
            loadOpinions(); 
        }
    });

    const updateLoginUI = (isLoggedIn, username) => {
        // Añadir comprobaciones por si algún elemento no se encontrara (más robusto)
        if (loginSection) loginSection.classList.toggle('hidden', isLoggedIn);
        if (welcomeSection) welcomeSection.classList.toggle('hidden', !isLoggedIn);
        if (opinionSection) opinionSection.classList.toggle('hidden', !isLoggedIn);
        if (displayUsername && isLoggedIn) displayUsername.textContent = username; 
    };

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            try {
                await signInWithPopup(auth, provider);
            } catch (error) {
                console.error("Error al iniciar sesión con Google: ", error);
                alert("Error al iniciar sesión.");
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
            } catch (error) {
                console.error("Error al cerrar sesión: ", error);
            }
        });
    }


    // === FUNCIONES DE FIREBASE (Opiniones y Respuestas) ===

    const loadOpinions = () => {
        if (unsubscribeOpinions) {
            unsubscribeOpinions();
        }
        const opinionsRef = collection(db, "opinions");
        const q = query(opinionsRef, orderBy("timestamp", "desc"));
        unsubscribeOpinions = onSnapshot(q, (querySnapshot) => {
            if (!opinionsList) return; // Salir si la lista no existe
            opinionsList.innerHTML = ''; 
            querySnapshot.forEach((doc) => {
                const opinion = doc.data(); 
                opinion.id = doc.id;      
                addOpinionToDOM(opinion); 
            });
        });
    };

    const addOpinionToDOM = (opinion) => {
        const opinionDiv = document.createElement('div');
        opinionDiv.classList.add('opinion-item');
        opinionDiv.dataset.opinionId = opinion.id; 

        const opinionDate = opinion.timestamp ? opinion.timestamp.toDate().toLocaleString() : new Date().toLocaleString();
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

        if (opinionsList) opinionsList.appendChild(opinionDiv); 

        const repliesContainer = opinionDiv.querySelector('.replies-container');
        const repliesRef = collection(db, "opinions", opinion.id, "replies");
        const qReplies = query(repliesRef, orderBy("timestamp", "asc")); 
        
        onSnapshot(qReplies, (replySnapshot) => {
            if (!repliesContainer) return;
            repliesContainer.innerHTML = ''; 
            replySnapshot.forEach((doc) => {
                const reply = doc.data();
                reply.id = doc.id;
                addReplyToDOM(reply, repliesContainer, opinion.id); 
            });
        });

        const replyBtn = opinionDiv.querySelector('.btn-reply');
        const replyFormContainer = opinionDiv.querySelector('.reply-form-container');
        
        if (replyBtn) {
            replyBtn.addEventListener('click', () => {
                if (!currentUser) { 
                    alert('Debes iniciar sesión para responder.');
                    return;
                }
                if (replyFormContainer.querySelector('.reply-form')) {
                    replyFormContainer.innerHTML = '';
                } else {
                    showReplyForm(replyFormContainer, opinion.id);
                }
            });
        }
    };

    const addReplyToDOM = (reply, repliesContainer, opinionId) => {
        const replyDiv = document.createElement('div');
        replyDiv.classList.add('reply-item');
        replyDiv.dataset.replyId = reply.id;
        
        const replyDate = reply.timestamp ? reply.timestamp.toDate().toLocaleString() : new Date().toLocaleString();
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
        if (repliesContainer) repliesContainer.appendChild(replyDiv);
    };

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
        
        if (textarea) textarea.focus(); 

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                const replyText = textarea ? textarea.value.trim() : '';
                if (replyText) {
                    handleReplySubmit(replyText, parentOpinionId);
                    container.innerHTML = ''; 
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                container.innerHTML = ''; 
            });
        }
    };

    const handleReplySubmit = async (text, parentOpinionId) => {
        if (!currentUser) return; // Seguridad extra
        try {
            const repliesRef = collection(db, "opinions", parentOpinionId, "replies");
            await addDoc(repliesRef, {
                username: currentUser.displayName, 
                userId: currentUser.uid,         
                text: text,
                timestamp: Timestamp.now()
            });
        } catch (error) {
            console.error("Error al añadir respuesta: ", error);
            alert("Error al publicar la respuesta.");
        }
    };

    if (submitOpinionBtn) {
        submitOpinionBtn.addEventListener('click', async () => {
            const opinionText = opinionTextarea ? opinionTextarea.value.trim() : '';
            if (opinionText && currentUser) {
                try {
                    await addDoc(collection(db, "opinions"), {
                        username: currentUser.displayName, 
                        userId: currentUser.uid,         
                        text: opinionText,
                        timestamp: Timestamp.now()
                    });
                    if (opinionTextarea) opinionTextarea.value = ''; 
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
    }


    // === Funciones de Eliminar ===
    const handleDeleteOpinion = async (opinionId) => {
        if (!confirm("¿Estás seguro de que quieres eliminar esta opinión? Esta acción no se puede deshacer.")) return;
        try {
            const opinionRef = doc(db, "opinions", opinionId);
            await deleteDoc(opinionRef);
        } catch (error) {
            console.error("Error al eliminar la opinión: ", error);
            alert("No se pudo eliminar la opinión.");
        }
    };

    const handleDeleteReply = async (opinionId, replyId) => {
        if (!confirm("¿Estás seguro de que quieres eliminar esta respuesta?")) return;
        try {
            const replyRef = doc(db, "opinions", opinionId, "replies", replyId);
            await deleteDoc(replyRef);
        } catch (error) {
            console.error("Error al eliminar la respuesta: ", error);
            alert("No se pudo eliminar la respuesta.");
        }
    };

    // === Event Listener Global para Clics (Eliminar) ===
    if (opinionsList) {
        opinionsList.addEventListener('click', (e) => {
            const deleteOpinionBtn = e.target.closest('.btn-delete');
            const deleteReplyBtn = e.target.closest('.btn-delete-reply');

            if (deleteOpinionBtn) {
                const opinionId = deleteOpinionBtn.dataset.opinionId;
                handleDeleteOpinion(opinionId);
                return; 
            }
            
            if (deleteReplyBtn) {
                const opinionId = deleteReplyBtn.dataset.opinionId;
                const replyId = deleteReplyBtn.dataset.replyId;
                handleDeleteReply(opinionId, replyId);
                return; 
            }
        });
    }

    // === INICIALIZACIÓN ===
    // onAuthStateChanged se dispara al inicio y maneja la carga inicial
    // loadOpinions() se llama dentro de onAuthStateChanged

}); // Fin del DOMContentLoaded