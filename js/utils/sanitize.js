'use strict';
(function(global) {
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    global.escapeHtml = escapeHtml;
})(window);
