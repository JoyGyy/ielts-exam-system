// js/animations/ripple.js
'use strict';

var Ripple = {
    init: function(selector) {
        selector = selector || '.btn, .card, .nav-tab';
        var elements = document.querySelectorAll(selector);
        for (var i = 0; i < elements.length; i++) {
            this.attach(elements[i]);
        }
    },

    attach: function(element) {
        if (element.dataset.rippleAttached) return;
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.dataset.rippleAttached = 'true';
        element.addEventListener('click', function(e) {
            Ripple.create(e);
        });
    },

    create: function(event) {
        var element = event.currentTarget;
        var rect = element.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;
        var size = Math.max(rect.width, rect.height) * 2;

        var ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (x - size / 2) + 'px';
        ripple.style.top = (y - size / 2) + 'px';

        var container = element.querySelector('.ripple-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ripple-container';
            element.appendChild(container);
        }

        container.appendChild(ripple);
        ripple.addEventListener('animationend', function() {
            ripple.remove();
        });
    },

    trigger: function(element, x, y) {
        var rect = element.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height) * 2;

        var ripple = document.createElement('span');
        ripple.className = 'ripple';
        ripple.style.width = size + 'px';
        ripple.style.height = size + 'px';
        ripple.style.left = (x - size / 2) + 'px';
        ripple.style.top = (y - size / 2) + 'px';

        var container = element.querySelector('.ripple-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'ripple-container';
            element.appendChild(container);
        }

        container.appendChild(ripple);
        ripple.addEventListener('animationend', function() {
            ripple.remove();
        });
    }
};

window.Ripple = Ripple;
