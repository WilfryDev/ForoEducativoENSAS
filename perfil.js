// perfil.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Reutiliza tu configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCziZFNaaTxDMlANX3GybGBEy76mrtAOa4",
  authDomain: "foro-ensas-2025.firebaseapp.com",
  projectId: "foro-ensas-2025",
  storageBucket: "foro-ensas-2025.firebasestorage.app",
  messagingSenderId: "744648047081",
  appId: "1:744648047081:web:43a2ec14b6812fe8ec3378",
  measurementId: "G-QCVKV2MH1L"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Variables globales para el tema
let currentTheme = localStorage.getItem('theme') || 'dark';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos del DOM
    const profileForm = document.getElementById('profile-edit-form');
    const profileNameInput = document.getElementById('profile-name-edit');
    const loadingMessage = document.getElementById('loading-message');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeToggleIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

    // --- Lógica del Tema (copiada de script.js) ---
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        if (themeToggleIcon) {
            themeToggleIcon.classList.toggle('fa-moon', theme === 'light');
            themeToggleIcon.classList.toggle('fa-sun', theme === 'dark');
        }
        localStorage.setItem('theme', theme);
        currentTheme = theme;
    };
    applyTheme(currentTheme); // Aplica tema al cargar
     if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
        });
    }

    // --- Lógica de Autenticación y Perfil ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Usuario logueado: Muestra el formulario y oculta "Cargando..."
            if (profileNameInput) {
                profileNameInput.value = user.displayName || ''; // Carga el nombre actual
            }
            if (loadingMessage) loadingMessage.classList.add('hidden');
            if (profileForm) profileForm.classList.remove('hidden');

        } else {
            // Usuario NO logueado: Redirige al inicio o muestra mensaje
            if (loadingMessage) loadingMessage.textContent = 'Debes iniciar sesión para editar tu perfil.';
            if (profileForm) profileForm.classList.add('hidden');
            // Opcional: Redirigir al index.html después de unos segundos
            // setTimeout(() => { window.location.href = 'index.html'; }, 3000);
        }
    });

    // --- Manejar envío del formulario ---
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = profileNameInput ? profileNameInput.value.trim() : '';
            const user = auth.currentUser; // Obtener el usuario actual

            if (!user) {
                alert('No estás conectado. Por favor, inicia sesión.');
                return;
            }
            if (!newName) {
                alert('El nombre no puede estar vacío.');
                return;
            }

            const submitButton = profileForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Guardando...';
            }

            try {
                // Actualiza el perfil en Firebase Auth
                await updateProfile(user, {
                    displayName: newName
                });
                alert('Nombre actualizado correctamente.');
                // Opcional: Redirigir de vuelta al foro
                // window.location.href = 'index.html';

            } catch (error) {
                console.error("Error al actualizar perfil:", error);
                alert('Hubo un error al guardar los cambios.');
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Guardar Cambios';
                }
            }
        });
    }

}); 