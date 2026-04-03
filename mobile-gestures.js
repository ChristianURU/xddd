/**
 * Mobile Gestures for Community Panel
 * Handles Swipe-to-Close (Left to Right)
 * V5: Floating Card Support
 */

/**
 * Mobile Gestures for Community Panel
 * Handles Swipe-to-Close
 * Mobile: Swipe Down
 * Desktop: Swipe Right
 */

/**
 * Mobile Gestures for Community Panel
 * Handles Swipe-to-Close (Left to Right)
 * Works for both Mobile & Desktop side panels
 */

(function () {
    function initGestures() {
        const panel = document.getElementById('community-panel');
        if (!panel) return;

        let startX = 0;
        let startY = 0;
        let isDragging = false;
        let isScroll = false;
        const threshold = 60; // Threshold to trigger close

        // Helper: Check for horizontal scroll areas (e.g. carousels)
        const isHorizontalScrollArea = (target) => {
            let el = target;
            while (el && el !== panel && el !== document.body) {
                const style = window.getComputedStyle(el);
                if ((style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
                    return true;
                }
                el = el.parentElement;
            }
            return false;
        };

        panel.addEventListener('touchstart', (e) => {
            if (panel.classList.contains('closed')) return;
            if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName)) return;
            if (isHorizontalScrollArea(e.target)) return;

            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isDragging = true;
            isScroll = false;

            // Remove transition for immediate drag response
            panel.style.transition = 'none';
        }, { passive: true });

        panel.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            if (isScroll) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;

            const deltaX = currentX - startX;
            const deltaY = Math.abs(currentY - startY);

            // Intent Check: Vertical Scroll vs Horizontal Swipe
            // If vertical movement is dominant, let native scroll happen
            if (deltaY > Math.abs(deltaX)) {
                isScroll = true;
                return; // Let native scroll happen
            }

            // If dragging RIGHT (Closing direction)
            if (deltaX > 0) {
                if (e.cancelable) e.preventDefault(); // Prevent browser back navigation

                // Visual feedback: Move panel with finger
                panel.style.transform = `translateX(${deltaX}px)`;
            }
        }, { passive: false });

        panel.addEventListener('touchend', (e) => {
            if (!isDragging) return;
            isDragging = false;

            // Restore smooth transition
            panel.style.transition = `transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)`;

            const currentX = e.changedTouches[0].clientX;
            const deltaX = currentX - startX;

            // If dragged right enough and wasn't scrolling
            if (deltaX > threshold && !isScroll) {
                // Close Panel
                if (typeof window.toggleCommunity === 'function') {
                    window.toggleCommunity(true); // Force close
                } else {
                    panel.classList.add('closed');
                }
                // Clear inline style
                setTimeout(() => { panel.style.transform = ''; }, 300);
            } else {
                // Bounce back to open
                requestAnimationFrame(() => {
                    panel.style.transform = '';
                });
            }
        }, { passive: true });

        // Prevent map interaction through the panel
        // (Just in case CSS touch-action isn't enough for pinch-zoom etc)
        const stopProp = (e) => e.stopPropagation();
        ['click', 'dblclick', 'mousedown', 'wheel'].forEach(evt => {
            panel.addEventListener(evt, stopProp);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGestures);
    } else {
        initGestures();
    }
})();
