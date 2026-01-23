import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import firebaseConfig from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Global Variables
let allProperties = [];
let map;
let markersLayer; // LayerGroup to manage markers

// Global Functions
window.sendPadronToWhatsapp = function(event) {
    event.preventDefault();
    const padron = document.getElementById('padron_numero').value;
    const nombre = document.getElementById('padron_nombre').value;
    const telefono = document.getElementById('padron_telefono').value || 'No especificado';
    const phoneNumber = "5492615116458"; 
    const message = `Hola, necesito información sobre el Padrón N°: ${padron}.%0A%0A*Mis Datos:*%0ANombre: ${nombre}%0ATeléfono: ${telefono}`;
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
}

window.toggleAdvancedSearch = function() {
    const filters = document.getElementById('advanced-filters');
    const toggleBtn = document.querySelector('.advanced-toggle span');
    
    if (filters && toggleBtn) {
        if (filters.style.display === 'none') {
            filters.style.display = 'block';
            toggleBtn.innerHTML = 'Menos Filtros <i class="fas fa-chevron-up"></i>';
        } else {
            filters.style.display = 'none';
            toggleBtn.innerHTML = 'Búsqueda Avanzada / Más Filtros <i class="fas fa-chevron-down"></i>';
        }
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    
    // Carousel
    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;
    const slideInterval = 5000;

    if (slides.length > 0) {
        slides[0].classList.add('active');
        if (slides.length > 1) {
            setInterval(() => {
                slides[currentSlide].classList.remove('active');
                currentSlide = (currentSlide + 1) % slides.length;
                slides[currentSlide].classList.add('active');
            }, slideInterval);
        }
    }

    // Initialize Map
    const mapElement = document.getElementById('main-map');
    if (mapElement) {
        map = L.map('main-map').setView([-32.8895, -68.8458], 12); // Mendoza Center
        L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
            attribution: '&copy; Google Maps'
        }).addTo(map);
        markersLayer = L.layerGroup().addTo(map);
    }

    // Load Properties
    await loadProperties();

    // Event Listener for Search Button
    const btnSearch = document.querySelector('.btn-search');
    if (btnSearch) {
        btnSearch.addEventListener('click', function(e) {
            e.preventDefault(); // Prevent form submission reloads if inside form
            filterProperties();
            
            // Scroll to results
            const propertiesSection = document.getElementById('properties-container');
            if (propertiesSection) {
                propertiesSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
});

async function loadProperties() {
    const propertiesContainer = document.getElementById('properties-container');
    if (!propertiesContainer) return;

    try {
        const q = query(collection(db, "propiedades"), orderBy("fechaCreacion", "desc"));
        const querySnapshot = await getDocs(q);
        
        allProperties = [];
        querySnapshot.forEach((doc) => {
            allProperties.push({ id: doc.id, ...doc.data() });
        });

        renderProperties(allProperties);

    } catch (error) {
        console.error("Error fetching properties:", error);
        propertiesContainer.innerHTML = '<p class="error-msg" style="grid-column: 1/-1; text-align: center;">Error al cargar las propiedades. Intente más tarde.</p>';
    }
}

function renderProperties(propertiesToRender) {
    const propertiesContainer = document.getElementById('properties-container');
    propertiesContainer.innerHTML = ''; // Clear current

    // Clear map markers
    if (markersLayer) {
        markersLayer.clearLayers();
    }

    if (propertiesToRender.length === 0) {
        propertiesContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 40px; font-size: 1.1rem;">No se encontraron propiedades con esos criterios.</p>';
        return;
    }

    propertiesToRender.forEach(prop => {
        // 1. Render Card
        const card = document.createElement('article');
        card.className = 'property-card';
        card.style.cursor = 'pointer';
        card.onclick = () => window.open(`property-detail.html?id=${prop.id}`, '_blank');
        
        // Determine Tag Class
        let tagClass = 'sale';
        if (prop.operacion === 'alquiler') tagClass = 'rent';
        
        // Currency Logic
        const priceDisplay = prop.moneda ? `${prop.moneda} ${prop.precio}` : prop.precio;

        card.innerHTML = `
            <div class="card-image">
                <img src="${prop.imagenes.principal}" alt="${prop.titulo}" onerror="this.src='https://via.placeholder.com/800x600?text=No+Image'">
                <span class="tag ${tagClass}">${capitalize(prop.tipo)} en ${capitalize(prop.operacion)}</span>
            </div>
            <div class="card-content">
                <h3>${prop.titulo}</h3>
                <p class="location"><i class="fas fa-map-marker-alt"></i> ${prop.ubicacion}</p>
                <p class="price">${priceDisplay}</p>
                <div class="features">
                    ${prop.ambientes ? `<span><i class="fas fa-home"></i> ${prop.ambientes} Amb</span>` : ''}
                    ${prop.banios ? `<span><i class="fas fa-bath"></i> ${prop.banios}</span>` : ''}
                    ${prop.superficie.total ? `<span><i class="fas fa-ruler-combined"></i> ${prop.superficie.total}m²</span>` : ''}
                </div>
            </div>
        `;
        propertiesContainer.appendChild(card);

        // 2. Add to Map
        if (map && markersLayer && prop.lat && prop.lng) {
            const marker = L.marker([prop.lat, prop.lng]);
            marker.bindPopup(`
                <div style="text-align:center;">
                    <b>${prop.titulo}</b><br>
                    ${priceDisplay}<br>
                    <a href="property-detail.html?id=${prop.id}" target="_blank">Ver detalle</a>
                </div>
            `);
            markersLayer.addLayer(marker);
        }
    });

    // Fit map bounds to show all markers
    if (map && markersLayer.getLayers().length > 0) {
        const group = new L.featureGroup(markersLayer.getLayers());
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function filterProperties() {
    // Get filter values
    const operacion = document.querySelector('select[name="operacion"]').value;
    const tipo = document.querySelector('select[name="tipo"]').value;
    const zonaField = document.querySelector('select[name="zona"]');
    const zona = zonaField ? zonaField.value : '';
    
    // Advanced fields logic could be added here
    
    const filtered = allProperties.filter(prop => {
        let matches = true;

        if (operacion && prop.operacion !== operacion) matches = false;
        if (tipo && prop.tipo !== tipo) matches = false;
        
        // Zona filtering with backward compatibility
        if (zona) {
            const propZonaNorm = prop.zona ? prop.zona.trim() : '';
            const propUbicacionNorm = prop.ubicacion ? prop.ubicacion.toLowerCase() : '';
            const searchZonaNorm = zona.trim();
            const searchZonaLower = zona.toLowerCase();

            // Match if:
            // 1. prop.zona exists and matches selected zone EXACTLY
            // 2. OR prop.zona is missing/empty AND prop.ubicacion contains the selected zone text
            
            const zonaMatch = (propZonaNorm === searchZonaNorm);
            const textMatch = propUbicacionNorm.includes(searchZonaLower);

            if (!zonaMatch && !textMatch) matches = false;
        }

        return matches;
    });

    renderProperties(filtered);
}

function capitalize(str) {
    if(!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
