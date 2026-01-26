import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const propertyForm = document.getElementById('propertyForm');
const messageDiv = document.getElementById('message');
const listContainer = document.getElementById('propertiesList');

// Load properties on start
document.addEventListener('DOMContentLoaded', loadProperties);

async function loadProperties() {
    listContainer.innerHTML = 'Cargando propiedades...';
    try {
        const querySnapshot = await getDocs(collection(db, "propiedades"));
        if(querySnapshot.empty) {
            listContainer.innerHTML = '<p>No hay propiedades cargadas.</p>';
            return;
        }

        listContainer.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const item = document.createElement('div');
            item.className = 'property-item';
            item.innerHTML = `
                <div class="property-info">
                    <strong>${data.titulo}</strong>
                    <span>${data.tipo} en ${data.operacion} - ${data.ubicacion}</span>
                </div>
                <button class="btn-delete" onclick="deleteProperty('${id}')">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            `;
            listContainer.appendChild(item);
        });
    } catch (error) {
        console.error("Error loading properties:", error);
        listContainer.innerHTML = '<p style="color:red">Error al cargar listado.</p>';
    }
}

window.deleteProperty = async function(id) {
    if(!confirm('¿Estás seguro de que quieres eliminar esta propiedad? Esta acción no se puede deshacer.')) return;
    
    try {
        await deleteDoc(doc(db, "propiedades", id));
        // We ideally should delete images too, but we need the paths. 
        // For now, removing the doc is the critical part to hide it.
        // If we wanted to delete images, we would need to read the doc first, get URLs, convert to refs, and delete Object.
        
        loadProperties(); // Reload list
        alert('Propiedad eliminada correctamente');
    } catch (e) {
        console.error("Error deleting: ", e);
        alert('Error al eliminar: ' + e.message);
    }
}

async function uploadImage(file) {
    const fileName = `${Date.now()}_${file.name}`;
    // Create a reference to 'images/mountains.jpg'
    const storageRef = ref(storage, 'propiedades/' + fileName);
    
    // Upload file
    await uploadBytes(storageRef, file);
    
    // Get URL
    return await getDownloadURL(storageRef);
}

propertyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Subiendo imágenes y guardando...';
    messageDiv.style.display = 'none';

    try {
        // 1. Upload Images
        const mainImageFile = document.getElementById('imgPrincipal').files[0];
        const galleryFiles = document.getElementById('imgGaleria').files;
        
        if (!mainImageFile) throw new Error("Debes seleccionar una imagen principal");

        // Upload Main
        const mainImageUrl = await uploadImage(mainImageFile);

        // Upload Gallery
        let galleryUrls = [];
        if (galleryFiles.length > 0) {
            const uploadPromises = Array.from(galleryFiles).map(file => uploadImage(file));
            galleryUrls = await Promise.all(uploadPromises);
        }

        // 2. Prepare Data
        const propertyData = {
            titulo: document.getElementById('titulo').value,
            operacion: document.getElementById('operacion').value,
            tipo: document.getElementById('tipo').value,
            moneda: document.getElementById('moneda').value,
            precio: document.getElementById('precio').value,
            expensas: document.getElementById('expensas').value,
            zona: document.getElementById('zona').value,
            ubicacion: document.getElementById('ubicacion').value,
            lat: parseFloat(document.getElementById('lat').value),
            lng: parseFloat(document.getElementById('lng').value),
            superficie: {
                total: document.getElementById('supTotal').value,
                cubierta: document.getElementById('supCubierta').value
            },
            ambientes: document.getElementById('ambientes').value,
            dormitorios: document.getElementById('dormitorios').value,
            banios: document.getElementById('banios').value,
            cocheras: document.getElementById('cocheras').value,
            antiguedad: document.getElementById('antiguedad').value,
            caracteristicas: {
                agua: document.getElementById('agua').checked,
                luz: document.getElementById('luz').checked,
                gas: document.getElementById('gas').checked,
                gas_envasado: document.getElementById('gas_envasado').checked,
                cloacas: document.getElementById('cloacas').checked,
                internet: document.getElementById('internet').checked,
                pavimento: document.getElementById('pavimento').checked,
                pileta: document.getElementById('pileta').checked,
                parrilla: document.getElementById('parrilla').checked,
                jardin: document.getElementById('jardin').checked,
                seguridad: document.getElementById('seguridad').checked,
                mascotas: document.getElementById('mascotas').checked,
                profesional: document.getElementById('profesional').checked,
                escritura: document.getElementById('escritura').checked,
                planos: document.getElementById('planos').checked
            },
            imagenes: {
                principal: mainImageUrl,
                galeria: galleryUrls
            },
            descripcion: document.getElementById('descripcion').value,
            fechaCreacion: new Date()
        };

        // 3. Save to Firestore
        const docRef = await addDoc(collection(db, "propiedades"), propertyData);
        
        console.log("Document written with ID: ", docRef.id);
        
        showMessage("Propiedad guardada con éxito!", "success");
        propertyForm.reset();
        loadProperties(); // Refresh list after add

    } catch (e) {
        console.error("Error adding document: ", e);
        showMessage("Error: " + e.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'GUARDAR PROPIEDAD';
    }
});

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.style.display = 'block';
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}
