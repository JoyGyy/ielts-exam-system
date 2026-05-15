// js/animations/toast.js
'use strict';

var Toast = {
    container: null,
    toasts: [],
    maxToasts: 5,
    defaultDuration: 3000,

    init: function() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    },

    show: function(options) {
        if (!this.container) this.init();

        var type = options.type || 'info';
        var message = options.message || '';
        var duration = options.duration !== undefined ? options.duration : this.defaultDuration;
        var closable = options.closable !== undefined ? options.closable : true;

        if (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0]);
        }

        var toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.innerHTML = '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' + this.getIconPath(type) + '</svg><span class="toast-content">' + message + '</span>' + (closable ? '<button class="toast-close" type="button">×</button>' : '');

        if (closable) {
            var closeBtn = toast.querySelector('.toast-close');
            closeBtn.addEventListener('click', function() {
                Toast.remove(toast);
            });
        }

        this.container.appendChild(toast);
        this.toasts.push(toast);

        if (duration > 0) {
            setTimeout(function() {
                Toast.remove(toast);
            }, duration);
        }

        return toast;
    },

    remove: function(toast) {
        if (!toast || !toast.parentNode) return;
        toast.classList.add('hiding');
        toast.addEventListener('animationend', function() {
            toast.remove();
            var index = Toast.toasts.indexOf(toast);
            if (index > -1) {
                Toast.toasts.splice(index, 1);
            }
        });
    },

    getIconPath: function(type) {
        var icons = {
            success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
            error: '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>',
            warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
            info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
        };
        return icons[type] || icons.info;
    },

    success: function(message, options) {
        return this.show(Object.assign({ type: 'success', message: message }, options || {}));
    },

    error: function(message, options) {
        return this.show(Object.assign({ type: 'error', message: message }, options || {}));
    },

    warning: function(message, options) {
        return this.show(Object.assign({ type: 'warning', message: message }, options || {}));
    },

    info: function(message, options) {
        return this.show(Object.assign({ type: 'info', message: message }, options || {}));
    },

    clear: function() {
        for (var i = this.toasts.length - 1; i >= 0; i--) {
            this.remove(this.toasts[i]);
        }
    }
};

window.Toast = Toast;
