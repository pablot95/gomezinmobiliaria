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

        // Badge Logic
        let badgeHtml = '';
        if (prop.estado && prop.estado !== 'disponible') {
            let badgeColor = '#28a745'; // Default (shouldnt happen if not available)
            if (prop.estado === 'reservado') badgeColor = '#e67e22';
            if (prop.estado === 'vendido') badgeColor = '#dc3545';
            
            badgeHtml = `<span style="position: absolute; top: 10px; right: 10px; background: ${badgeColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; text-transform: uppercase; z-index: 5; font-weight: bold; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                ${prop.estado}
            </span>`;
        }

        card.innerHTML = `
            <div class="card-image" style="position: relative;">
                ${badgeHtml}
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

// Filter Properties
window.filterProperties = function() {
    // Basic filters
    const operacion = document.querySelector('select[name="operacion"]').value;
    const tipo = document.querySelector('select[name="tipo"]').value;
    const zonaField = document.querySelector('select[name="zona"]');
    const zona = zonaField ? zonaField.value : '';

    // Advanced filters
    const moneda = document.querySelector('select[name="moneda"]')?.value;
    
    // Helper for number inputs
    const getNum = (name) => {
        const el = document.querySelector(`input[name="${name}"]`);
        return el && el.value ? parseFloat(el.value) : null;
    };

    const precioDesde = getNum('precio_desde') || 0;
    const precioHasta = getNum('precio_hasta') || Infinity;
    
    const ambientes = getNum('ambientes') || 0;
    const dormitorios = getNum('dormitorios') || 0;
    const banios = getNum('banios') || 0;
    const cocheras = getNum('cocheras') || 0;

    const supCubDesde = getNum('sup_cub_desde') || 0;
    const supCubHasta = getNum('sup_cub_hasta') || Infinity;
    const supTotDesde = getNum('sup_tot_desde') || 0;
    const supTotHasta = getNum('sup_tot_hasta') || Infinity;

    // Checkboxes (Characteristics)
    const getCheck = (name) => {
        const el = document.querySelector(`input[name="${name}"]`);
        return el ? el.checked : false;
    };

    const aptoMascota = getCheck('mascota');
    const aptoProfesional = getCheck('profesional');
    const usoComercial = getCheck('comercial');
    const aptoCredito = getCheck('credito');

    // Servicios
    const agua = getCheck('agua');
    const luz = getCheck('luz');
    const gas = getCheck('gas');
    const cloacas = getCheck('cloacas');
    const internet = getCheck('internet');
    const pavimento = getCheck('pavimento');

    // Comodidades
    const pileta = getCheck('pileta');
    const parrilla = getCheck('parrilla');
    const quincho = getCheck('quincho');
    const sum = getCheck('sum');
    const seguridad = getCheck('seguridad');
    const checkCochera = getCheck('check_cochera');

    const filtered = allProperties.filter(prop => {
        let matches = true;

        // Basic
        if (operacion && prop.operacion !== operacion) matches = false;
        if (tipo && prop.tipo !== tipo) matches = false;
        
        // Zona
        if (zona) {
            const propZonaNorm = prop.zona ? prop.zona.trim() : '';
            const propUbicacionNorm = prop.ubicacion ? prop.ubicacion.toLowerCase() : '';
            const searchZonaNorm = zona.trim();
            const searchZonaLower = zona.toLowerCase();
            const zonaMatch = (propZonaNorm === searchZonaNorm);
            const textMatch = propUbicacionNorm.includes(searchZonaLower);
            if (!zonaMatch && !textMatch) matches = false;
        }

        // --- Advanced Filters ---
        
        // Moneda
        if (moneda && prop.moneda !== moneda) matches = false;

        // Precio
        const propPrecio = parseFloat(prop.precio);
        if (!isNaN(propPrecio)) {
            if (propPrecio < precioDesde) matches = false;
            if (precioHasta !== Infinity && propPrecio > precioHasta) matches = false;
        }

        // Ambientes / Dormitorios / Baños / Cocheras (Minimum check)
        if (ambientes > 0 && (!prop.ambientes || parseInt(prop.ambientes) < ambientes)) matches = false;
        if (dormitorios > 0 && (!prop.dormitorios || parseInt(prop.dormitorios) < dormitorios)) matches = false;
        if (banios > 0 && (!prop.banios || parseInt(prop.banios) < banios)) matches = false;
        if (cocheras > 0 && (!prop.cocheras || parseInt(prop.cocheras) < cocheras)) matches = false;

        // Superficie
        // Logic: If filter is set, Property MUST have surface data and match range
        if (prop.superficie) {
            const propSupCub = parseFloat(prop.superficie.cubierta);
            const propSupTot = parseFloat(prop.superficie.total);

            // Covered
            if (supCubDesde > 0 || supCubHasta !== Infinity) {
                if(isNaN(propSupCub)) matches = false;
                else {
                    if (propSupCub < supCubDesde) matches = false;
                    if (propSupCub > supCubHasta) matches = false;
                }
            }

            // Total
            if (supTotDesde > 0 || supTotHasta !== Infinity) {
                if(isNaN(propSupTot)) matches = false;
                else {
                    if (propSupTot < supTotDesde) matches = false;
                    if (propSupTot > supTotHasta) matches = false;
                }
            }

        } else {
            // Prop has no surface object. If filters active, exclude.
            if (supCubDesde > 0 || supCubHasta !== Infinity || supTotDesde > 0 || supTotHasta !== Infinity) matches = false;
        }

        // Checkboxes Logic
        // We handle missing 'caracteristicas' or missing keys by assuming false if filter is checked
        if (prop.caracteristicas) {
            if (aptoMascota && !prop.caracteristicas.mascotas) matches = false; // Key might be mascotas
            if (aptoProfesional && !prop.caracteristicas.profesional) matches = false;
            if (usoComercial && !prop.caracteristicas.comercial) matches = false;
            if (aptoCredito && !prop.caracteristicas.credito) matches = false;

            if (agua && !prop.caracteristicas.agua) matches = false;
            if (luz && !prop.caracteristicas.luz) matches = false;
            if (gas && !prop.caracteristicas.gas) matches = false;
            if (cloacas && !prop.caracteristicas.cloacas) matches = false;
            if (internet && !prop.caracteristicas.internet) matches = false;
            if (pavimento && !prop.caracteristicas.pavimento) matches = false;

            if (pileta && !prop.caracteristicas.pileta) matches = false;
            if (parrilla && !prop.caracteristicas.parrilla) matches = false;
            if (quincho && !prop.caracteristicas.quincho) matches = false;
            if (sum && !prop.caracteristicas.sum) matches = false;
            if (seguridad && !prop.caracteristicas.seguridad) matches = false;
            
            // Special Case: Cochera Checkbox. 
            // Checks if property has "cochera" characteristic OR has numeric cocheras > 0
            if (checkCochera) {
                const hasCocheraFeat = !!prop.caracteristicas.cochera;
                const hasCocheraNum = prop.cocheras && parseInt(prop.cocheras) > 0;
                if (!hasCocheraFeat && !hasCocheraNum) matches = false; 
            }

        } else {
            // If checking for a characteristic but prop has none, exclude
            if (aptoMascota || aptoProfesional || usoComercial || aptoCredito || 
                agua || luz || gas || cloacas || internet || pavimento ||
                pileta || parrilla || quincho || sum || seguridad || checkCochera) {
                matches = false;
            }
        }

        return matches;
    });

    renderProperties(filtered);
    
    // Auto collapse advanced filters
    const filters = document.getElementById('advanced-filters');
    const toggleBtn = document.querySelector('.advanced-toggle span');
    if (filters && filters.style.display !== 'none') {
        filters.style.display = 'none';
        if (toggleBtn) {
            toggleBtn.innerHTML = 'Búsqueda Avanzada / Más Filtros <i class="fas fa-chevron-down"></i>';
        }
    }

    // Auto Scroll to results if coming from button
    const container = document.getElementById('properties-container');
    if(container) {
        // Only scroll if we are not already viewing it (simple check)
        const rect = container.getBoundingClientRect();
        if(rect.top < 0 || rect.top > window.innerHeight) {
             container.scrollIntoView({ behavior: 'smooth' });
        }
    }
}

function capitalize(str) {
    if(!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Mobile Menu Toggle
window.toggleMenu = function() {
    const nav = document.getElementById('main-nav');
    nav.classList.toggle('active');
}

window.closeMenu = function() {
    const nav = document.getElementById('main-nav');
    if(nav.classList.contains('active')) {
        nav.classList.remove('active');
    }
}
