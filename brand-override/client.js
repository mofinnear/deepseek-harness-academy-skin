/**
 * Browser half of the local DSH logo override — authoring source.
 *
 * `tools/build.mjs` inlines the artwork table where the `__GENERATED_ARTWORK__`
 * marker sits and writes the served bundle to `brand-override/dist/client.js`,
 * which is what `package.json` exports as `./client`. Nothing here may use a
 * relative `import`/`require`: the DSH plugin route serves exactly one script
 * per package, so the bundle has to be self-contained.
 *
 * The bundle occupies the same brand slots the official package owns and shadows
 * it by registering at a lower `priority` (the slot registry renders the lowest
 * priority first, the documented shadowing route for a `single` slot). Nothing
 * inside the signed app bundle is touched, so app updates cannot revert it.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-logo',
  factory(require) {
    var react_jsx_runtime = require('react/jsx-runtime');
    var jsx = react_jsx_runtime.jsx;
    var jsxs = react_jsx_runtime.jsxs;
    var Fragment = react_jsx_runtime.Fragment;

    /* __GENERATED_ARTWORK__ */

    var SKIN_STORAGE_KEY = 'dsh.local.anime-academy-skin';
    var SKIN_STAGE_STORAGE_KEY = 'dsh.local.anime-academy-stage';
    var SKIN_EXPRESSION_STORAGE_KEY = 'dsh.local.anime-academy-expression';
    var DEFAULT_GREETING = '有什么问题都可以问我哦！\n我会一直在这里！';
    var DEFAULT_EXPRESSIONS = ['默认', '开心', '好奇', '眨眼'];
    var SKIN_THEME_SOURCE = '@local/dsh-logo:anime-academy';
    var SKIN_TOKENS = {
      '--dsw-alias-bg-base': { light: '#edf4ffbf', dark: '#edf4ffbf' },
      '--dsw-alias-bg-layer-1': { light: '#ffffffd9', dark: '#ffffffd9' },
      '--dsw-alias-bg-layer-2': { light: '#f6f9ffdf', dark: '#f6f9ffdf' },
      '--dsw-alias-bg-layer-3': { light: '#eaf2ffd2', dark: '#eaf2ffd2' },
      '--dsw-alias-bg-module-platform': { light: '#f1f6ffd9', dark: '#f1f6ffd9' },
      '--dsw-alias-bg-overlay': { light: '#dfeaffc9', dark: '#dfeaffc9' },
      '--dsw-alias-label-primary': { light: '#182b4c', dark: '#182b4c' },
      '--dsw-alias-label-primary-bluish': { light: '#27446f', dark: '#27446f' },
      '--dsw-alias-label-secondary': { light: '#4d6285', dark: '#4d6285' },
      '--dsw-alias-label-tertiary': { light: '#788aa8', dark: '#788aa8' },
      '--dsw-alias-label-caption': { light: '#8898b4', dark: '#8898b4' },
      '--dsw-alias-brand-primary': { light: '#397fe4', dark: '#397fe4' },
      '--dsw-alias-brand-primary-invert': { light: '#ffffff', dark: '#ffffff' },
      '--dsw-alias-brand-primary-new-colorprimary-new-color': { light: '#397fe4', dark: '#397fe4' },
      '--dsw-alias-brand-text': { light: '#142a4c', dark: '#142a4c' },
      '--dsw-alias-border-l1': { light: '#7896c422', dark: '#7896c422' },
      '--dsw-alias-border-l2': { light: '#7896c455', dark: '#7896c455' },
      '--dsw-alias-border-l3': { light: '#6d8bbc70', dark: '#6d8bbc70' },
      '--dsw-alias-border-l4': { light: '#536f9a', dark: '#536f9a' },
      '--dsw-alias-interactive-bg-active': { light: '#d9e8ff', dark: '#d9e8ff' },
      '--dsw-alias-interactive-bg-hover': { light: '#e8f0ff', dark: '#e8f0ff' },
      '--dsw-alias-interactive-bg-hover-accent': { light: '#dfeeff', dark: '#dfeeff' },
      '--dsw-alias-button-primary-fill': { light: '#3c82e8', dark: '#3c82e8' },
      '--dsw-alias-button-primary-hover': { light: '#2d70d4', dark: '#2d70d4' },
      '--dsw-alias-button-primary-dimmed': { light: '#a8c5ef', dark: '#a8c5ef' },
      '--dsw-alias-state-business-primary': { light: '#397fe4', dark: '#397fe4' },
      '--dsw-alias-link': { light: '#286bc0', dark: '#286bc0' },
      '--dsw-alias-markdown-code-block': { light: '#e5edf9', dark: '#e5edf9' },
      '--dsw-alias-markdown-code-block-banner': { light: '#d8e5f8', dark: '#d8e5f8' },
      '--dsw-alias-markdown-inline-code': { light: '#e3ecf9', dark: '#e3ecf9' },
      '--dsw-alias-settings-card-fill': { light: '#ffffff', dark: '#ffffff' },
      '--dsw-alias-settings-card-stroke': { light: '#9eb8df', dark: '#9eb8df' },
      '--dsw-specific-sidebar-fill': { light: '#152e58', dark: '#152e58' },
      '--dsw-specific-sidebar-nav-item-active': { light: '#264774', dark: '#264774' },
      '--dsw-specific-sidebar-nav-item-active-accent': { light: '#91bdff', dark: '#91bdff' },
      '--dsw-specific-sidebar-nav-item-hover': { light: '#1d3b6b', dark: '#1d3b6b' },
      '--dsw-specific-bubble': { light: '#e8f2ff', dark: '#e8f2ff' },
      '--dsw-specific-bubble-highlight': { light: '#d9e9ff', dark: '#d9e9ff' },
      '--dsw-specific-input-major': { light: '#ffffff', dark: '#ffffff' },
      '--dsw-specific-login-input': { light: '#f6f9ff', dark: '#f6f9ff' },
      '--dsw-specific-selector': { light: '#edf4ff', dark: '#edf4ff' },
      '--dsw-specific-tip': { light: '#eef5ff', dark: '#eef5ff' }
    };
    var themeService = null;
    var disposeSkinTokens = null;
    var skinTokenCount = 0;

    /**
     * The skin is a light design, but Harness may be running its dark theme.
     * SKIN_TOKENS only re-colors the main surfaces, so menus, tabs, cards and
     * floating buttons would keep dark backgrounds under the skin's dark text.
     * Read every token the dark theme redefines and pin it to the light theme's
     * value, then layer SKIN_TOKENS on top. Reading the live stylesheets keeps
     * this correct when Harness changes its palette.
     */
    function skinTokenSet() {
      var light = {};
      var darkNames = [];
      function walk(rules) {
        for (var i = 0; i < rules.length; i += 1) {
          var rule = rules[i];
          if (rule.cssRules && !rule.selectorText) walk(rule.cssRules);
          if (!rule.style || !rule.selectorText) continue;
          var selector = rule.selectorText.trim();
          var isDark = selector.indexOf('data-ds-dark-theme') !== -1;
          if (!isDark && !/^(body|:root|html)$/.test(selector)) continue;
          for (var j = 0; j < rule.style.length; j += 1) {
            var name = rule.style[j];
            if (name.indexOf('--') !== 0) continue;
            if (isDark) darkNames.push(name);
            else light[name] = rule.style.getPropertyValue(name).trim();
          }
        }
      }
      Array.prototype.forEach.call(document.styleSheets, function (sheet) {
        try {
          walk(sheet.cssRules);
        } catch (_) {}
      });
      var tokens = {};
      darkNames.forEach(function (name) {
        if (light[name] !== undefined) tokens[name] = { light: light[name], dark: light[name] };
      });
      Object.keys(SKIN_TOKENS).forEach(function (name) {
        tokens[name] = SKIN_TOKENS[name];
      });
      return tokens;
    }

    var ACADEMY_THEME_ID = '@local/dsh-logo:academy-light';
    var disposeAcademyTheme = null;
    var preferenceBeforeSkin = null;

    /**
     * The skin is a light design. Rather than patching every dark-only rule,
     * register a light theme of our own and select it while the skin is on, so
     * Harness renders every component (menus, cards, tabs, buttons) in its light
     * palette. Custom theme ids are not persisted by setTheme, so the user's
     * saved preference is untouched; turning the skin off restores it.
     * @returns whether the theme route is available.
     */
    function useAcademyTheme(enabled) {
      if (!themeService || typeof themeService.register !== 'function' || typeof themeService.setTheme !== 'function') return false;
      try {
        if (enabled) {
          if (!disposeAcademyTheme) {
            disposeAcademyTheme = themeService.register({ id: ACADEMY_THEME_ID, colorScheme: 'light', tokens: {} });
          }
          var current = themeService.getTheme().preference;
          if (current !== ACADEMY_THEME_ID) {
            preferenceBeforeSkin = current;
            themeService.setTheme(ACADEMY_THEME_ID);
          }
        } else if (disposeAcademyTheme) {
          if (themeService.getTheme().preference === ACADEMY_THEME_ID) themeService.setTheme(preferenceBeforeSkin || 'system');
          disposeAcademyTheme();
          disposeAcademyTheme = null;
        }
        return true;
      } catch (error) {
        console.warn('[local-dsh-logo] academy theme unavailable, falling back to token pinning', error);
        return false;
      }
    }

    function applySkinTokens() {
      if (!themeService) return;
      if (useAcademyTheme(true)) {
        if (!disposeSkinTokens) disposeSkinTokens = themeService.overrideTokens(SKIN_THEME_SOURCE, SKIN_TOKENS);
        return;
      }
      var tokens = skinTokenSet();
      var count = Object.keys(tokens).length;
      if (disposeSkinTokens && count === skinTokenCount) return;
      if (disposeSkinTokens) disposeSkinTokens();
      disposeSkinTokens = themeService.overrideTokens(SKIN_THEME_SOURCE, tokens);
      skinTokenCount = count;
    }

    function storedSkinEnabled() {
      try {
        return window.localStorage.getItem(SKIN_STORAGE_KEY) !== 'original';
      } catch (_) {
        return true;
      }
    }

    /**
     * Stages: `panels` is the full layout (sidebar, chat, composer, right rail),
     * `focus` drops the right rail, `background-only` hides the whole interface
     * to check the panorama. Older builds stored `full`, which is now `panels`.
     */
    function storedSkinStage() {
      try {
        var stage = window.localStorage.getItem(SKIN_STAGE_STORAGE_KEY);
        return stage === 'background-only' || stage === 'focus' ? stage : 'panels';
      } catch (_) {
        return 'panels';
      }
    }

    function setSkinStage(stage, persist) {
      if (!document.body) return;
      var next = stage === 'background-only' || stage === 'focus' ? stage : 'panels';
      document.body.setAttribute('data-dsh-anime-skin-stage', next);
      if (persist) {
        try {
          window.localStorage.setItem(SKIN_STAGE_STORAGE_KEY, next);
        } catch (_) {}
      }
    }

    function setSkinEnabled(enabled, persist) {
      try {
        if (persist) window.localStorage.setItem(SKIN_STORAGE_KEY, enabled ? 'academy' : 'original');
        if (!document.body) return;
        if (enabled) {
          document.body.setAttribute('data-dsh-anime-skin', 'active');
          setSkinStage(storedSkinStage(), false);
          applySkinTokens();
          ensureAcademyRail();
          ensureSidebarProps();
        } else {
          document.body.removeAttribute('data-dsh-anime-skin');
          document.body.removeAttribute('data-dsh-anime-skin-stage');
          useAcademyTheme(false);
          if (disposeSkinTokens) {
            disposeSkinTokens();
            disposeSkinTokens = null;
            skinTokenCount = 0;
          }
          document.querySelector('[data-dsh-academy-rail]')?.remove();
          document.querySelector('[data-dsh-academy-desk-back]')?.remove();
          SIDEBAR_DECOR.forEach(function (attr) { document.querySelector('[' + attr + ']')?.remove(); });
        }
        applyAcademySidebarSkin(enabled);
        syncSkinToggle();
      } catch (error) {
        console.warn('[local-dsh-logo] could not update anime skin', error);
      }
    }

    window.addEventListener('keydown', function (event) {
      if (!event.altKey || !event.shiftKey || (event.code !== 'KeyB' && event.code !== 'KeyF')) return;
      if (!document.body?.hasAttribute('data-dsh-anime-skin')) return;
      event.preventDefault();
      var current = document.body.getAttribute('data-dsh-anime-skin-stage') || 'panels';
      if (event.code === 'KeyB') {
        setSkinStage(current === 'background-only' ? 'panels' : 'background-only', true);
      } else {
        setSkinStage(current === 'focus' ? 'panels' : 'focus', true);
      }
    });

    function applyAcademySidebarSkin(enabled) {
      var labels = [
        { source: '新会话', themed: '新建对话', attr: 'data-dsh-academy-new-chat' },
        { source: '工作区', themed: '最近对话', attr: 'data-dsh-academy-recent-heading' }
      ];
      var candidates = document.querySelectorAll('button, [role="button"], span, div, h1, h2, h3');

      labels.forEach(function (entry) {
        candidates.forEach(function (element) {
          // Session rows can be titled 新会话 too; only relabel chrome outside the tree.
          if (element.closest('[role="treeitem"]') || element.querySelector('[role="treeitem"]')) return;
          var original = element.getAttribute('data-dsh-academy-original-label');
          var current = (element.textContent || '').trim();
          if (!original && current !== entry.source) return;
          if (original && original !== entry.source) return;
          if (!original) element.setAttribute('data-dsh-academy-original-label', entry.source);

          var replacement = enabled ? entry.themed : entry.source;
          if (element.children.length === 0) {
            if (current !== replacement) element.textContent = replacement;
          } else {
            Array.from(element.childNodes).forEach(function (node) {
              if (node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() === entry.source) {
                node.nodeValue = replacement;
              }
            });
          }

          var target = element.closest('button, [role="button"]') || element;
          if (enabled) target.setAttribute(entry.attr, '');
          else target.removeAttribute(entry.attr);
        });
      });

      document.querySelectorAll('button, [role="button"]').forEach(function (element) {
        if ((element.textContent || '').trim() === '插件') {
          element.setAttribute('data-dsh-academy-plugin-link', '');
        }
      });
    }

    function storedExpression() {
      try {
        var index = Number(window.localStorage.getItem(SKIN_EXPRESSION_STORAGE_KEY));
        return Number.isInteger(index) && index >= 0 ? index : 0;
      } catch (_) {
        return 0;
      }
    }

    /**
     * Expression table: configured entries from logo.config.json, padded with
     * the four default labels. Entries without their own portrait reuse the
     * main mascot so the layout is complete before dedicated art exists.
     */
    function expressionTable() {
      var configured = skinAssets.expressions || [];
      var table = configured.length ? configured : DEFAULT_EXPRESSIONS.map(function (label) { return { label: label }; });
      return table.map(function (entry) {
        return {
          label: entry.label,
          message: entry.message || DEFAULT_GREETING,
          src: entry.src || skinAssets.mascot,
          thumb: entry.thumb || entry.src || skinAssets.mascot,
          hair: entry.hair || '',
          shadow: entry.shadow || '',
          cropThumb: !entry.thumb
        };
      });
    }

    function selectExpression(rail, index, persist) {
      var table = expressionTable();
      var entry = table[index] || table[0];
      if (skinAssets.combo) {
        selectComboPose(rail, entry);
      } else {
        selectPortrait(rail.querySelector('.dsh-academy-character'), entry);
      }
      rail.querySelector('.dsh-academy-bubble span').textContent = entry.message;
      rail.querySelectorAll('.dsh-academy-expression').forEach(function (button, i) {
        button.setAttribute('aria-pressed', String(i === table.indexOf(entry)));
      });
      if (persist) {
        try {
          window.localStorage.setItem(SKIN_EXPRESSION_STORAGE_KEY, String(index));
        } catch (_) {}
      }
    }

    /**
     * A pose never fades to empty: the new pose is stacked on top, faded in once
     * decoded, and the poses below it fade out and are dropped. Layered mode
     * (skinAssets.comboDesk): each pose is the shared desk + that expression's
     * figure + the quill/inkwell, so the picture switches as a whole; the desk
     * layer behind the chat panel is the desk alone and does not switch. Older
     * combo art: the desk layer behind the panel holds poses too.
     */
    var comboPreload = [];

    function selectComboPose(rail, entry) {
      var layers = [rail, document.querySelector('[data-dsh-academy-desk-back]')].filter(Boolean);
      var setSources = function (pose) {
        var images = [];
        pose.querySelectorAll('img').forEach(function (img) {
          /* The desk and the quill/inkwell inside a layered pose keep their art. */
          if (img.classList.contains('dsh-academy-character')) img.src = entry.src;
          else if (img.classList.contains('dsh-academy-hair')) img.src = entry.hair;
          else if (img.classList.contains('dsh-academy-combo-shadow')) img.src = entry.shadow;
          images.push(img);
        });
        return images;
      };
      var fresh = [];
      var images = [];
      layers.forEach(function (layer) {
        var poses = layer.querySelectorAll('.dsh-academy-pose');
        var pose = poses[poses.length - 1];
        if (!pose) return;
        var current = pose.querySelector('.dsh-academy-character');
        if (!current.getAttribute('src')) {
          setSources(pose);
          return;
        }
        if (current.getAttribute('src') === entry.src) return;
        var next = pose.cloneNode(true);
        images = images.concat(setSources(next));
        next.style.opacity = '0';
        pose.after(next);
        fresh.push(next);
      });
      if (!fresh.length) return;
      var reveal = function () {
        fresh.forEach(function (next) {
          /* Not requestAnimationFrame: it never fires while the window is hidden,
           * and the timers below would then drop the visible pose. A forced layout
           * commits opacity 0 first, so setting 1 still transitions. */
          void next.offsetWidth;
          next.style.opacity = '1';
          /* Only poses stacked below this one, so a quicker later pick survives. */
          var below = [];
          for (var prev = next.previousElementSibling; prev && prev.classList.contains('dsh-academy-pose'); prev = prev.previousElementSibling) below.push(prev);
          /* Layered poses carry the same desk, so the new pose fades in fully over
           * the old one (the picture changes as a whole and never dims), then the
           * old one fades out (only its hair outside the new figure still shows)
           * and is dropped. Older combo art overlaps the two fades instead. */
          var layered = Boolean(skinAssets.comboDesk);
          window.setTimeout(function () {
            below.forEach(function (node) { node.style.opacity = '0'; });
          }, layered ? 220 : 70);
          window.setTimeout(function () {
            below.forEach(function (node) { node.remove(); });
          }, layered ? 480 : 300);
        });
      };
      Promise.all(images.map(function (img) { return img.decode ? img.decode().catch(function () {}) : null; })).then(reveal);
    }

    function selectPortrait(character, entry) {
      if (character.getAttribute('src') !== entry.src) {
        /* Cross-fade: the new pose decodes while the old one fades out. */
        character.style.opacity = '0';
        window.setTimeout(function () {
          character.src = entry.src;
          character.style.opacity = '1';
        }, character.getAttribute('src') ? 140 : 0);
      }
    }

    function comboImage(className, src) {
      var img = document.createElement('img');
      img.className = className;
      img.alt = '';
      img.draggable = false;
      if (src) img.src = src;
      return img;
    }

    /** Right companion rail: memo, portrait, speech bubble and expression picker. */
    function ensureAcademyRail() {
      if (!document.body || document.querySelector('[data-dsh-academy-rail]')) return;
      var rail = document.createElement('aside');
      rail.setAttribute('data-dsh-academy-rail', '');
      rail.setAttribute('aria-label', '星海书院助手面板');
      if (skinAssets.combo) rail.setAttribute('data-combo', '');

      var memo = document.createElement('div');
      memo.className = 'dsh-academy-memo';
      memo.setAttribute('aria-hidden', 'true');
      if (skinAssets.hasMemoArt) memo.setAttribute('data-has-art', '');
      memo.append('一起', document.createElement('br'), '把想法', document.createElement('br'), '变成可能！');
      var signature = document.createElement('small');
      signature.textContent = '— DeepSeek ✧';
      memo.appendChild(signature);

      var character = document.createElement('img');
      character.className = 'dsh-academy-character';
      character.alt = '';
      character.draggable = false;
      var comboStack = [];
      if (skinAssets.combo) {
        var pose = document.createElement('div');
        pose.className = 'dsh-academy-pose';
        if (skinAssets.comboDesk) {
          /* Layered: desk (clipped to the rail) below, the character layer unclipped
           * so its hair spills over the chat panel, quill and inkwell on top. */
          rail.setAttribute('data-layered', '');
          /* Desk, figure and quill switch together as one picture. */
          /* The shadow multiplies onto the desk (mix-blend-mode in skin.css): a warm
           * tint like a cel-shaded shadow instead of a dark overlay. */
          pose.append(comboImage('dsh-academy-combo-desk', skinAssets.comboDesk), comboImage('dsh-academy-combo-shadow', ''), character);
          if (skinAssets.comboFront) pose.appendChild(comboImage('dsh-academy-combo-front', skinAssets.comboFront));
          comboStack = [pose];
        } else {
          /* Combo art clipped to the rail + a hair-only strip that spills past
           * the rail edge over the chat panel. */
          var hair = document.createElement('img');
          hair.className = 'dsh-academy-hair';
          hair.alt = '';
          hair.draggable = false;
          pose.append(character, hair);
          comboStack = [pose];
        }
      } else {
        comboStack = [character];
      }

      var bubble = document.createElement('div');
      bubble.className = 'dsh-academy-bubble';
      var name = document.createElement('strong');
      name.textContent = 'DeepSeek';
      bubble.append(name, document.createElement('span'));

      var picker = document.createElement('div');
      picker.className = 'dsh-academy-expressions';
      picker.setAttribute('role', 'group');
      picker.setAttribute('aria-label', '角色表情');
      expressionTable().forEach(function (entry, index) {
        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'dsh-academy-expression';
        var frame = document.createElement('span');
        frame.className = 'thumb';
        var thumb = document.createElement('img');
        thumb.alt = '';
        thumb.draggable = false;
        thumb.src = entry.thumb;
        if (entry.cropThumb) thumb.setAttribute('data-crop', '');
        frame.appendChild(thumb);
        var label = document.createElement('em');
        label.textContent = entry.label;
        button.append(frame, label);
        button.addEventListener('click', function () { selectExpression(rail, index, true); });
        picker.appendChild(button);
      });

      /* Decor slots: shown only when skin.art supplies the artwork (see skin-art.css). */
      var sparkles = document.createElement('div');
      sparkles.className = 'dsh-academy-sparkles';
      var bigStar = document.createElement('div');
      bigStar.className = 'dsh-academy-bigstar';
      var desk = document.createElement('div');
      desk.className = 'dsh-academy-desk';
      [sparkles, bigStar, desk].forEach(function (node) { node.setAttribute('aria-hidden', 'true'); });

      /* Paint order: memo, sparkles, star, desk, desk books/globe (behind the arms), portrait, bubble, picker. */
      var deskBooks = document.createElement('div');
      deskBooks.className = 'dsh-academy-desk-books';
      var deskGlobe = document.createElement('div');
      deskGlobe.className = 'dsh-academy-desk-globe';
      [deskBooks, deskGlobe].forEach(function (node) { node.setAttribute('aria-hidden', 'true'); });
      rail.append.apply(rail, [memo, sparkles, bigStar, desk, deskBooks, deskGlobe].concat(comboStack, [bubble, picker]));
      document.body.appendChild(rail);
      if (skinAssets.combo) {
        /* Desk layer behind the chat panel: the desk art shown only left of the
         * rail, so the desk runs on under the panel instead of stopping at the
         * rail edge. z-index 0 sits it above the backdrop, below the panel.
         * Layered mode needs only the fixed desk here; otherwise it is a pose. */
        var back = document.createElement('div');
        back.setAttribute('data-dsh-academy-desk-back', '');
        back.setAttribute('aria-hidden', 'true');
        if (skinAssets.comboDesk) {
          back.appendChild(comboImage('dsh-academy-combo-desk', skinAssets.comboDesk));
        } else {
          var backPose = document.createElement('div');
          backPose.className = 'dsh-academy-pose';
          var backImage = document.createElement('img');
          backImage.className = 'dsh-academy-character';
          backImage.alt = '';
          backImage.draggable = false;
          backPose.appendChild(backImage);
          back.appendChild(backPose);
        }
        document.body.appendChild(back);
        /* Decode every pose up front so a pick fades in at once, not after a
         * ~0.4 s decode of the large data URI. */
        expressionTable().forEach(function (entry) {
          [entry.src, entry.hair, entry.shadow].forEach(function (src) {
            if (!src) return;
            var img = new Image();
            img.src = src;
            if (img.decode) img.decode().catch(function () {});
            comboPreload.push(img);
          });
        });
      }
      selectExpression(rail, storedExpression(), false);
    }

    /**
     * The composer frame art is scaled to the composer's height so its end caps
     * stay true semicircles; CSS cannot read an element's own height, so write it.
     */
    var composerSizer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(function (entries) {
      entries.forEach(function (entry) {
        var height = Math.round(entry.target.getBoundingClientRect().height);
        if (height > 0) entry.target.style.setProperty('--dsh-composer-h', height + 'px');
      });
    });

    function observeComposerHeight() {
      if (!composerSizer) return;
      document.querySelectorAll('[data-composer-card]:not([data-dsh-sized])').forEach(function (card) {
        card.setAttribute('data-dsh-sized', '');
        composerSizer.observe(card);
      });
    }

    /** Mirror the signed-in account's avatar into a CSS variable for chat bubbles. */
    function syncUserAvatar() {
      if (!document.body) return;
      var img = document.querySelector('[data-slot="sidebar.settings"] img');
      var src = img && img.currentSrc ? img.currentSrc : img && img.src;
      var value = src ? 'url("' + src.replace(/"/g, '%22') + '")' : '';
      if (document.body.style.getPropertyValue('--dsh-academy-user-avatar') === value) return;
      if (value) document.body.style.setProperty('--dsh-academy-user-avatar', value);
      else document.body.style.removeProperty('--dsh-academy-user-avatar');
    }

    /** Books, ink and quill resting on the sidebar's lower edge. */
    /** Sidebar decor: books and quill, the oil lamp and two hanging notes (all pointer-transparent). */
    var SIDEBAR_DECOR = ['data-dsh-academy-props', 'data-dsh-academy-lamp', 'data-dsh-academy-notes-left', 'data-dsh-academy-notes-right'];

    function ensureSidebarProps() {
      if (!document.body) return;
      SIDEBAR_DECOR.forEach(function (attr) {
        if (document.querySelector('[' + attr + ']')) return;
        var node = document.createElement('div');
        node.setAttribute(attr, '');
        node.setAttribute('aria-hidden', 'true');
        document.body.appendChild(node);
      });
    }

    /**
     * Skins offered in the switcher. To add a skin later, append an entry here
     * (id is what localStorage keeps) and teach setSkinEnabled/CSS about it.
     */
    var SKINS = [
      { id: 'academy', label: '星海书院', hint: '书院背景、角色陪伴栏' },
      { id: 'original', label: '原版', hint: 'Harness 原生界面' }
    ];

    function currentSkinId() {
      return document.body && document.body.hasAttribute('data-dsh-anime-skin') ? 'academy' : 'original';
    }

    function selectSkin(id) {
      setSkinEnabled(id === 'academy', true);
    }

    var CHEVRON_SVG = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.5 9.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    function syncSkinToggle() {
      var control = document.querySelector('[data-dsh-anime-skin-toggle]');
      if (!control) return;
      var current = SKINS.find(function (skin) { return skin.id === currentSkinId(); }) || SKINS[0];
      var label = control.querySelector('.dsh-skin-switcher-label');
      if (label) label.textContent = current.label;
      control.setAttribute('aria-label', '切换皮肤，当前：' + current.label);
      control.title = '切换皮肤';
    }

    function closeSkinMenu(restoreFocus) {
      var menu = document.querySelector('[data-dsh-skin-menu]');
      if (!menu) return;
      menu.remove();
      document.removeEventListener('pointerdown', onSkinMenuOutside, true);
      window.removeEventListener('resize', onSkinMenuDismiss);
      window.removeEventListener('blur', onSkinMenuDismiss);
      var control = document.querySelector('[data-dsh-anime-skin-toggle]');
      if (control) {
        control.setAttribute('aria-expanded', 'false');
        if (restoreFocus) control.focus();
      }
    }

    function onSkinMenuOutside(event) {
      var menu = document.querySelector('[data-dsh-skin-menu]');
      var control = document.querySelector('[data-dsh-anime-skin-toggle]');
      if (menu && !menu.contains(event.target) && !(control && control.contains(event.target))) closeSkinMenu(false);
    }

    function onSkinMenuDismiss() {
      closeSkinMenu(false);
    }

    function openSkinMenu(control) {
      closeSkinMenu(false);
      var menu = document.createElement('div');
      menu.setAttribute('data-dsh-skin-menu', '');
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', '皮肤');
      var current = currentSkinId();
      SKINS.forEach(function (skin) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'dsh-skin-menu-item';
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(skin.id === current));
        item.innerHTML = '<span class="dsh-skin-menu-check">' + CHECK_SVG + '</span><span class="dsh-skin-menu-text"><strong></strong><small></small></span>';
        item.querySelector('strong').textContent = skin.label;
        item.querySelector('small').textContent = skin.hint;
        item.addEventListener('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          closeSkinMenu(true);
          if (skin.id !== currentSkinId()) selectSkin(skin.id);
        });
        menu.appendChild(item);
      });
      menu.addEventListener('keydown', function (event) {
        var items = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitemradio"]'));
        var index = items.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          event.preventDefault();
          closeSkinMenu(true);
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          var step = event.key === 'ArrowDown' ? 1 : -1;
          items[(index + step + items.length) % items.length].focus();
        } else if (event.key === 'Tab') {
          closeSkinMenu(false);
        }
      });
      var rect = control.getBoundingClientRect();
      menu.style.top = Math.round(rect.bottom + 6) + 'px';
      menu.style.left = Math.round(rect.left) + 'px';
      document.body.appendChild(menu);
      control.setAttribute('aria-expanded', 'true');
      document.addEventListener('pointerdown', onSkinMenuOutside, true);
      window.addEventListener('resize', onSkinMenuDismiss);
      window.addEventListener('blur', onSkinMenuDismiss);
      var checked = menu.querySelector('[aria-checked="true"]') || menu.querySelector('[role="menuitemradio"]');
      if (checked) checked.focus();
    }

    /**
     * The switcher lives in the sidebar brand row so it never covers native header
     * controls. React re-renders can drop foreign nodes, so the observer calls
     * this again and it re-attaches when needed.
     */
    function mountSkinToggle() {
      if (!document.body) return;
      var row = document.querySelector('div:has(> span > span > span > [data-slot="sidebar.brand.mark"])');
      if (!row) return;
      var control = document.querySelector('[data-dsh-anime-skin-toggle]');
      if (control && control.parentElement === row) return;
      if (!control) {
        control = document.createElement('button');
        control.type = 'button';
        control.className = 'dsh-anime-skin-toggle';
        control.setAttribute('data-dsh-anime-skin-toggle', '');
        control.setAttribute('aria-haspopup', 'menu');
        control.setAttribute('aria-expanded', 'false');
        control.innerHTML = '<span class="dsh-skin-switcher-label"></span>' + CHEVRON_SVG;
        control.addEventListener('click', function onClick(event) {
          event.preventDefault();
          event.stopPropagation();
          if (document.querySelector('[data-dsh-skin-menu]')) closeSkinMenu(false);
          else openSkinMenu(control);
        });
        control.addEventListener('keydown', function (event) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            openSkinMenu(control);
          }
        });
      }
      row.appendChild(control);
      syncSkinToggle();
    }

    /** Priority below the official package's default (0) so this set wins. */
    var SHADOW_PRIORITY = -1;

    /** Height in px the host reserves for a mark, per surface. */
    var MARK_CANVAS = { sidebar: 24, hero: 34 };

    /** Largest width the sidebar column gives the wordmark before it would crowd the rail. */
    var MARK_MAX_WIDTH = { sidebar: 168, hero: 96 };

    /**
     * Build the box for one artwork variant at a requested size.
     * @param variant - generated variant record.
     * @param scope - canvas key, `sidebar` or `hero`.
     * @param size - host-supplied size in px (falls back to the canvas width).
     * @returns width and height in px.
     */
    function markBox(variant, scope, size) {
      var px = typeof size === 'number' && size > 0 ? size : MARK_CANVAS[scope];
      var aspect = variant.width / variant.height;
      var maxWidth = MARK_MAX_WIDTH[scope];
      var height = aspect >= 1 ? px / aspect : px;
      var width = aspect >= 1 ? px : px * aspect;
      if (width > maxWidth) {
        width = maxWidth;
        height = maxWidth / aspect;
      }
      return { width: width, height: height };
    }

    /**
     * Render one mark. Mask-mode artwork paints with `currentColor`, so it
     * follows the harness text color in both themes without re-rendering.
     * @param props - artwork, scope, size and className.
     * @returns the mark element.
     */
    function ThemedMark(props) {
      var artwork = props.artwork;
      var variants = { light: artwork.light, dark: artwork.dark || artwork.light };
      var box = markBox(variants.dark, props.scope, props.size);
      var painted = variants.light.fit === 'mask';
      var maskVar = props.scope === 'hero' ? 'var(--dsh-hero-mark-src)' : 'var(--dsh-logo-mark-src)';
      return jsx('span', {
        className: props.className,
        'aria-hidden': 'true',
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '100%',
          minWidth: 0,
          lineHeight: 0
        },
        children: painted
          ? jsx('span', {
              'data-dsh-logo-mark': props.scope,
              style: {
                display: 'block',
                width: box.width,
                height: box.height,
                maxWidth: '100%',
                backgroundColor: 'var(--dsh-logo-color, currentColor)',
                WebkitMaskImage: maskVar,
                maskImage: maskVar,
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
                WebkitMaskSize: 'contain',
                maskSize: 'contain'
              }
            })
          : jsxs(Fragment, {
              children: [
                jsx('img', {
                  src: variants.light.src,
                  width: box.width,
                  height: box.height,
                  alt: '',
                  'aria-hidden': 'true',
                  className: 'dsh-logo-light-only',
                  style: { display: 'block', maxWidth: '100%', flex: '0 0 auto' }
                }),
                jsx('img', {
                  src: variants.dark.src,
                  width: box.width,
                  height: box.height,
                  alt: '',
                  'aria-hidden': 'true',
                  className: 'dsh-logo-dark-only',
                  style: { display: 'none', maxWidth: '100%', flex: '0 0 auto' }
                })
              ]
            })
      });
    }

    /** Sidebar mark occupant (expanded header and collapsed rail). */
    function SidebarMark(props) {
      return jsx(ThemedMark, {
        artwork: artworks.sidebarMark,
        scope: 'sidebar',
        size: props.size,
        className: props.className
      });
    }

    /** Sidebar wordmark occupant: artwork, or the configured text lockup. */
    function SidebarName() {
      var wordmark;
      if (artworks.sidebarName.kind === 'text') {
        wordmark = jsx('span', {
          'data-dsh-logo-wordmark': 'text',
          style: {
            fontFamily: text.family || 'inherit',
            fontWeight: text.weight,
            letterSpacing: text.letterSpacing,
            fontSize: 14,
            lineHeight: '24px',
            whiteSpace: 'nowrap',
            color: 'inherit'
          },
          children: text.value
        });
      } else {
        wordmark = jsx(ThemedMark, {
          artwork: artworks.sidebarName,
          scope: 'sidebar',
          size: 20,
          allowWide: true
        });
      }
      return wordmark;
    }

    /** Conversation hero occupant (new-chat watermark). */
    function HeroMark(props) {
      return jsx(ThemedMark, {
        artwork: artworks.heroMark,
        scope: 'hero',
        size: props.size,
        className: props.className
      });
    }

    /**
     * Theme plumbing: the mask variables plus the two image-variant rules. The
     * dark selectors follow the harness `data-ds-dark-theme` marker on body.
     * @returns a style element owned by the React tree.
     */
    function LogoThemeStyle() {
      return jsx('style', {
        'data-dsh-logo-theme': 'true',
        dangerouslySetInnerHTML: { __html: themeCss }
      });
    }

    /**
     * Wrap one occupant so the generated theme style rides its own subtree: it
     * mounts with the slot and disappears when the slot unregisters.
     * @param Occupant - the slot component.
     * @returns a component rendering the style plus the occupant.
     */
    function withLogoStyle(Occupant) {
      return function ThemedOccupant(props) {
        return jsxs(Fragment, {
          children: [jsx(LogoThemeStyle, {}), jsx(Occupant, props)]
        });
      };
    }

    return {
      inject: ['slots', 'theme'],
      apply: function apply(ctx) {
        themeService = ctx.theme;
        setSkinEnabled(storedSkinEnabled(), false);
        /* Theme stylesheets can arrive after the plugin applies; re-read them once they have. */
        [600, 2500].forEach(function (delay) {
          window.setTimeout(function () {
            if (document.body && document.body.hasAttribute('data-dsh-anime-skin')) {
              applySkinTokens();
              syncUserAvatar();
            }
          }, delay);
        });
        mountSkinToggle();
        if (document.body && typeof MutationObserver !== 'undefined') {
          var relabelQueued = false;
          new MutationObserver(function updateAcademySidebar() {
            if (relabelQueued) return;
            relabelQueued = true;
            /* setTimeout, not requestAnimationFrame: rAF is paused while the window is hidden. */
            window.setTimeout(function () {
              relabelQueued = false;
              mountSkinToggle();
              if (document.body.hasAttribute('data-dsh-anime-skin')) {
                applyAcademySidebarSkin(true);
                syncUserAvatar();
                observeComposerHeight();
                /* A settings change can make Harness re-adopt the saved theme; take the light one back. */
                if (document.body.hasAttribute('data-ds-dark-theme')) applySkinTokens();
              }
            }, 60);
          }).observe(document.body, { childList: true, subtree: true });
        }

        /**
         * Occupying a `single` slot at a lower priority shadows the official
         * registration instead of colliding with it.
         */
        ctx.slots.inject('sidebar.brand.mark', function registerSidebarSet() {
          return ctx.slots.inject('sidebar.brand.name', function* registerSidebarBrand() {
            yield ctx.slots.register(
              { name: 'sidebar.brand.mark', priority: SHADOW_PRIORITY },
              withLogoStyle(SidebarMark)
            );
            yield ctx.slots.register(
              { name: 'sidebar.brand.name', priority: SHADOW_PRIORITY },
              SidebarName
            );
          });
        });

        ctx.slots.inject('conversation.hero.brand.mark', function registerHero() {
          return ctx.slots.register(
            { name: 'conversation.hero.brand.mark', priority: SHADOW_PRIORITY },
            withLogoStyle(HeroMark)
          );
        });
      }
    };
  }
});
