document.addEventListener('DOMContentLoaded', function() {
    
    // Carousel Logic
    const slides = document.querySelectorAll('.slide');
    let currentSlide = 0;
    const slideInterval = 5000; // 5 seconds

    // Initialize first slide
    if (slides.length > 0) {
        slides[0].classList.add('active');
    }

    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slides.length;
        slides[currentSlide].classList.add('active');
    }

    if (slides.length > 1) {
        setInterval(nextSlide, slideInterval);
    }


    // Search Button Simulation
    const btnSearch = document.querySelector('.btn-search');
    
    if (btnSearch) {
        btnSearch.addEventListener('click', function() {
            const propertiesSection = document.getElementById('propiedades');
            if (propertiesSection) {
                propertiesSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }



});
