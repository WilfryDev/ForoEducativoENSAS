// script.js

// === IMPORTAR FUNCIONES DE FIREBASE ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, collection, addDoc, query, orderBy,
    onSnapshot, Timestamp, doc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup,
    signOut, onAuthStateChanged, updateProfile, // updateProfile no se usa aquí pero podría ser útil si se edita desde index
    // Importaciones para Teléfono
    RecaptchaVerifier, signInWithPhoneNumber
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
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// === VARIABLES GLOBALES ===
let currentUser = null;
let currentTheme = localStorage.getItem('theme') || 'dark'; // Oscuro por defecto
let unsubscribeOpinions = null;
let recaptchaVerifier = null; // Para reCAPTCHA
let phoneConfirmationResult = null; // Para guardar el resultado del envío de SMS

// === ESPERAR A QUE EL DOM ESTÉ LISTO ===
document.addEventListener('DOMContentLoaded', () => {

    // === Obtener TODOS los elementos del DOM ===
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeToggleIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;
    const loginSection = document.getElementById('login-section');
    const googleLoginBtn = document.getElementById('google-login-btn');
    const welcomeSection = document.getElementById('welcome-section');
    const displayUsername = document.getElementById('display-username');
    const logoutBtn = document.getElementById('logout-btn');
    const opinionSection = document.getElementById('opinion-section');
    const opinionTextarea = document.getElementById('opinion-text');
    const submitOpinionBtn = document.getElementById('submit-opinion-btn');
    const opinionsList = document.getElementById('opinions-list');
    // Elementos del formulario de teléfono
    const phoneFormStep1 = document.getElementById('phone-form-step1');
    const phoneNumberInput = document.getElementById('phone-number-input');
    const sendCodeBtn = document.getElementById('send-code-btn');
    const recaptchaContainer = document.getElementById('recaptcha-container');
    const phoneFormStep2 = document.getElementById('phone-form-step2');
    const smsCodeInput = document.getElementById('sms-code-input');
    const verifyCodeBtn = document.getElementById('verify-code-btn');
    const cancelPhoneBtn = document.getElementById('cancel-phone-btn');
    const phoneAuthError = document.getElementById('phone-auth-error');
    // Link a perfil (ya no es un botón que abre modal)
    const editProfileLink = document.getElementById('edit-profile-link');


    console.log("Resultado de getElementById('theme-toggle') al cargar DOM:", themeToggleBtn);

    // === Funciones de Tema ===
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeToggleIcon) {
            themeToggleIcon.classList.toggle('fa-moon', theme === 'light');
            themeToggleIcon.classList.toggle('fa-sun', theme === 'dark');
        } else { console.warn("Elemento 'themeToggleIcon' no encontrado."); }
        localStorage.setItem('theme', theme);
        currentTheme = theme;
    };
    applyTheme(currentTheme);
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
        });
    } else { console.error("Botón 'theme-toggle' no encontrado."); }

    // === Configurar reCAPTCHA ===
     const setupRecaptcha = () => {
        if (!recaptchaContainer) {
             console.error("Contenedor reCAPTCHA no encontrado.");
             // Deshabilitar botón de enviar SMS si no hay contenedor
             if(sendCodeBtn) sendCodeBtn.disabled = true;
             return;
        }
        try {
            // Asegurarse de que no se cree múltiples veces
            if (!recaptchaVerifier) {
                recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    'size': 'invisible',
                    'callback': (response) => { console.log("reCAPTCHA verificado."); },
                    'expired-callback': () => {
                        console.error("reCAPTCHA expirado.");
                        showPhoneError("La verificación reCAPTCHA ha expirado. Inténtalo de nuevo.");
                        resetPhoneAuth();
                    }
                });
                 recaptchaVerifier.render().then((widgetId) => {
                     window.recaptchaWidgetId = widgetId;
                     console.log("Widget reCAPTCHA renderizado:", widgetId);
                 }).catch(error => { // Capturar error de renderizado
                    console.error("Error al renderizar reCAPTCHA:", error);
                    showPhoneError("No se pudo iniciar la verificación reCAPTCHA. Asegúrate de estar en un dominio autorizado (HTTPS o localhost).");
                     if(sendCodeBtn) sendCodeBtn.disabled = true; // Deshabilitar si falla
                 });
            }
        } catch (error) {
             console.error("Error al inicializar RecaptchaVerifier:", error);
             showPhoneError("Error al configurar reCAPTCHA.");
             if(sendCodeBtn) sendCodeBtn.disabled = true; // Deshabilitar si falla
        }
    };
    setupRecaptcha(); // Llama a configurar reCAPTCHA al cargar


     // Función para mostrar errores de teléfono
     const showPhoneError = (message) => {
         if (phoneAuthError) {
             phoneAuthError.textContent = message;
             phoneAuthError.classList.remove('hidden');
         }
     };
     // Función para ocultar errores de teléfono
      const hidePhoneError = () => {
         if (phoneAuthError) {
             phoneAuthError.classList.add('hidden');
         }
     };
    // Función para resetear la UI de autenticación por teléfono
    const resetPhoneAuth = () => {
        if (phoneFormStep1) phoneFormStep1.classList.remove('hidden');
        if (phoneFormStep2) phoneFormStep2.classList.add('hidden');
        if (phoneNumberInput) phoneNumberInput.value = '';
        if (smsCodeInput) smsCodeInput.value = '';
        if (sendCodeBtn) { // Reactivar botón de enviar código
             sendCodeBtn.disabled = false;
             sendCodeBtn.textContent = 'Enviar Código SMS';
        }
         if (verifyCodeBtn) { // Resetear botón de verificar
             verifyCodeBtn.disabled = false;
             verifyCodeBtn.textContent = 'Verificar Código';
        }
        hidePhoneError();
        phoneConfirmationResult = null;
        // Resetear reCAPTCHA si existe y está renderizado
        try {
            if (recaptchaVerifier && typeof grecaptcha !== 'undefined' && window.recaptchaWidgetId !== undefined) {
                 grecaptcha.reset(window.recaptchaWidgetId);
            }
        } catch(error){
            console.warn("No se pudo resetear reCAPTCHA:", error);
        }
    };

    // === Funciones de Login/Logout con Google Auth ===
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
             const displayName = user.displayName || user.phoneNumber || "Usuario Anónimo";
            updateLoginUI(true, displayName);
            loadOpinions();
        } else {
            currentUser = null;
            updateLoginUI(false, null);
            loadOpinions(); // Carga opiniones incluso sin usuario
            resetPhoneAuth(); // Asegura reseteo al cerrar sesión
        }
    });

    const updateLoginUI = (isLoggedIn, username) => {
        if (loginSection) loginSection.classList.toggle('hidden', isLoggedIn);
        if (welcomeSection) welcomeSection.classList.toggle('hidden', !isLoggedIn);
        if (opinionSection) opinionSection.classList.toggle('hidden', !isLoggedIn);
        if (displayUsername && isLoggedIn) displayUsername.textContent = username;
    };

    if (googleLoginBtn) {
        googleLoginBtn.addEventListener('click', async () => {
            try { await signInWithPopup(auth, provider); }
            catch (error) {
                console.error("Error al iniciar sesión con Google: ", error);
                 if (error.code === 'auth/popup-blocked') { alert("Pop-up bloqueado. Permite ventanas emergentes."); }
                 else if (error.code === 'auth/cancelled-popup-request') { console.log("Login cancelado."); }
                 else { alert("Error al iniciar sesión."); }
            }
        });
    } else { console.error("Botón 'google-login-btn' no encontrado."); }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
             try { await signOut(auth); }
             catch (error) { console.error("Error al cerrar sesión: ", error); }
        });
    }

    // === Event Listeners para Teléfono ===
     if (sendCodeBtn && phoneNumberInput && recaptchaContainer) {
        sendCodeBtn.addEventListener('click', async () => {
            hidePhoneError();
            const phoneNumber = phoneNumberInput.value.trim();

            if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
                showPhoneError("Ingresa un número válido con código de país (ej: +18091234567).");
                return;
            }
             if (!recaptchaVerifier) {
                 showPhoneError("Error: reCAPTCHA no está listo.");
                 // Intentar re-inicializar
                 setupRecaptcha();
                 return;
             }

            sendCodeBtn.disabled = true;
            sendCodeBtn.textContent = 'Enviando...';

            try {
                // Usa el recaptchaVerifier aquí
                phoneConfirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
                console.log("SMS enviado, esperando código.");
                if (phoneFormStep1) phoneFormStep1.classList.add('hidden');
                if (phoneFormStep2) phoneFormStep2.classList.remove('hidden');
                if (smsCodeInput) smsCodeInput.focus();

            } catch (error) {
                console.error("Error al enviar SMS: ", error);
                 if (error.code === 'auth/invalid-phone-number') { showPhoneError("El número de teléfono no es válido."); }
                 else if (error.code === 'auth/too-many-requests') { showPhoneError("Demasiados intentos. Intenta más tarde."); }
                 else if (error.message.includes('reCAPTCHA')) { showPhoneError("Falló la verificación reCAPTCHA. Recarga la página.");}
                 else { showPhoneError("Error al enviar el código SMS."); }
                resetPhoneAuth(); // Resetea si hay error
            } finally {
                // Reactiva botón solo si NO se pasó al paso 2
                 if (phoneFormStep1 && !phoneFormStep1.classList.contains('hidden')) {
                     sendCodeBtn.disabled = false;
                     sendCodeBtn.textContent = 'Enviar Código SMS';
                 }
            }
        });
    } else { console.error("Faltan elementos para el login por teléfono (paso 1)."); }

    if (verifyCodeBtn && smsCodeInput) {
        verifyCodeBtn.addEventListener('click', async () => {
            hidePhoneError();
            const code = smsCodeInput.value.trim();
            if (!code || code.length !== 6) { showPhoneError("Ingresa el código de 6 dígitos."); return; }
            if (!phoneConfirmationResult) { showPhoneError("Error: No se encontró la confirmación."); return; }

            verifyCodeBtn.disabled = true;
            verifyCodeBtn.textContent = 'Verificando...';

            try {
                await phoneConfirmationResult.confirm(code);
                console.log("Código verificado, usuario autenticado.");
                // onAuthStateChanged se encargará del resto
            } catch (error) {
                console.error("Error al verificar código: ", error);
                if (error.code === 'auth/invalid-verification-code' || error.code === 'auth/code-expired') {
                     showPhoneError("Código incorrecto o expirado.");
                 } else { showPhoneError("Error al verificar el código."); }
                 if (smsCodeInput) smsCodeInput.value = ''; // Limpia campo para reintentar
            } finally {
                 verifyCodeBtn.disabled = false;
                 verifyCodeBtn.textContent = 'Verificar Código';
            }
        });
    } else { console.error("Faltan elementos para el login por teléfono (paso 2)."); }

    if (cancelPhoneBtn) {
        cancelPhoneBtn.addEventListener('click', () => {
            resetPhoneAuth(); // Vuelve al paso 1
        });
    } else { console.error("Botón 'cancel-phone-btn' no encontrado."); }


    // === FUNCIONES DE FIREBASE (Opiniones y Respuestas) ===
    const loadOpinions = () => {
        if (unsubscribeOpinions) { unsubscribeOpinions(); }
        if (!opinionsList) { console.error("'opinions-list' no encontrado."); return; }

        const opinionsRef = collection(db, "opinions");
        const q = query(opinionsRef, orderBy("timestamp", "desc"));
        unsubscribeOpinions = onSnapshot(q, (querySnapshot) => {
            opinionsList.innerHTML = '';
            querySnapshot.forEach((doc) => {
                const opinion = doc.data();
                opinion.id = doc.id;
                addOpinionToDOM(opinion);
            });
        }, (error) => { console.error("Error al escuchar opiniones: ", error); });
    };

    const addOpinionToDOM = (opinion) => {
        if (!opinionsList) return;
        const opinionDiv = document.createElement('div');
        opinionDiv.classList.add('opinion-item');
        opinionDiv.dataset.opinionId = opinion.id;
        const opinionDate = opinion.timestamp ? opinion.timestamp.toDate().toLocaleString() : new Date().toLocaleString();
        let deleteButtonHTML = '';
        // Comprobar si hay usuario Y si el userId coincide
        if (currentUser && opinion.userId && opinion.userId === currentUser.uid) {
            deleteButtonHTML = `<button class="btn-delete" data-opinion-id="${opinion.id}">Eliminar</button>`;
        }
        opinionDiv.innerHTML = `
            <div class="opinion-header">
                <span class="opinion-author">${opinion.username || 'Anónimo'}</span> <span class="opinion-date">${opinionDate}</span>
            </div>
            <p class="opinion-content">${(opinion.text || '').replace(/\n/g, '<br>')}</p> <div class="opinion-actions">
                <button class="btn-reply">Responder</button>
                ${deleteButtonHTML}
            </div>
            <div class="replies-container"></div>
            <div class="reply-form-container"></div>`;
        opinionsList.appendChild(opinionDiv);
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
        }, (error) => { console.error(`Error al escuchar resp. para ${opinion.id}: `, error); });
        const replyBtn = opinionDiv.querySelector('.btn-reply');
        const replyFormContainer = opinionDiv.querySelector('.reply-form-container');
        if (replyBtn) {
            replyBtn.addEventListener('click', () => {
                if (!currentUser) { alert('Debes iniciar sesión para responder.'); return; }
                if (replyFormContainer && replyFormContainer.querySelector('.reply-form')) {
                    replyFormContainer.innerHTML = '';
                } else if (replyFormContainer) {
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
         // Comprobar si hay usuario Y si el userId coincide
        if (currentUser && reply.userId && reply.userId === currentUser.uid) {
            deleteReplyButtonHTML = `<button class="btn-delete-reply" data-opinion-id="${opinionId}" data-reply-id="${reply.id}">Eliminar</button>`;
        }
        replyDiv.innerHTML = `
            <div class="opinion-header">
                <div>
                    <span class="opinion-author">${reply.username || 'Anónimo'}</span> <span class="opinion-date">${replyDate}</span>
                </div>
                ${deleteReplyButtonHTML}
            </div>
            <p class="opinion-content">${(reply.text || '').replace(/\n/g, '<br>')}</p>`; // Fallback
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
        if (cancelBtn) { cancelBtn.addEventListener('click', () => { container.innerHTML = ''; }); }
    };

    const handleReplySubmit = async (text, parentOpinionId) => {
        if (!currentUser) return;
        try {
            const repliesRef = collection(db, "opinions", parentOpinionId, "replies");
            await addDoc(repliesRef, {
                username: currentUser.displayName || currentUser.phoneNumber || "Anónimo", // Usa nombre o teléfono
                userId: currentUser.uid,
                text: text,
                timestamp: Timestamp.now()
            });
        } catch (error) { console.error("Error al añadir respuesta: ", error); alert("Error al publicar la respuesta."); }
    };

    if (submitOpinionBtn) {
        submitOpinionBtn.addEventListener('click', async () => {
            const opinionText = opinionTextarea ? opinionTextarea.value.trim() : '';
            if (opinionText && currentUser) {
                try {
                    await addDoc(collection(db, "opinions"), {
                        username: currentUser.displayName || currentUser.phoneNumber || "Anónimo", // Usa nombre o teléfono
                        userId: currentUser.uid,
                        text: opinionText,
                        timestamp: Timestamp.now()
                    });
                    if (opinionTextarea) opinionTextarea.value = '';
                } catch (error) { console.error("Error al añadir opinión: ", error); alert("Error al publicar la opinión."); }
            } else if (!opinionText) { alert('Por favor, escribe tu opinión antes de publicar.'); }
            else { alert('Debes iniciar sesión para publicar una opinión.'); }
        });
    } else { console.error("Botón 'submit-opinion-btn' no encontrado."); }

    // === Funciones de Eliminar ===
    const handleDeleteOpinion = async (opinionId) => {
        if (!confirm("¿Estás seguro de que quieres eliminar esta opinión?")) return;
        try { await deleteDoc(doc(db, "opinions", opinionId)); }
        catch (error) { console.error("Error al eliminar la opinión: ", error); alert("No se pudo eliminar."); }
    };
    const handleDeleteReply = async (opinionId, replyId) => {
        if (!confirm("¿Estás seguro de que quieres eliminar esta respuesta?")) return;
        try { await deleteDoc(doc(db, "opinions", opinionId, "replies", replyId)); }
        catch (error) { console.error("Error al eliminar la respuesta: ", error); alert("No se pudo eliminar."); }
    };

    // === Event Listener Global para Clics (Eliminar) ===
     if (opinionsList) {
        opinionsList.addEventListener('click', (e) => {
            const deleteOpinionBtn = e.target.closest('.btn-delete');
            const deleteReplyBtn = e.target.closest('.btn-delete-reply');
            if (deleteOpinionBtn) {
                const opinionId = deleteOpinionBtn.dataset.opinionId;
                if(opinionId) handleDeleteOpinion(opinionId); return;
            }
            if (deleteReplyBtn) {
                const opinionId = deleteReplyBtn.dataset.opinionId;
                const replyId = deleteReplyBtn.dataset.replyId;
                if(opinionId && replyId) handleDeleteReply(opinionId, replyId); return;
            }
        });
    }

});