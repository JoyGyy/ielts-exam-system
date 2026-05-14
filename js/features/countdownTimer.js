/**
 * 倒计时模考计时器
 * 阅读：60分钟，听力：30分钟
 */
(function () {
  'use strict';

  function CountdownTimer(options) {
    options = options || {};
    this.duration = options.duration || 3600; // default 60 minutes
    this.remaining = this.duration;
    this.isRunning = false;
    this.onTick = options.onTick || function () {};
    this.onComplete = options.onComplete || function () {};
    this.onWarning = options.onWarning || function () {};
    this.intervalId = null;
    this.warningThreshold = 300; // last 5 minutes
  }

  CountdownTimer.prototype.start = function () {
    if (this.isRunning) return;
    this.isRunning = true;
    var self = this;
    this.intervalId = setInterval(function () {
      self.tick();
    }, 1000);
  };

  CountdownTimer.prototype.stop = function () {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  };

  CountdownTimer.prototype.tick = function () {
    this.remaining--;
    this.onTick(this.remaining);

    if (this.remaining <= this.warningThreshold && this.remaining > 0) {
      this.onWarning(this.remaining);
    }

    if (this.remaining <= 0) {
      this.stop();
      this.onComplete();
    }
  };

  CountdownTimer.prototype.reset = function (duration) {
    this.stop();
    this.duration = duration || this.duration;
    this.remaining = this.duration;
  };

  CountdownTimer.prototype.getDisplayTime = function () {
    var minutes = Math.floor(this.remaining / 60);
    var seconds = this.remaining % 60;
    return (
      String(minutes).padStart(2, '0') +
      ':' +
      String(seconds).padStart(2, '0')
    );
  };

  function createCountdownUI(timer) {
    var container = document.createElement('div');
    container.className = 'countdown-timer';
    container.innerHTML =
      '<div class="countdown-timer__display">' +
      '<span class="countdown-timer__time">' + timer.getDisplayTime() + '</span>' +
      '<span class="countdown-timer__label">剩余时间</span>' +
      '</div>' +
      '<button class="countdown-timer__submit">提前提交</button>';

    timer.onTick = function (remaining) {
      var timeEl = container.querySelector('.countdown-timer__time');
      if (timeEl) {
        timeEl.textContent = timer.getDisplayTime();
      }
      if (remaining <= timer.warningThreshold) {
        container.classList.add('countdown-timer--warning');
      }
    };

    container.querySelector('.countdown-timer__submit').addEventListener('click', function () {
      if (confirm('确定要提前提交吗？')) {
        timer.stop();
        timer.onComplete();
      }
    });

    return container;
  }

  // Expose as globals (matches project's IIFE pattern)
  window.CountdownTimer = CountdownTimer;
  window.createCountdownUI = createCountdownUI;
})();
