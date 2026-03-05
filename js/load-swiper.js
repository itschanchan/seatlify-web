// SwiperJS CDN loader for seat-planner.html
// This file is auto-generated to inject SwiperJS for the seat slider feature.

(function() {
    // Only inject if not already present
    if (!document.querySelector('link[href*="swiper-bundle.min.css"]')) {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css';
        document.head.appendChild(link);
    }
    if (!document.querySelector('script[src*="swiper-bundle.min.js"]')) {
        var script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js';
        document.body.appendChild(script);
    }
})();
