(function () {
  var storage = window.storage;
  // Fallback for navigation
  if (typeof window.showView !== 'function') {
    window.showView = function (viewName, resetCategory) {
      if (typeof document === 'undefined') {
        return;
      }
      var normalized = (typeof viewName === 'string' && viewName) ? viewName : 'overview';
      var target = document.getElementById(normalized + '-view');
      if (!target) {
        console.warn('[Fallback] 未找到视图节点:', normalized);
        return;
      }
      Array.prototype.forEach.call(document.querySelectorAll('.view.active'), function (v) {
        v.classList.remove('active');
      });
      target.classList.add('active');

      var controller = null;
      if (typeof window.ensureLegacyNavigationController === 'function') {
        try {
          controller = window.ensureLegacyNavigationController({
            containerSelector: '.main-nav',
            syncOnNavigate: false
          });
        } catch (err) {
          console.warn('[Fallback] 初始化导航控制器失败:', err);
        }
      }

      if (controller && typeof controller.syncActive === 'function') {
        controller.syncActive(normalized);
      } else {
        var navContainer = document.querySelector('.main-nav');
        if (navContainer) {
          Array.prototype.forEach.call(navContainer.querySelectorAll('.nav-btn'), function (btn) {
            btn.classList.remove('active');
          });
          var navButton = navContainer.querySelector('[data-view="' + normalized + '"]');
          if (navButton) {
            navButton.classList.add('active');
          }
        }
      }

      if (normalized === 'browse' && (resetCategory === undefined || resetCategory === true)) {
        window.currentCategory = 'all';
        window.currentExamType = 'all';
        if (typeof window.setBrowseTitle === 'function') { window.setBrowseTitle('题库浏览'); return; }
        var t = document.getElementById('browse-title'); if (t) t.textContent = '题库浏览';
      }
      if (normalized === 'browse' && typeof window.loadExamList === 'function') window.loadExamList();
      if (normalized === 'practice' && typeof window.startPracticeRecordsSyncInBackground === 'function') {
        window.startPracticeRecordsSyncInBackground('practice-view');
      }
      if (normalized === 'practice' && typeof window.ensurePracticeRecordsSync === 'function') {
        window.ensurePracticeRecordsSync('practice-view').catch(function () { });
      }
      if (normalized === 'practice' && typeof window.updatePracticeView === 'function') window.updatePracticeView();
    };
  }

  try {
    if (typeof window.ensureLegacyNavigationController === 'function') {
      window.ensureLegacyNavigationController({
        containerSelector: '.main-nav',
        syncOnNavigate: true,
        onNavigate: function onNavigate(viewName) {
          if (typeof window.showView === 'function') {
            window.showView(viewName);
          }
        }
      });
    } else {
      var navRoot = document.querySelector('.main-nav');
      if (navRoot && !navRoot._legacyNavHandler) {
        var handler = function (event) {
          var button = event.target && event.target.closest ? event.target.closest('.nav-btn[data-view]') : null;
          if (!button || !navRoot.contains(button)) {
            return;
          }
          event.preventDefault();
          var viewName = button.getAttribute('data-view');
          if (viewName && typeof window.showView === 'function') {
            window.showView(viewName);
          }
        };
        navRoot._legacyNavHandler = handler;
        navRoot.addEventListener('click', handler);
      }
    }
  } catch (error) {
    console.warn('[Fallback] 注册导航事件失败:', error);
  }

  var _isLazyProxy = function (fn) {
    if (typeof fn !== 'function') return false;
    var src = Function.prototype.toString.call(fn);
    return fn.name === 'lazyProxy' || src.indexOf('ensureLazyGroup') !== -1 || src.indexOf('AppLazyLoader') !== -1;
  };

  function _fallbackCreateElement(tag, attributes, children) {
    if (typeof document === 'undefined') {
      return null;
    }

    var element = document.createElement(tag);
    var attrs = attributes || {};

    Object.keys(attrs).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) {
        return;
      }

      if (key === 'className') {
        element.className = value;
        return;
      }

      if (key === 'dataset' && typeof value === 'object') {
        Object.keys(value).forEach(function (dataKey) {
          var dataValue = value[dataKey];
          if (dataValue == null) {
            return;
          }
          element.dataset[dataKey] = String(dataValue);
        });
        return;
      }

      if (key === 'ariaHidden') {
        element.setAttribute('aria-hidden', value === true ? 'true' : String(value));
        return;
      }

      if (key === 'ariaLabel') {
        element.setAttribute('aria-label', String(value));
        return;
      }

      element.setAttribute(key, value === true ? '' : String(value));
    });

    var normalizedChildren = Array.isArray(children) ? children : [children];
    normalizedChildren.forEach(function (child) {
      if (child == null) {
        return;
      }
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else if (child instanceof Node) {
        element.appendChild(child);
      }
    });

    return element;
  }

  // Fallback for toast messages
  if (typeof window.showMessage !== 'function') {
    window.showMessage = function (message, type, duration) {
      try {
        var container = document.getElementById('message-container');
        if (!container) {
          container = document.createElement('div');
          container.id = 'message-container';
          container.className = 'message-container';
          document.body.appendChild(container);
        }

        var note = document.createElement('div');
        note.className = 'message ' + (type || 'info');
        var icon = document.createElement('strong');
        var marks = { error: '✖', success: '✔', warning: '⚠️', info: 'ℹ️' };
        icon.textContent = marks[type] || marks.info;
        note.appendChild(icon);
        note.appendChild(document.createTextNode(' ' + (message || '')));
        container.appendChild(note);

        while (container.children.length > 3) {
          container.removeChild(container.firstChild);
        }

        var timeout = typeof duration === 'number' && duration > 0 ? duration : 4000;
        setTimeout(function () {
          note.classList.add('message-leaving');
          setTimeout(function () {
            if (note.parentNode) {
              note.parentNode.removeChild(note);
            }
          }, 320);
        }, timeout);
      } catch (_) { console.log('[Toast]', type || 'info', message); }
    };
  }

  async function ensureDefaultConfig() {
    try {
      var configs = [];
      if (window.storage && storage.get) {
        var maybeConfigs = storage.get('exam_index_configurations', []);
        configs = (maybeConfigs && typeof maybeConfigs.then === 'function') ? await maybeConfigs : maybeConfigs;
      }
      if (!Array.isArray(configs)) configs = [];
      var hasDefault = configs.some(function (c) { return c && c.key === 'exam_index'; });
      if (!hasDefault) {
        var count = Array.isArray(window.examIndex) ? window.examIndex.length : 0;
        configs.push({ name: '默认题库', key: 'exam_index', examCount: count, timestamp: Date.now() });
        if (window.storage && storage.set) {
          try {
            var maybeSetConfigs = storage.set('exam_index_configurations', configs);
            if (maybeSetConfigs && typeof maybeSetConfigs.then === 'function') await maybeSetConfigs;
          } catch (err) {
            console.warn('[Fallback] 无法保存 exam_index_configurations:', err);
          }
        }
        if (window.storage && storage.get) {
          try {
            var currentActive = storage.get('active_exam_index_key');
            currentActive = (currentActive && typeof currentActive.then === 'function') ? await currentActive : currentActive;
            if (!currentActive && window.storage && storage.set) {
              var maybeSetActive = storage.set('active_exam_index_key', 'exam_index');
              if (maybeSetActive && typeof maybeSetActive.then === 'function') await maybeSetActive;
            }
          } catch (activeErr) {
            console.warn('[Fallback] 无法校正 active_exam_index_key:', activeErr);
          }
        }
      }
      return configs;
    } catch (e) {
      console.warn('[Fallback] ensureDefaultConfig 失败:', e);
      return [];
    }
  }

  // Fallback for library config list
  if (typeof window.showLibraryConfigListV2 !== 'function') {
    window.showLibraryConfigListV2 = async function () {
      var configs = [];
      try {
        configs = (window.storage && storage.get) ? await storage.get('exam_index_configurations', []) : [];
      } catch (e) {
        configs = [];
      }
      if (!Array.isArray(configs) || configs.length === 0) {
        configs = await ensureDefaultConfig();
      }
      if (!Array.isArray(configs) || configs.length === 0) {
        if (window.showMessage) showMessage('暂无题库配置记录', 'info');
        return;
      }

      var activeKey = 'exam_index';
      try {
        if (window.storage && storage.get) {
          activeKey = await storage.get('active_exam_index_key', 'exam_index');
        }
      } catch (e) { }

      if (typeof window.renderLibraryConfigList === 'function') {
        window.renderLibraryConfigList({ configs: configs, activeKey: activeKey, allowDelete: true });
        return;
      }

      var container = document.getElementById('settings-view');
      if (!container) { return; }

      if (typeof window.renderLibraryConfigFallback === 'function') {
        window.renderLibraryConfigFallback(container, configs, { activeKey: activeKey });
        return;
      }

      var hostClass = 'library-config-list';
      var host = container.querySelector('.' + hostClass);
      if (!host) { host = document.createElement('div'); host.className = hostClass; container.appendChild(host); }
      while (host.firstChild) { host.removeChild(host.firstChild); }

      var panel = document.createElement('div');
      panel.className = 'library-config-panel';

      var header = document.createElement('div');
      header.className = 'library-config-panel__header';
      var title = document.createElement('h3');
      title.className = 'library-config-panel__title';
      title.textContent = '📚 题库配置列表';
      header.appendChild(title);
      panel.appendChild(header);

      var list = document.createElement('div');
      list.className = 'library-config-panel__list';
      configs.forEach(function (cfg) {
        if (!cfg) return;
        var item = document.createElement('div');
        item.className = 'library-config-panel__item' + (cfg.key === activeKey ? ' library-config-panel__item--active' : '');

        var info = document.createElement('div');
        info.className = 'library-config-panel__info';
        var titleLine = document.createElement('div');
        titleLine.textContent = (cfg.key === 'exam_index' ? '默认题库' : (cfg.name || cfg.key));
        info.appendChild(titleLine);

        var meta = document.createElement('div');
        meta.className = 'library-config-panel__meta';
        try {
          meta.textContent = new Date(cfg.timestamp).toLocaleString() + ' · ' + (cfg.examCount || 0) + ' 个题目';
        } catch (err) {
          meta.textContent = (cfg.examCount || 0) + ' 个题目';
        }
        info.appendChild(meta);

        var actions = document.createElement('div');
        actions.className = 'library-config-panel__actions';
        var switchBtn = document.createElement('button');
        switchBtn.className = 'btn btn-secondary';
        switchBtn.type = 'button';
        switchBtn.dataset.configAction = 'switch';
        switchBtn.dataset.configKey = cfg.key;
        if (cfg.key === activeKey) switchBtn.disabled = true;
        switchBtn.textContent = '切换';
        actions.appendChild(switchBtn);

        if (cfg.key !== 'exam_index') {
          var deleteBtn = document.createElement('button');
          deleteBtn.className = 'btn btn-warning';
          deleteBtn.type = 'button';
          deleteBtn.dataset.configAction = 'delete';
          deleteBtn.dataset.configKey = cfg.key;
          if (cfg.key === activeKey) deleteBtn.disabled = true;
          deleteBtn.textContent = '删除';
          actions.appendChild(deleteBtn);
        }

        item.appendChild(info);
        item.appendChild(actions);
        list.appendChild(item);
      });

      panel.appendChild(list);

      var footer = document.createElement('div');
      footer.className = 'library-config-panel__footer';
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'btn btn-secondary library-config-panel__close';
      closeBtn.dataset.configAction = 'close';
      closeBtn.textContent = '关闭';
      footer.appendChild(closeBtn);
      panel.appendChild(footer);

      host.appendChild(panel);
      host.onclick = function (event) {
        var target = event.target && event.target.closest('[data-config-action]');
        if (!target || !host.contains(target)) return;
        var action = target.dataset.configAction;
        if (action === 'close') { host.remove(); return; }
        if (action === 'switch' && typeof window.switchLibraryConfig === 'function') {
          window.switchLibraryConfig(target.dataset.configKey);
        }
        if (action === 'delete' && typeof window.deleteLibraryConfig === 'function') {
          window.deleteLibraryConfig(target.dataset.configKey);
        }
      };
    };
  }

  // Fallback improved loader modal (only if missing or still lazy proxy)
  if (typeof window.showLibraryLoaderModal !== 'function' || _isLazyProxy(window.showLibraryLoaderModal)) {
    window.showLibraryLoaderModal = function () {
      if (typeof document === 'undefined') {
        return;
      }

      var existing = document.getElementById('library-loader-overlay');
      if (existing && typeof existing.remove === 'function') {
        existing.remove();
      }

      var create = _fallbackCreateElement;
      var ensureArray = function (value) {
        return Array.isArray(value) ? value : [value];
      };

      var createLoaderCard = function (type, title, description, hint) {
        var prefix = type === 'reading' ? 'reading' : 'listening';
        return create('div', {
          className: 'library-loader-card library-loader-card--' + type
        }, [
          create('h3', { className: 'library-loader-card-title' }, title),
          create('p', { className: 'library-loader-card-description' }, description),
          create('div', { className: 'library-loader-actions' }, [
            create('button', {
              type: 'button',
              className: 'btn library-loader-primary',
              id: prefix + '-full-btn',
              dataset: {
                libraryAction: 'trigger-input',
                libraryTarget: prefix + '-full-input'
              }
            }, '全量重载'),
            create('button', {
              type: 'button',
              className: 'btn btn-secondary library-loader-secondary',
              id: prefix + '-inc-btn',
              dataset: {
                libraryAction: 'trigger-input',
                libraryTarget: prefix + '-inc-input'
              }
            }, '增量更新')
          ]),
          create('input', {
            type: 'file',
            id: prefix + '-full-input',
            className: 'library-loader-input',
            multiple: true,
            webkitdirectory: true,
            dataset: {
              libraryType: type,
              libraryMode: 'full'
            }
          }),
          create('input', {
            type: 'file',
            id: prefix + '-inc-input',
            className: 'library-loader-input',
            multiple: true,
            webkitdirectory: true,
            dataset: {
              libraryType: type,
              libraryMode: 'incremental'
            }
          }),
          create('p', { className: 'library-loader-hint' }, hint)
        ]);
      };

      var overlay = create('div', {
        className: 'modal-overlay show library-loader-overlay',
        id: 'library-loader-overlay',
        role: 'dialog',
        ariaModal: 'true',
        ariaLabelledby: 'library-loader-title'
      });

      var modal = create('div', {
        className: 'modal library-loader-modal',
        role: 'document'
      });

      var header = create('div', { className: 'modal-header library-loader-header' }, [
        create('h2', { className: 'modal-title', id: 'library-loader-title' }, '📚 加载题库'),
        create('button', {
          type: 'button',
          className: 'modal-close library-loader-close',
          ariaLabel: '关闭',
          dataset: { libraryAction: 'close' }
        }, '×')
      ]);

      var body = create('div', { className: 'modal-body library-loader-body' }, [
        create('div', { className: 'library-loader-grid' }, [
          createLoaderCard('reading', '📖 阅读题库加载', '支持全量重载与增量更新。请上传包含题目HTML/PDF的根文件夹。', '💡 推荐结构：任意根目录/分类目录/题目目录/HTML 或 PDF'),
          createLoaderCard('listening', '🎧 听力题库加载', '支持全量重载与增量更新。请上传包含题目HTML/PDF/音频的根文件夹。', '💡 建议路径：assets/listening/P3 或 assets/listening/P4')
        ]),
        create('div', { className: 'library-loader-instructions' }, [
          create('div', { className: 'library-loader-instructions-title' }, '📋 操作说明'),
          create('ul', { className: 'library-loader-instructions-list' }, [
            create('li', null, '全量重载会替换当前配置中对应类型（阅读/听力）的全部索引，并保留另一类型原有数据。'),
            create('li', null, '增量更新会将新文件生成的新索引追加到当前配置。若当前为默认配置，则会自动复制为新配置后再追加，确保默认配置不被影响。')
          ])
        ])
      ]);

      var footer = create('div', { className: 'modal-footer library-loader-footer' }, [
        create('button', {
          type: 'button',
          className: 'btn btn-secondary library-loader-close-btn',
          id: 'close-loader',
          dataset: { libraryAction: 'close' }
        }, '关闭')
      ]);

      ensureArray([header, body, footer]).forEach(function (section) {
        if (section) {
          modal.appendChild(section);
        }
      });

      overlay.appendChild(modal);
      if (document.body) {
        document.body.appendChild(overlay);
      }

      var clickHandler = function (event) {
        var target = event.target && event.target.closest ? event.target.closest('[data-library-action]') : null;
        if (!target || !overlay.contains(target)) {
          return;
        }

        var action = target.dataset.libraryAction;
        if (action === 'close') {
          event.preventDefault();
          cleanup();
          return;
        }

        if (action === 'trigger-input') {
          event.preventDefault();
          var targetId = target.dataset.libraryTarget;
          if (!targetId) {
            return;
          }
          var input = overlay.querySelector('#' + targetId);
          if (input) {
            input.click();
          }
        }
      };

      var changeHandler = function (event) {
        var input = event.target && event.target.closest ? event.target.closest('.library-loader-input') : null;
        if (!input || !overlay.contains(input)) {
          return;
        }

        var files = Array.prototype.slice.call(input.files || []);
        if (files.length === 0) {
          return;
        }

        var type = input.dataset.libraryType;
        var mode = input.dataset.libraryMode;
        if (!type || !mode) {
          cleanup();
          return;
        }

        if (typeof Promise === 'undefined') {
          cleanup();
          return;
        }

        var upload = null;
        try {
          if (typeof window.handleLibraryUpload === 'function') {
            upload = window.handleLibraryUpload({ type: type, mode: mode }, files);
          }
        } catch (error) {
          console.error('[Fallback] 处理题库上传失败:', error);
        }

        Promise.resolve(upload).then(function () {
          cleanup();
        }).catch(function (error) {
          console.error('[Fallback] 题库上传流程出错:', error);
          cleanup();
        });
      };

      function cleanup() {
        overlay.removeEventListener('click', clickHandler);
        overlay.removeEventListener('change', changeHandler);
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }

      overlay.addEventListener('click', clickHandler);
      overlay.addEventListener('change', changeHandler);
    };
  }

  if (typeof window.handleLibraryUpload !== 'function') {
    var _cachedDefaultReading = null;
    var _cachedDefaultListening = null;

    async function _fallbackGetActiveLibraryKey() {
      if (typeof window.getActiveLibraryConfigurationKey === 'function') {
        try { return await window.getActiveLibraryConfigurationKey(); } catch (_) { }
      }
      if (storage && storage.get) {
        try {
          var maybeKey = storage.get('active_exam_index_key', 'exam_index');
          var key = (maybeKey && typeof maybeKey.then === 'function') ? await maybeKey : maybeKey;
          return key || 'exam_index';
        } catch (_) { }
      }
      return 'exam_index';
    }

    async function _fallbackSetActiveLibraryKey(key) {
      if (!key) return;
      if (typeof window.setActiveLibraryConfiguration === 'function') {
        try { await window.setActiveLibraryConfiguration(key); return; } catch (_) { }
      }
      if (storage && storage.set) {
        try {
          var maybe = storage.set('active_exam_index_key', key);
          if (maybe && typeof maybe.then === 'function') await maybe;
        } catch (err) {
          console.warn('[Fallback] 无法写入 active_exam_index_key:', err);
        }
      }
    }

    async function _fallbackSaveLibraryConfiguration(name, key, count) {
      var entry = { name: name, key: key, examCount: count, timestamp: Date.now() };
      if (typeof window.saveLibraryConfiguration === 'function') {
        try { await window.saveLibraryConfiguration(name, key, count); return; } catch (_) { }
      }
      if (storage && storage.get && storage.set) {
        try {
          var existing = storage.get('exam_index_configurations', []);
          existing = (existing && typeof existing.then === 'function') ? await existing : existing;
          if (!Array.isArray(existing)) existing = [];
          var idx = existing.findIndex(function (c) { return c && c.key === key; });
          if (idx >= 0) { existing[idx] = entry; } else { existing.push(entry); }
          var maybeSave = storage.set('exam_index_configurations', existing);
          if (maybeSave && typeof maybeSave.then === 'function') await maybeSave;
        } catch (err) {
          console.warn('[Fallback] 保存题库配置失败:', err);
        }
      }
    }

    async function _fallbackSaveIndexForKey(key, list) {
      if (storage && storage.set) {
        var maybe = storage.set(key, list);
        if (maybe && typeof maybe.then === 'function') {
          await maybe;
        }
      } else {
        try { window[key] = list; } catch (_) { }
      }
    }

    async function _fallbackApplyLibraryConfig(key, dataset, options) {
      if (typeof window.applyLibraryConfiguration === 'function') {
        try { return await window.applyLibraryConfiguration(key, dataset, options || {}); } catch (_) { }
      }
      // fallback:直接刷新内存状态与UI
      if (typeof window.setExamIndexState === 'function') {
        try { window.setExamIndexState(dataset); } catch (_) { }
      } else {
        try { window.examIndex = Array.isArray(dataset) ? dataset.slice() : []; } catch (_) { }
      }
      if (options && options.setActive) {
        await _fallbackSetActiveLibraryKey(key);
      }
      try { if (typeof window.updateOverview === 'function') window.updateOverview(); } catch (_) { }
      try {
        if (typeof window.loadExamList === 'function') {
          window.loadExamList();
        }
      } catch (_) { }
      return true;
    }

    function _fallbackDetectFolderPlacement(files, type) {
      var paths = files
        .map(function (f) { return (f && (f.webkitRelativePath || f.name) || '').replace(/\\/g, '/'); })
        .filter(Boolean);
      if (!paths.length) {
        return false;
      }

      var hasQuestionFile = files.some(function (file) {
        var name = file && file.name ? String(file.name).toLowerCase() : '';
        return /\.html?$/.test(name) || /\.pdf$/.test(name);
      });
      if (!hasQuestionFile) {
        return false;
      }

      if (type === 'reading') {
        // Reading 目录命名不应被硬编码限制，只要包含可识别题目文件即视为有效。
        return true;
      }

      // Listening 推荐包含 P3/P4，但不再强依赖固定父目录名（例如 ListeningPractice）。
      return paths.some(function (p) { return /(^|\/)(P3|P4)(\/|$)/i.test(p); }) || hasQuestionFile;
    }

    async function _fallbackBuildIndexFromFiles(files, type, label) {
      var byDir = new Map();

      function normalizeUploadDir(rawDir) {
        return String(rawDir || '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
      }

      function normalizeListeningDir(rawDir) {
        var normalized = normalizeUploadDir(rawDir);
        if (!normalized) return '';

        var segments = normalized.split('/').filter(Boolean);
        if (!segments.length) return normalized;

        // Prefer stable semantic anchors from the scanned folder tree.
        var anchorPatterns = [
          /^listeningpractice$/i,
          /^p[1-4]$/i,
          /^vip$/i
        ];
        var anchorIndex = -1;
        for (var i = 0; i < segments.length; i++) {
          if (anchorPatterns.some(function (re) { return re.test(segments[i]); })) {
            anchorIndex = i;
            break;
          }
        }
        if (anchorIndex >= 0) {
          return segments.slice(anchorIndex).join('/');
        }
        return normalized;
      }

      files.forEach(function (f) {
        var rel = (f.webkitRelativePath || f.name || '').replace(/\\/g, '/');
        var parts = rel.split('/');
        if (parts.length < 2) return;
        var dir = parts.slice(0, parts.length - 1).join('/');
        if (!byDir.has(dir)) byDir.set(dir, []);
        byDir.get(dir).push(f);
      });

      var entries = [];
      var idx = 0;
      byDir.forEach(function (fs, dir) {
        var html = fs.find(function (x) { return x.name.toLowerCase().endsWith('.html'); });
        var pdf = fs.find(function (x) { return x.name.toLowerCase().endsWith('.pdf'); });
        if (!html && !pdf) return;
        var dirName = dir.split('/').pop();
        var title = dirName.replace(/^\d+\.\s*/, '');
        var category = 'P1';
        var m = dir.match(/\b(P1|P2|P3|P4)\b/);
        if (m) category = m[1];
        var normalizedDir = type === 'listening'
          ? normalizeListeningDir(dir)
          : normalizeUploadDir(dir);
        if (!normalizedDir) return;
        var basePath = normalizedDir + '/';
        var id = 'custom_' + type + '_' + Date.now() + '_' + (idx++);
        entries.push({
          id: id,
          title: label ? '[' + label + '] ' + title : title,
          category: category,
          type: type,
          path: basePath,
          filename: html ? html.name : undefined,
          pdfFilename: pdf ? pdf.name : undefined,
          hasHtml: !!html
        });
      });
      return entries;
    }

    async function _fallbackResolveDefault(type) {
      if (type === 'reading' && Array.isArray(_cachedDefaultReading)) {
        return _cachedDefaultReading;
      }
      if (type === 'listening' && Array.isArray(_cachedDefaultListening)) {
        return _cachedDefaultListening;
      }
      var data = [];
      if (type === 'reading' && Array.isArray(window.completeExamIndex)) {
        data = window.completeExamIndex.map(function (e) { return Object.assign({}, e, { type: 'reading' }); });
        _cachedDefaultReading = data.slice();
      }
      if (type === 'listening' && Array.isArray(window.listeningExamIndex)) {
        data = window.listeningExamIndex.map(function (e) { return Object.assign({}, e, { type: 'listening' }); });
        _cachedDefaultListening = data.slice();
      }
      return data;
    }

    window.handleLibraryUpload = async function (options, files) {
      var type = options && options.type;
      var mode = options && options.mode === 'incremental' ? 'incremental' : 'full';
      if (type !== 'reading' && type !== 'listening') {
        window.showMessage && window.showMessage('未知的题库类型', 'error');
        return;
      }
      if (!Array.isArray(files) || files.length === 0) {
        window.showMessage && window.showMessage('请选择包含题目的文件夹', 'warning');
        return;
      }

      var label = '';
      if (mode === 'incremental') {
        try {
          label = prompt('为此次增量更新输入一个文件夹标签', '增量-' + new Date().toISOString().slice(0, 10)) || '';
        } catch (_) { }
        if (label) {
          window.showMessage && window.showMessage('使用标签: ' + label, 'info');
        }
        if (!_fallbackDetectFolderPlacement(files, type)) {
          var proceed = typeof confirm === 'function'
            ? confirm('检测到文件夹结构与推荐示例不一致。\n阅读: 任意根目录/分类目录/题目目录\n听力: 任意根目录下包含 P3 或 P4 子目录\n是否继续?')
            : true;
          if (!proceed) return;
        }
      }

      window.showMessage && window.showMessage('正在解析文件并构建索引...', 'info');
      var additions = await _fallbackBuildIndexFromFiles(files, type, label);
      if (!Array.isArray(additions) || additions.length === 0) {
        window.showMessage && window.showMessage('从所选文件中未检测到任何题目', 'warning');
        return;
      }

      var activeKey = await _fallbackGetActiveLibraryKey();
      var currentIndex = (typeof window.getExamIndexState === 'function')
        ? window.getExamIndexState()
        : (Array.isArray(window.examIndex) ? window.examIndex : []);
      if (storage && storage.get) {
        try {
          var maybeCurrent = storage.get(activeKey, currentIndex);
          currentIndex = (maybeCurrent && typeof maybeCurrent.then === 'function') ? await maybeCurrent : maybeCurrent;
        } catch (_) { }
      }
      if (!Array.isArray(currentIndex)) currentIndex = [];

      var newIndex;
      if (mode === 'full') {
        var others = currentIndex.filter(function (e) { return e && e.type !== type; });
        newIndex = others.concat(additions);
        var otherType = type === 'reading' ? 'listening' : 'reading';
        if (!newIndex.some(function (e) { return e && e.type === otherType; })) {
          var fallbackOthers = await _fallbackResolveDefault(otherType);
          newIndex = newIndex.concat(Array.isArray(fallbackOthers) ? fallbackOthers : []);
        }
      } else {
        var existingKeys = new Set(currentIndex.map(function (e) { return (e.path || '') + '|' + (e.filename || '') + '|' + e.title; }));
        var dedupAdd = additions.filter(function (e) { return !existingKeys.has((e.path || '') + '|' + (e.filename || '') + '|' + e.title); });
        newIndex = currentIndex.concat(dedupAdd);
      }
      if (typeof window.assignExamSequenceNumbers === 'function') {
        try { window.assignExamSequenceNumbers(newIndex); } catch (_) { }
      }

      if (mode === 'full') {
        var targetKey = 'exam_index_' + Date.now();
        var configName = (type === 'reading' ? '阅读' : '听力') + '全量-' + new Date().toLocaleString();
        await _fallbackSaveIndexForKey(targetKey, newIndex);
        var fullPathFallback = (typeof window.loadPathMapForConfiguration === 'function')
          ? await window.loadPathMapForConfiguration(targetKey)
          : null;
        var fullDerivedMap = (typeof window.derivePathMapFromIndex === 'function')
          ? window.derivePathMapFromIndex(newIndex, fullPathFallback)
          : fullPathFallback;
        if (typeof window.savePathMapForConfiguration === 'function') {
          await window.savePathMapForConfiguration(targetKey, newIndex, { overrideMap: fullDerivedMap, setActive: true });
        }
        await _fallbackSaveLibraryConfiguration(configName, targetKey, newIndex.length);
        await _fallbackSetActiveLibraryKey(targetKey);
        try {
          await _fallbackApplyLibraryConfig(targetKey, newIndex, { setActive: true, skipConfigRefresh: false });
          window.showMessage && window.showMessage('新的题库配置已创建并激活', 'success');
        } catch (applyErr) {
          console.warn('[Fallback] 应用新题库失败，尝试刷新页面', applyErr);
          window.showMessage && window.showMessage('新的题库已保存，正在刷新界面...', 'warning');
          setTimeout(function () { try { location.reload(); } catch (_) { } }, 500);
        }
        return;
      }

      var isDefault = activeKey === 'exam_index';
      var targetKeyInc = activeKey;
      var configNameInc = '';
      if (isDefault) {
        targetKeyInc = 'exam_index_' + Date.now();
        configNameInc = (type === 'reading' ? '阅读' : '听力') + '增量-' + new Date().toLocaleString();
        await _fallbackSaveIndexForKey(targetKeyInc, newIndex);
        var incFallback = (typeof window.loadPathMapForConfiguration === 'function')
          ? await window.loadPathMapForConfiguration(targetKeyInc)
          : null;
        var derivedMap = (typeof window.derivePathMapFromIndex === 'function')
          ? window.derivePathMapFromIndex(newIndex, incFallback)
          : incFallback;
        if (typeof window.savePathMapForConfiguration === 'function') {
          await window.savePathMapForConfiguration(targetKeyInc, newIndex, { overrideMap: derivedMap, setActive: true });
        }
        await _fallbackSaveLibraryConfiguration(configNameInc, targetKeyInc, newIndex.length);
        await _fallbackSetActiveLibraryKey(targetKeyInc);
        window.showMessage && window.showMessage('新的题库配置已创建并激活；正在重新加载...', 'success');
        setTimeout(function () { try { location.reload(); } catch (_) { } }, 800);
        return;
      }

      await _fallbackSaveIndexForKey(targetKeyInc, newIndex);
      var targetPathFallback = (typeof window.loadPathMapForConfiguration === 'function')
        ? await window.loadPathMapForConfiguration(targetKeyInc)
        : null;
      var incrementalMap = (typeof window.derivePathMapFromIndex === 'function')
        ? window.derivePathMapFromIndex(newIndex, targetPathFallback)
        : targetPathFallback;
      if (typeof window.savePathMapForConfiguration === 'function') {
        await window.savePathMapForConfiguration(targetKeyInc, newIndex, { overrideMap: incrementalMap, setActive: true });
      }
      await _fallbackSaveLibraryConfiguration((type === 'reading' ? '阅读' : '听力') + '增量-' + new Date().toLocaleString(), targetKeyInc, newIndex.length);
      if (typeof window.setExamIndexState === 'function') {
        window.setExamIndexState(newIndex);
      } else {
        try { window.examIndex = Array.isArray(newIndex) ? newIndex.slice() : []; } catch (_) { }
      }
      try { if (typeof window.updateOverview === 'function') window.updateOverview(); } catch (_) { }
      if (document.getElementById('browse-view') && document.getElementById('browse-view').classList.contains('active') && typeof window.loadExamList === 'function') {
        try { window.loadExamList(); } catch (_) { }
      }
      window.showMessage && window.showMessage('索引已更新；正在刷新界面...', 'success');
    };
  }

  const VALID_INITIAL_VIEWS = ['overview', 'browse', 'practice', 'history', 'settings'];

  function readQueryView() {
    try {
      const search = window.location && window.location.search ? window.location.search : '';
      if (!search) return '';
      const params = new URLSearchParams(search);
      const value = (params.get('view') || '').trim().toLowerCase();
      return value;
    } catch (_) {
      return '';
    }
  }

  function resolveInitialView() {
    const hash = (window.location && window.location.hash) ? window.location.hash.replace(/^#/, '').trim().toLowerCase() : '';
    if (hash && VALID_INITIAL_VIEWS.indexOf(hash) !== -1) {
      return hash;
    }
    const queryView = readQueryView();
    if (queryView && VALID_INITIAL_VIEWS.indexOf(queryView) !== -1) {
      return queryView;
    }
    return 'overview';
  }

  function bootInitialView() {
    const targetView = resolveInitialView();
    if (typeof window.showView === 'function') {
      window.showView(targetView);
      return;
    }
    if (typeof window.app !== 'undefined' && typeof window.app.navigateToView === 'function') {
      window.app.navigateToView(targetView);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootInitialView);
  } else {
    bootInitialView();
  }
})();
