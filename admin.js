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
let newGalleryFiles = []; // Cola de archivos nuevos para subir

// Listener para acumular imágenes nuevas
document.getElementById('imgGaleria').addEventListener('change', function(e) {
    if(this.files && this.files.length > 0) {
        Array.from(this.files).forEach(file => {
            // Evitar duplicados exactos (opcional, pero útil)
            // Chequeamos nombre y tamaño
            const duplicate = newGalleryFiles.find(f => f.name === file.name && f.size === file.size);
            if(!duplicate) {
                newGalleryFiles.push(file);
            }
        });
        renderGalleryPreview();
        this.value = ''; // Limpiar input para permitir seleccionar lo mismo u otro lote
    }
});

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

        // Render Previews
        const mainPreview = document.getElementById('previewPrincipal');
        if (mainPreview) {
            if (originalImages.principal) {
                mainPreview.style.display = 'block';
                mainPreview.innerHTML = `<img src="${originalImages.principal}" style="max-height: 150px; border: 1px solid #ccc; padding: 5px; border-radius: 4px;">`;
            } else {
                mainPreview.style.display = 'none';
            }
        }
        renderGalleryPreview();

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
    newGalleryFiles = []; // Resetear cola de nuevos archivos
    
    // Clear Previews
    const mainPreview = document.getElementById('previewPrincipal');
    if(mainPreview) {
        mainPreview.innerHTML = '';
        mainPreview.style.display = 'none';
    }
    const galPreview = document.getElementById('previewGaleria');
    if(galPreview) galPreview.innerHTML = '';

    document.getElementById('propertyForm').reset();
    document.querySelector('.btn-submit').textContent = 'GUARDAR PROPIEDAD';
    document.getElementById('imgPrincipal').setAttribute('required', 'true');
    
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if(cancelBtn) cancelBtn.style.display = 'none';

    restoreDraft(); // Restaurar el borrador pendiente si lo hubiera
}

// Helper: Render Gallery Previews
function renderGalleryPreview() {
    const container = document.getElementById('previewGaleria');
    if (!container) return;
    container.innerHTML = '';
    // 1. Renderizar imágenes ya existentes (del servidor)
    if (originalImages.galeria && originalImages.galeria.length > 0) {
        originalImages.galeria.forEach((url, index) => {
            const div = document.createElement('div');
            div.style.position = 'relative';
            div.style.width = '100px';
            div.style.height = '120px'; // Un poco mas alto para texto
            div.className = 'gallery-preview-item';

            div.innerHTML = `
                <img src="${url}" style="width:100px; height:100px; object-fit:cover; border:2px solid #2ecc71; border-radius: 4px;">
                <span style="display:block; font-size:10px; text-align:center; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color:#27ae60; font-weight:bold;">Guardada</span>
                <button type="button" onclick="removeGalleryImage(${index})" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border:none; width:20px; height:20px; border-radius:50%; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;" title="Eliminar">&times;</button>
            `;
            container.appendChild(div);
        });
    }

    // 2. Renderizar nuevas imágenes pendientes de subida
    if (newGalleryFiles.length > 0) {
        newGalleryFiles.forEach((file, index) => {
            const tempUrl = URL.createObjectURL(file);
            const ext = file.name.split('.').pop().toUpperCase();
            
            const div = document.createElement('div');
            div.style.position = 'relative';
            div.style.width = '100px';
            div.style.height = '120px';
            div.className = 'gallery-preview-item';

            div.innerHTML = `
                <img src="${tempUrl}" style="width:100px; height:100px; object-fit:cover; border:2px solid #3498db; border-radius: 4px;">
                <span style="display:block; font-size:10px; text-align:center; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; color: #34495e;">${ext}</span>
                <button type="button" onclick="removeNewFile(${index})" style="position:absolute; top:-5px; right:-5px; background:#e74c3c; color:white; border:none; width:20px; height:20px; border-radius:50%; cursor:pointer; font-weight:bold; display:flex; align-items:center; justify-content:center;" title="Quitar de la lista">&times;</button>
            `;
            container.appendChild(div);
        });
    }
}

window.removeGalleryImage = function(index) {
    if (confirm('¿Eliminar esta imagen guardada de la galería?')) {
        originalImages.galeria.splice(index, 1);
        renderGalleryPreview();
    }
}

window.removeNewFile = function(index) {
    // No necesitamos confirmación estricta para borrar algo que aun no se sube, es mas ágil
    newGalleryFiles.splice(index, 1);
    renderGalleryPreview();
}


async function uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    try {
        // Point to the PHP script in the root directory relative to /admin/
        const response = await fetch('../upload.php', {
            method: 'POST',
            body: formData,
            // No añadir headers Content-Type manualmente, fetch lo hace automáticamente con FormData
        });

        let data;
        const responseText = await response.text();
        
        console.log('Server response:', responseText); // Debug
        
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            // Si el servidor devuelve error HTML en vez de JSON
            console.error('Failed to parse JSON. Raw response:', responseText);
            if (!response.ok) {
                throw new Error(`Error del servidor (${response.status}): No se pudo procesar la respuesta. Verifica que upload.php esté correctamente configurado.`);
            }
            throw new Error('Respuesta inválida del servidor. Verifica la consola para más detalles.');
        }

        if (!response.ok) {
            const errorMsg = (data && data.error) ? data.error : `HTTP Error: ${response.status}`;
            throw new Error(errorMsg);
        }
        
        if (data && data.error) {
            throw new Error(data.error);
        }

        if (!data || !data.url) {
            throw new Error('La respuesta del servidor no contiene una URL válida.');
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
        // If editing, start with the surviving original images
        if(isEditing && originalImages.galeria) {
            galleryUrls = [...originalImages.galeria];
        }

        // Usamos newGalleryFiles en lugar de leer el input directamente
        if (newGalleryFiles.length > 0) {
            const uploadPromises = newGalleryFiles.map(file => uploadImage(file));
            const newUrls = await Promise.all(uploadPromises);
            // Append new images to existing ones
            galleryUrls = [...galleryUrls, ...newUrls];
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
            clearDraft(); // Limpiar borrador al guardar exitosamente
        } else {
            // Update
            const propRef = doc(db, "propiedades", editingId);
            await updateDoc(propRef, propertyData);
            console.log("Document updated: ", editingId);
            showMessage("Propiedad actualizada con éxito!", "success");
            window.cancelEdit(); // Reset mode
        }
        
        // Limpiamos todo al terminar correctamente
        propertyForm.reset();
        newGalleryFiles = []; // Important: clear pending files
        renderGalleryPreview(); // Clear preview UI
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

// --- AUTO-SAVE DRAFT FEATURE ---

function saveDraft() {
    if (isEditing) return; // No sobrescribir borrador de nueva propiedad mientras se edita una existente

    const formData = {};
    const elements = propertyForm.elements;

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.id) { // Usamos ID como clave principal
            const key = el.id;
            if (el.type === 'checkbox') {
                formData[key] = el.checked;
            } else if (el.type !== 'file' && el.type !== 'submit' && el.type !== 'button') {
                formData[key] = el.value;
            }
        }
    }
    localStorage.setItem('propertyDraft', JSON.stringify(formData));
}

function restoreDraft() {
    const saved = localStorage.getItem('propertyDraft');
    if (!saved) return;
    
    // Si estamos editando, no restaurar borrador encima
    if (isEditing) return;

    try {
        const formData = JSON.parse(saved);
        const elements = propertyForm.elements;

        for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            const key = el.id;
            if (key && formData.hasOwnProperty(key)) {
                if (el.type === 'checkbox') {
                    el.checked = formData[key];
                } else if (el.type !== 'file') {
                    el.value = formData[key];
                }
            }
        }
        // console.log('Borrador restaurado');
    } catch (e) {
        console.error('Error restaurando borrador', e);
    }
}

function clearDraft() {
    localStorage.removeItem('propertyDraft');
}

// Add listeners for auto-save
propertyForm.addEventListener('input', saveDraft);
propertyForm.addEventListener('change', saveDraft); // For selects and checkboxes

// Restore on load
document.addEventListener('DOMContentLoaded', restoreDraft);
