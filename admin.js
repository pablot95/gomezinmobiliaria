import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, updateDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
// Storage import removed for Hostinger PHP upload script
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// const storage = getStorage(app); // Not used anymore

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
            
            const status = data.estado || 'disponible';
            
            item.innerHTML = `
                <div class="property-info">
                    <strong>${data.titulo}</strong>
                    <span>${data.tipo} en ${data.operacion} - ${data.ubicacion}</span>
                    <div style="margin-top: 5px;">
                        <label style="font-size:0.9rem; margin-right:5px;">Estado:</label>
                        <select onchange="updatePropStatus('${id}', this.value)" style="padding:4px; border-radius:4px; border:1px solid #ccc;">
                            <option value="disponible" ${status === 'disponible' ? 'selected' : ''}>Disponible</option>
                            <option value="reservado" ${status === 'reservado' ? 'selected' : ''}>Reservada</option>
                            <option value="vendido" ${status === 'vendido' ? 'selected' : ''}>Vendida</option>
                        </select>
                    </div>
                </div>
                <div style="display:flex; gap:5px;">
                    <button onclick="editProperty('${id}')" style="background:#f39c12; color:white; border:none; padding:8px 15px; border-radius:4px; cursor:pointer;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-delete" onclick="deleteProperty('${id}')">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
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

window.updatePropStatus = async function(id, newStatus) {
    try {
        const propRef = doc(db, "propiedades", id);
        await updateDoc(propRef, {
            estado: newStatus
        });
        // Optional: show small feedback
        // alert(`Estado actualizado a ${newStatus}`);
    } catch (e) {
        console.error("Error updating status:", e);
        alert("Error al actualizar estado: " + e.message);
    }
}

// EDIT LOGIC
let isEditing = false;
let editingId = null;
let originalImages = { principal: null, galeria: [], video: null };

window.editProperty = async function(id) {
    try {
        const docSnap = await getDoc(doc(db, "propiedades", id));
        if(!docSnap.exists()) return alert("La propiedad no existe");
        const data = docSnap.data();

        // Populate Fields
        document.getElementById('titulo').value = data.titulo || '';
        document.getElementById('operacion').value = data.operacion || 'venta';
        document.getElementById('tipo').value = data.tipo || 'casa';
        document.getElementById('moneda').value = data.moneda || 'USD';
        document.getElementById('precio').value = data.precio || '';
        document.getElementById('expensas').value = data.expensas || '';
        document.getElementById('zona').value = data.zona || '';
        document.getElementById('ubicacion').value = data.ubicacion || '';
        document.getElementById('lat').value = data.lat || '';
        document.getElementById('lng').value = data.lng || '';
        
        // Superficie
        if(data.superficie) {
            document.getElementById('supTotal').value = data.superficie.total || '';
            document.getElementById('supCubierta').value = data.superficie.cubierta || '';
            document.getElementById('frente').value = data.superficie.frente || '';
            document.getElementById('fondo').value = data.superficie.fondo || '';
        }
        
        document.getElementById('ambientes').value = data.ambientes || '';
        document.getElementById('dormitorios').value = data.dormitorios || '';
        document.getElementById('banios').value = data.banios || '';
        document.getElementById('cocheras').value = data.cocheras || '';
        document.getElementById('antiguedad').value = data.antiguedad || '';

        // New Layout Fields
        document.getElementById('codigo').value = data.codigo || '';
        document.getElementById('condicion').value = data.condicion || '';
        if(data.situacion) document.getElementById('situacion').value = data.situacion;
        if(data.orientacion) document.getElementById('orientacion').value = data.orientacion;
        if(data.plantas) document.getElementById('plantas').value = data.plantas;

        document.getElementById('descripcion').value = data.descripcion || '';

        // Checkboxes
        if(data.caracteristicas) {
            for(const [key, val] of Object.entries(data.caracteristicas)) {
                const el = document.getElementById(key);
                if(el) el.checked = val;
            }
        }

        // Store Original Images
        originalImages.principal = data.imagenes?.principal || null;
        originalImages.galeria = data.imagenes?.galeria || [];
        originalImages.video = data.video || null;

        // UI Mode
        isEditing = true;
        editingId = id;
        document.querySelector('.btn-submit').textContent = 'ACTUALIZAR PROPIEDAD';
        document.getElementById('imgPrincipal').removeAttribute('required');
        document.getElementById('descripcion').removeAttribute('required'); // Just in case
        
        document.getElementById('propertyForm').scrollIntoView({behavior: 'smooth'});

        // Cancel Button
        let cancelBtn = document.getElementById('btn-cancel-edit');
        if(!cancelBtn) {
           cancelBtn = document.createElement('button');
           cancelBtn.id = 'btn-cancel-edit';
           cancelBtn.type = 'button';
           cancelBtn.textContent = 'CANCELAR EDICIÓN';
           cancelBtn.style.cssText = "background: #777; color: #fff; border: none; padding: 15px 30px; font-size: 1.1rem; margin-top: 10px; width: 100%; cursor: pointer;";
           cancelBtn.onclick = window.cancelEdit;
           document.querySelector('.btn-submit').after(cancelBtn);
        }
        cancelBtn.style.display = 'block';

    } catch(e) {
        console.error(e);
        alert("Error al cargar datos para editar.");
    }
}

window.cancelEdit = function() {
    isEditing = false;
    editingId = null;
    originalImages = { principal: null, galeria: [], video: null };
    
    document.getElementById('propertyForm').reset();
    document.querySelector('.btn-submit').textContent = 'GUARDAR PROPIEDAD';
    document.getElementById('imgPrincipal').setAttribute('required', 'true');
    
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if(cancelBtn) cancelBtn.style.display = 'none';
}

async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    try {
        // Point to the PHP script in the root directory relative to /admin/
        const response = await fetch('../upload.php', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        return data.url;
    } catch (error) {
        console.error('Error uploading image to Hostinger:', error);
        throw error;
    }
}

propertyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.querySelector('.btn-submit');
    submitBtn.disabled = true;
    submitBtn.textContent = isEditing ? 'Actualizando...' : 'Subiendo imágenes y guardando...';
    messageDiv.style.display = 'none';

    try {
        // 1. Upload Images
        const mainImageFile = document.getElementById('imgPrincipal').files[0];
        const galleryFiles = document.getElementById('imgGaleria').files;
        const videoFile = document.getElementById('videoFile').files[0];
        
        // Main Image Logic
        let mainImageUrl = null;
        if (mainImageFile) {
            mainImageUrl = await uploadImage(mainImageFile);
        } else {
            if(isEditing && originalImages.principal) {
                mainImageUrl = originalImages.principal;
            } else {
                throw new Error("Debes seleccionar una imagen principal");
            }
        }

        // Gallery Logic
        let galleryUrls = [];
        if (galleryFiles.length > 0) {
            const uploadPromises = Array.from(galleryFiles).map(file => uploadImage(file));
            galleryUrls = await Promise.all(uploadPromises);
            
            // If editing, we might want to Append or Replace? 
            // For simplicity, if new files are selected, we ADD them to existing ones?
            // OR we replace completely? Usually users expect specific control.
            // Let's APPEND for now if editing, unless user cleared them? No way to clear in file input.
            // Let's just Replace logic -> If files selected, use new files. 
            // WAIT, if specific logic needed: "If you select files, they replace old ones" is safer for "modifying"
            // But if I want to add... 
            // Let's decide: If new files uploaded, they become the gallery. If no files, keep old.
        } else {
            if(isEditing) galleryUrls = originalImages.galeria;
        }

        // Video Logic
        let videoUrl = null;
        if (videoFile) {
            videoUrl = await uploadImage(videoFile);
        } else {
            if(isEditing) videoUrl = originalImages.video;
        }

        // 2. Prepare Data
        const propertyData = {
            codigo: document.getElementById('codigo').value,
            // Estado logic: If editing, keep existing status (we don't want to reset to available)
            // But we don't have existing status in form... 
            // We should probably fetch it or not update it here?
            // If we are updating, we should read the current status? Or just don't include it in update?
            // If I include 'estado': 'disponible' it resets.
            // I'll handle it below.
            
            condicion: document.getElementById('condicion').value,
            situacion: document.getElementById('situacion').value,
            orientacion: document.getElementById('orientacion').value,
            plantas: document.getElementById('plantas').value,
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
                cubierta: document.getElementById('supCubierta').value,
                frente: document.getElementById('frente').value,
                fondo: document.getElementById('fondo').value
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
                credito: document.getElementById('credito').checked,
                escritura: document.getElementById('escritura').checked,
                planos: document.getElementById('planos').checked,
                // New checks
                plazas: document.getElementById('plazas').checked,
                culturales: document.getElementById('culturales').checked,
                universidad: document.getElementById('universidad').checked,
                secundaria: document.getElementById('secundaria').checked,
                primaria: document.getElementById('primaria').checked
            },
            imagenes: {
                principal: mainImageUrl,
                galeria: galleryUrls
            },
            video: videoUrl,
            descripcion: document.getElementById('descripcion').value
        };

        if(!isEditing) {
            propertyData.fechaCreacion = new Date();
            propertyData.estado = 'disponible';
            
            const docRef = await addDoc(collection(db, "propiedades"), propertyData);
            console.log("Document written with ID: ", docRef.id);
            showMessage("Propiedad guardada con éxito!", "success");
        } else {
            // Update
            const propRef = doc(db, "propiedades", editingId);
            await updateDoc(propRef, propertyData);
            console.log("Document updated: ", editingId);
            showMessage("Propiedad actualizada con éxito!", "success");
            window.cancelEdit(); // Reset mode
        }
        
        propertyForm.reset();
        loadProperties(); // Refresh list

    } catch (e) {
        console.error("Error saving document: ", e);
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
