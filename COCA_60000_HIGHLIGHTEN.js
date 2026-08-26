// ==UserScript==
// @name         COCA_60000_HIGHLIGHTEN
// @namespace    https://github.com/Lyla-IDKHOW2CODE/COCA
// @version      1.0
// @description  result of vibe coding and author literally don't know how to code, blame deepseek.
// @author       Lyla-IDKHOW2CODE
// @match        https://*/*
// @grant        GM_getResourceText
// @grant        GM_setValue
// @grant        GM_getValue
// @resource     COCA_DATA https://raw.githubusercontent.com/Lyla-IDKHOW2CODE/COCA/refs/heads/main/COCA60000.json
// ==/UserScript==

(async function() {
    'use strict';

    // ============================================================
    // 1. 加载 COCA 词库（保留最小排名）
    // ============================================================
    let jsonText;
    try {
        jsonText = GM_getResourceText("COCA_DATA");
    } catch (e) {
        console.error("❌ COCA词库加载失败", e);
        return;
    }

    let rawArray;
    try {
        rawArray = JSON.parse(jsonText);
    } catch (e) {
        console.error("❌ JSON解析失败", e);
        return;
    }

    const validItems = rawArray.filter(item =>
        item.word && typeof item.word === 'string' && item.word.trim() !== '' &&
        typeof item.rank === 'number' && !isNaN(item.rank)
    );
    console.log(`✅ 原始数据 ${rawArray.length} 条，有效数据 ${validItems.length} 条`);

    validItems.sort((a, b) => a.rank - b.rank);
    const COCA_MAP = new Map();
    for (let item of validItems) {
        const word = item.word.trim().toLowerCase();
        if (!COCA_MAP.has(word)) {
            COCA_MAP.set(word, item.rank);
        }
    }
    console.log(`✅ COCA词库加载完成，有效单词数：${COCA_MAP.size}`);

    // ============================================================
    // 2. 用户配置区（按你指定的颜色）
    // ============================================================
    const START_RANK = 8000;               // 排名 ≤ 此值的普通单词不高亮
    const MAX_RANK = 60000;                // 排名 > 此值的普通单词也不高亮（可调低）
    const STORAGE_KEY_LEARNED = 'coca_learned_words';
    const STORAGE_KEY_VOCAB = 'coca_vocab_words';
    const STORAGE_KEY_NIGHTMODE = 'coca_nightmode';
    const STORAGE_KEY_DISPLAY_MODE = 'coca_display_mode';

    // ---- 颜色配置（按你指定的修改） ----
    const VOCAB_COLOR = '#EDF0C1';          // 生词本统一高亮颜色（淡黄色）

    const COLOR_SETTING = [
        { limit: 15000, color: '#E3CECF' },   // 8001~15000 淡粉红
        { limit: 20000, color: '#E1D6E7' },   // 15001~20000 淡紫
        { limit: 35000, color: '#D6E6D7' },   // 20001~35000 淡绿
        // 35001~60000 不额外设置颜色，保持不高亮（因为没颜色可匹配）
        // 如果你想 35001~60000 也有颜色，可以加一行：
        // { limit: 60000, color: '#D4C5A9' }  // 淡棕
    ];

    // ============================================================
    // 3. 存储操作
    // ============================================================
    function getLearnedWords() {
        try {
            const data = GM_getValue(STORAGE_KEY_LEARNED, '[]');
            return JSON.parse(data);
        } catch { return []; }
    }
    function saveLearnedWords(list) {
        GM_setValue(STORAGE_KEY_LEARNED, JSON.stringify(list));
    }

    function getVocabWords() {
        try {
            const data = GM_getValue(STORAGE_KEY_VOCAB, '[]');
            return JSON.parse(data);
        } catch { return []; }
    }
    function saveVocabWords(list) {
        GM_setValue(STORAGE_KEY_VOCAB, JSON.stringify(list));
    }

    function getNightMode() {
        try {
            return GM_getValue(STORAGE_KEY_NIGHTMODE, false);
        } catch { return false; }
    }
    function setNightMode(val) {
        GM_setValue(STORAGE_KEY_NIGHTMODE, val);
    }

    function getDisplayMode() {
        try {
            return GM_getValue(STORAGE_KEY_DISPLAY_MODE, 'all');
        } catch { return 'all'; }
    }
    function setDisplayMode(val) {
        GM_setValue(STORAGE_KEY_DISPLAY_MODE, val);
    }

    function addLearned(word) {
        const list = getLearnedWords();
        const clean = word.toLowerCase().trim();
        if (!list.includes(clean)) {
            list.push(clean);
            saveLearnedWords(list);
            return true;
        }
        return false;
    }
    function removeLearned(word) {
        const list = getLearnedWords();
        const clean = word.toLowerCase().trim();
        const idx = list.indexOf(clean);
        if (idx !== -1) {
            list.splice(idx, 1);
            saveLearnedWords(list);
            return true;
        }
        return false;
    }
    function isLearned(word) {
        return getLearnedWords().includes(word.toLowerCase().trim());
    }

    function addVocab(word) {
        const list = getVocabWords();
        const clean = word.toLowerCase().trim();
        if (!list.includes(clean)) {
            list.push(clean);
            saveVocabWords(list);
            return true;
        }
        return false;
    }
    function removeVocab(word) {
        const list = getVocabWords();
        const clean = word.toLowerCase().trim();
        const idx = list.indexOf(clean);
        if (idx !== -1) {
            list.splice(idx, 1);
            saveVocabWords(list);
            return true;
        }
        return false;
    }
    function isVocab(word) {
        return getVocabWords().includes(word.toLowerCase().trim());
    }

    function clearLearned() {
        saveLearnedWords([]);
    }

    function clearVocab() {
        saveVocabWords([]);
    }

    // ============================================================
    // 4. 导出 / 导入
    // ============================================================
    function exportData() {
        const learned = getLearnedWords();
        const vocab = getVocabWords();
        if (learned.length === 0 && vocab.length === 0) {
            alert('⚠️ 所有列表均为空，没有数据可导出。');
            return;
        }
        const data = { learned, vocab };
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `coca_states_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`✅ 已导出 隐藏:${learned.length} 生词本:${vocab.length}`);
    }

    function importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            if (!data.learned || !data.vocab || !Array.isArray(data.learned) || !Array.isArray(data.vocab))
                throw new Error('格式错误');
            saveLearnedWords(data.learned);
            saveVocabWords(data.vocab);
            alert(`✅ 成功导入 隐藏:${data.learned.length} 生词本:${data.vocab.length}`);
            location.reload();
        } catch (e) {
            alert('❌ 导入失败，请确认是有效的JSON文件（含learned和vocab字段）。');
        }
    }

    // ============================================================
    // 5. 管理面板
    // ============================================================
    let panelRemove = () => {};

    function showManagementPanel() {
        const old = document.getElementById('coca-panel');
        if (old) old.remove();

        const panel = document.createElement('div');
        panel.id = 'coca-panel';
        panel.style.cssText = `
            position: fixed; bottom: 80px; right: 20px;
            width: 400px; max-height: 560px;
            background: rgba(30, 30, 30, 0.96);
            color: #eee; border-radius: 12px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.7);
            padding: 16px 20px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex; flex-direction: column;
            backdrop-filter: blur(4px);
            border: 1px solid #555;
        `;

        // ---- 标题 ----
        const titleBar = document.createElement('div');
        titleBar.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;';
        titleBar.innerHTML = `
            <span style="font-size: 16px; font-weight: bold; color: #fff;">📚 单词状态管理</span>
            <button id="coca-close-panel" style="background: none; border: none; color: #aaa; font-size: 20px; cursor: pointer;">✕</button>
        `;
        panel.appendChild(titleBar);

        // ---- 视图切换按钮 ----
        const viewGroup = document.createElement('div');
        viewGroup.style.cssText = 'display: flex; gap: 8px; margin-bottom: 10px;';
        const btnAll = document.createElement('button');
        btnAll.textContent = '📋 全部';
        btnAll.style.cssText = 'flex:1; padding:6px; background:#3498db; border:none; border-radius:6px; color:white; font-size:13px; cursor:pointer;';
        const btnVocabView = document.createElement('button');
        btnVocabView.textContent = '⭐ 生词本';
        btnVocabView.style.cssText = 'flex:1; padding:6px; background:#555; border:none; border-radius:6px; color:#eee; font-size:13px; cursor:pointer;';
        const btnLearnedView = document.createElement('button');
        btnLearnedView.textContent = '✅ 隐藏';
        btnLearnedView.style.cssText = 'flex:1; padding:6px; background:#555; border:none; border-radius:6px; color:#eee; font-size:13px; cursor:pointer;';
        viewGroup.appendChild(btnAll);
        viewGroup.appendChild(btnVocabView);
        viewGroup.appendChild(btnLearnedView);
        panel.appendChild(viewGroup);

        // ---- 手动输入区域 ----
        const inputArea = document.createElement('div');
        inputArea.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; align-items: center;';
        const inputField = document.createElement('input');
        inputField.type = 'text';
        inputField.placeholder = '输入单词，用逗号/空格分隔';
        inputField.style.cssText = 'flex:2; min-width:150px; padding:6px 10px; border-radius:6px; border:1px solid #555; background:#444; color:#eee; font-size:13px;';
        inputArea.appendChild(inputField);

        const targetGroup = document.createElement('span');
        targetGroup.style.cssText = 'display: flex; gap: 4px;';
        const btnTargetVocab = document.createElement('button');
        btnTargetVocab.textContent = '⭐生词本';
        btnTargetVocab.style.cssText = 'padding:5px 10px; background:#b8860b; color:white; border:none; border-radius:6px; font-size:12px; cursor:pointer;';
        const btnTargetLearned = document.createElement('button');
        btnTargetLearned.textContent = '📘隐藏';
        btnTargetLearned.style.cssText = 'padding:5px 10px; background:#2c7a3e; color:white; border:none; border-radius:6px; font-size:12px; cursor:pointer;';
        targetGroup.appendChild(btnTargetVocab);
        targetGroup.appendChild(btnTargetLearned);
        inputArea.appendChild(targetGroup);

        const addBtn = document.createElement('button');
        addBtn.textContent = '➕ 添加';
        addBtn.style.cssText = 'padding:5px 14px; background:#3498db; color:white; border:none; border-radius:6px; font-size:13px; cursor:pointer;';
        inputArea.appendChild(addBtn);
        panel.appendChild(inputArea);

        // ---- 列表容器 ----
        const listContainer = document.createElement('div');
        listContainer.style.cssText = 'flex:1; overflow-y:auto; max-height:160px; margin-bottom:8px;';
        panel.appendChild(listContainer);

        // ---- 底部控制区：夜间模式 + 显示模式 ----
        const controlRow = document.createElement('div');
        controlRow.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; align-items: center;';

        const isNight = getNightMode();
        const nightBtn = document.createElement('button');
        nightBtn.textContent = isNight ? '☀️ 日间' : '🌙 夜间';
        nightBtn.style.cssText = `padding:5px 12px; background:${isNight ? '#6c5b7b' : '#2c3e50'}; color:#eee; border:none; border-radius:6px; font-size:13px; cursor:pointer;`;
        nightBtn.onclick = function() {
            const current = getNightMode();
            const newMode = !current;
            setNightMode(newMode);
            nightBtn.textContent = newMode ? '☀️ 日间' : '🌙 夜间';
            nightBtn.style.background = newMode ? '#6c5b7b' : '#2c3e50';
            清除高亮();
            高亮页面();
        };
        controlRow.appendChild(nightBtn);

        // ---- 显示模式切换 ----
        const displayMode = getDisplayMode();
        const displayLabel = document.createElement('span');
        displayLabel.textContent = '📺 显示:';
        displayLabel.style.cssText = 'font-size:13px; color:#aaa; margin-right:4px;';
        controlRow.appendChild(displayLabel);

        const modes = [
            { value: 'all', label: '全部' },
            { value: 'vocab_only', label: '⭐仅生词' },
            { value: 'none', label: '关闭' }
        ];

        const modeBtns = [];
        modes.forEach(m => {
            const btn = document.createElement('button');
            btn.textContent = m.label;
            const isActive = (displayMode === m.value);
            btn.style.cssText = `
                padding:4px 10px; background:${isActive ? '#3498db' : '#555'};
                color:#eee; border:none; border-radius:6px; font-size:12px; cursor:pointer;
                transition: background 0.15s;
            `;
            btn.onclick = function() {
                setDisplayMode(m.value);
                modeBtns.forEach(b => b.style.background = '#555');
                btn.style.background = '#3498db';
                清除高亮();
                高亮页面();
            };
            modeBtns.push(btn);
            controlRow.appendChild(btn);
        });

        panel.appendChild(controlRow);

        // ---- 操作按钮：分别清空 ----
        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;';

        const clearVocabBtn = document.createElement('button');
        clearVocabBtn.textContent = '🗑️ 清空生词本';
        clearVocabBtn.style.cssText = 'flex:1; background:#8B0000; color:#eee; border:none; border-radius:6px; padding:8px; font-size:13px; cursor:pointer;';
        clearVocabBtn.onclick = function() {
            if (confirm('⚠️ 确定清空「生词本」中的所有单词吗？（隐藏列表不受影响）')) {
                clearVocab();
                清除高亮();
                高亮页面();
                alert('✅ 生词本已清空，当前页高亮已更新。');
                renderList(currentView);
            }
        };
        btnGroup.appendChild(clearVocabBtn);

        const clearLearnedBtn = document.createElement('button');
        clearLearnedBtn.textContent = '🗑️ 清空隐藏';
        clearLearnedBtn.style.cssText = 'flex:1; background:#2c3e50; color:#eee; border:none; border-radius:6px; padding:8px; font-size:13px; cursor:pointer;';
        clearLearnedBtn.onclick = function() {
            if (confirm('⚠️ 确定清空「隐藏」列表中的所有单词吗？（生词本不受影响）')) {
                clearLearned();
                清除高亮();
                高亮页面();
                alert('✅ 隐藏列表已清空，当前页高亮已更新。');
                renderList(currentView);
            }
        };
        btnGroup.appendChild(clearLearnedBtn);

        const importBtn = document.createElement('button');
        importBtn.textContent = '📥 导入备份';
        importBtn.style.cssText = 'flex:1; background:#2c3e50; color:#eee; border:none; border-radius:6px; padding:8px; font-size:13px; cursor:pointer;';
        importBtn.onclick = function() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(ev) { importData(ev.target.result); };
                reader.readAsText(file);
            };
            input.click();
        };
        btnGroup.appendChild(importBtn);
        panel.appendChild(btnGroup);

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '💾 导出数据到本地 (JSON)';
        exportBtn.style.cssText = 'width:100%; background:#3498db; color:white; border:none; border-radius:6px; padding:10px; font-size:14px; cursor:pointer; margin-bottom:6px;';
        exportBtn.onclick = exportData;
        panel.appendChild(exportBtn);

        const tip = document.createElement('div');
        tip.style.cssText = 'font-size:11px; color:#666; text-align:center;';
        tip.textContent = '✅ 数据存于油猴插件，清缓存不影响';
        panel.appendChild(tip);

        document.body.appendChild(panel);

        // 关闭按钮
        const closeBtn = document.getElementById('coca-close-panel');
        if (closeBtn) {
            closeBtn.onclick = function() {
                panel.remove();
            };
        }

        // ---- 内部状态 ----
        let currentTarget = 'vocab';
        let currentView = 'all';

        function updateTargetButtons() {
            btnTargetVocab.style.background = currentTarget === 'vocab' ? '#b8860b' : '#555';
            btnTargetLearned.style.background = currentTarget === 'learned' ? '#2c7a3e' : '#555';
        }
        btnTargetVocab.onclick = () => { currentTarget = 'vocab'; updateTargetButtons(); };
        btnTargetLearned.onclick = () => { currentTarget = 'learned'; updateTargetButtons(); };
        updateTargetButtons();

        // ---- 添加逻辑 ----
        function handleAdd() {
            const raw = inputField.value.trim();
            if (!raw) {
                alert('⚠️ 请输入要添加的单词');
                return;
            }
            const words = raw.split(/[,，\s\n]+/).map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
            if (words.length === 0) {
                alert('⚠️ 未识别到有效单词');
                return;
            }

            let added = 0, skipped = 0, conflicts = 0;
            for (let w of words) {
                if (currentTarget === 'vocab') {
                    if (isVocab(w)) { skipped++; continue; }
                    if (isLearned(w)) { removeLearned(w); conflicts++; }
                    if (addVocab(w)) added++;
                } else {
                    if (isLearned(w)) { skipped++; continue; }
                    if (isVocab(w)) { removeVocab(w); conflicts++; }
                    if (addLearned(w)) added++;
                }
            }
            let msg = `✅ 成功添加 ${added} 个单词`;
            if (conflicts > 0) msg += `，${conflicts} 个从另一列表转移`;
            if (skipped > 0) msg += `，${skipped} 个已在目标列表被跳过`;
            alert(msg);
            inputField.value = '';
            renderList(currentView);
            清除高亮();
            高亮页面();
        }

        addBtn.onclick = handleAdd;
        inputField.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
        });

        // ---- 渲染函数 ----
        function renderList(view) {
            listContainer.innerHTML = '';
            const learned = getLearnedWords();
            const vocab = getVocabWords();

            if (view === 'all') {
                if (vocab.length) {
                    const header = document.createElement('div');
                    header.textContent = '⭐ 生词本';
                    header.style.cssText = 'font-weight:bold; color:#FFD700; margin:4px 0;';
                    listContainer.appendChild(header);
                    vocab.forEach(word => {
                        listContainer.appendChild(createListItem(word, 'vocab'));
                    });
                }
                if (learned.length) {
                    const header = document.createElement('div');
                    header.textContent = '✅ 隐藏';
                    header.style.cssText = 'font-weight:bold; color:#9EC0AE; margin:4px 0;';
                    listContainer.appendChild(header);
                    learned.forEach(word => {
                        listContainer.appendChild(createListItem(word, 'learned'));
                    });
                }
                if (vocab.length === 0 && learned.length === 0) {
                    const empty = document.createElement('div');
                    empty.textContent = '暂无任何标记';
                    empty.style.cssText = 'color:#888; text-align:center; padding:20px 0;';
                    listContainer.appendChild(empty);
                }
            } else if (view === 'vocab') {
                if (vocab.length) {
                    vocab.forEach(word => {
                        listContainer.appendChild(createListItem(word, 'vocab'));
                    });
                } else {
                    const empty = document.createElement('div');
                    empty.textContent = '生词本为空';
                    empty.style.cssText = 'color:#888; text-align:center; padding:20px 0;';
                    listContainer.appendChild(empty);
                }
            } else if (view === 'learned') {
                if (learned.length) {
                    learned.forEach(word => {
                        listContainer.appendChild(createListItem(word, 'learned'));
                    });
                } else {
                    const empty = document.createElement('div');
                    empty.textContent = '隐藏列表为空';
                    empty.style.cssText = 'color:#888; text-align:center; padding:20px 0;';
                    listContainer.appendChild(empty);
                }
            }

            [btnAll, btnVocabView, btnLearnedView].forEach(b => b.style.background = '#555');
            if (view === 'all') btnAll.style.background = '#3498db';
            else if (view === 'vocab') btnVocabView.style.background = '#b8860b';
            else if (view === 'learned') btnLearnedView.style.background = '#2c7a3e';
        }

        function createListItem(word, type) {
            const div = document.createElement('div');
            div.style.cssText = `display:flex; justify-content:space-between; align-items:center; padding:4px 0; border-bottom:1px solid #444; font-size:14px;`;
            const span = document.createElement('span');
            span.textContent = word;
            span.style.cssText = 'color:#ddd;';
            const btn = document.createElement('button');
            btn.textContent = '移除';
            btn.style.cssText = `background:#e74c3c; color:white; border:none; border-radius:4px; padding:1px 10px; font-size:12px; cursor:pointer;`;
            btn.onclick = function(e) {
                e.stopPropagation();
                let removed = false;
                if (type === 'vocab') removed = removeVocab(word);
                else removed = removeLearned(word);
                if (removed) {
                    清除高亮();
                    高亮页面();
                    renderList(currentView);
                    console.log(`✅ 已移除“${word}”`);
                }
            };
            div.appendChild(span);
            div.appendChild(btn);
            return div;
        }

        btnAll.onclick = () => { currentView = 'all'; renderList('all'); };
        btnVocabView.onclick = () => { currentView = 'vocab'; renderList('vocab'); };
        btnLearnedView.onclick = () => { currentView = 'learned'; renderList('learned'); };

        renderList('all');

        setTimeout(() => {
            document.addEventListener('click', function closeOnOutside(e) {
                if (panel && !panel.contains(e.target)) {
                    panel.remove();
                    document.removeEventListener('click', closeOnOutside);
                }
            });
        }, 100);

        panelRemove = () => { if (panel) panel.remove(); };
    }

    // ============================================================
    // 6. 浮动按钮
    // ============================================================
    function addFloatingButton() {
        const btn = document.createElement('div');
        btn.id = 'coca-fab';
        btn.textContent = '⚙️';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 48px;
            height: 48px;
            background: rgba(52, 152, 219, 0.85);
            color: white;
            border-radius: 50%;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            font-size: 24px;
            line-height: 48px;
            text-align: center;
            cursor: pointer;
            z-index: 999998;
            user-select: none;
            transition: transform 0.2s;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        btn.title = '打开单词状态管理';
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.1)'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
        btn.onclick = function(e) {
            e.stopPropagation();
            showManagementPanel();
        };
        document.body.appendChild(btn);
    }

    // ============================================================
    // 7. 高亮核心逻辑（支持显示模式切换）
    // ============================================================
    function 获取颜色(word) {
        const clean = word.toLowerCase().trim();
        const displayMode = getDisplayMode();

        if (displayMode === 'none') {
            return null;
        }

        if (isVocab(clean)) {
            return { color: VOCAB_COLOR, rank: COCA_MAP.get(clean) || '?' };
        }

        if (displayMode === 'vocab_only') {
            return null;
        }

        if (isLearned(clean)) {
            return null;
        }
        const rank = COCA_MAP.get(clean);
        if (!rank) return null;
        if (rank <= START_RANK) return null;
        if (rank > MAX_RANK) return null;
        for (let rule of COLOR_SETTING) {
            if (rank <= rule.limit) {
                return { color: rule.color, rank: rank };
            }
        }
        return null;
    }

    // ============================================================
    // 8. 清除高亮 & 高亮页面
    // ============================================================
    function 清除高亮() {
        document.querySelectorAll('.coca-word').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
        });
    }

    function 高亮页面() {
        清除高亮();
        const isNight = getNightMode();
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    const parent = node.parentElement;
                    if (!parent) return NodeFilter.FILTER_REJECT;
                    const tag = parent.tagName.toLowerCase();
                    if (['script','style','noscript','code','pre','textarea','input'].includes(tag))
                        return NodeFilter.FILTER_REJECT;
                    return /\w/.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
                }
            }
        );
        let nodes = [], node;
        while (node = walker.nextNode()) nodes.push(node);
        for (let textNode of nodes) {
            const original = textNode.textContent;
            const newHTML = original.replace(/\b([a-zA-Z']+)\b/g, function(match) {
                const result = 获取颜色(match);
                if (!result) return match;
                const { color, rank } = result;
                const tooltip = rank !== '?' ? `COCA排名: ${rank}` : '生词本单词';
                let style;
                if (isNight) {
                    style = `color: ${color}; text-decoration: underline; text-underline-offset: 2px;`;
                } else {
                    style = `background-color: ${color};`;
                }
                return `<span class="coca-word" title="${tooltip} | 双击管理状态" style="${style} border-radius:2px; padding:0 2px; cursor:help;">${match}</span>`;
            });
            if (newHTML !== original) {
                const wrapper = document.createElement('span');
                wrapper.innerHTML = newHTML;
                textNode.parentNode.replaceChild(wrapper, textNode);
            }
        }
    }

    // ============================================================
    // 9. 双击弹窗
    // ============================================================
    function showWordDialog(word, rank, currentState) {
        const old = document.getElementById('coca-dialog');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'coca-dialog';
        overlay.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.5); z-index: 1000000;
            display: flex; justify-content: center; align-items: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        const card = document.createElement('div');
        card.style.cssText = `
            background: #2d2d2d; color: #eee; border-radius: 16px;
            padding: 30px 40px; max-width: 400px; width: 90%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8);
            position: relative;
        `;
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: absolute; top: 10px; right: 14px;
            background: none; border: none; color: #aaa;
            font-size: 22px; cursor: pointer;
        `;
        closeBtn.onclick = () => overlay.remove();
        card.appendChild(closeBtn);

        const wordDisplay = document.createElement('div');
        wordDisplay.textContent = word;
        wordDisplay.style.cssText = 'font-size: 28px; font-weight: bold; color: #fff; margin-bottom: 8px;';
        card.appendChild(wordDisplay);

        const rankDisplay = document.createElement('div');
        rankDisplay.textContent = rank !== null ? `📈 COCA排名: ${rank}` : '❌ 不在COCA词频表中';
        rankDisplay.style.cssText = 'font-size: 16px; color: #bbb; margin-bottom: 12px;';
        card.appendChild(rankDisplay);

        const stateDisplay = document.createElement('div');
        stateDisplay.textContent = `📌 当前状态: ${currentState}`;
        stateDisplay.style.cssText = 'font-size: 15px; color: #9EC0AE; margin-bottom: 20px;';
        card.appendChild(stateDisplay);

        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display: flex; gap: 12px; justify-content: center;';

        const isLearnedNow = (currentState === '隐藏');
        const isVocabNow = (currentState === '生词');

        const btnLeft = document.createElement('button');
        if (isLearnedNow) {
            btnLeft.textContent = '移出隐藏 → 普通';
            btnLeft.style.background = '#555';
            btnLeft.onclick = function() {
                removeLearned(word);
                overlay.remove();
                清除高亮();
                高亮页面();
                console.log(`✅ 移出隐藏“${word}”`);
            };
        } else {
            btnLeft.textContent = '📘 加入隐藏';
            btnLeft.style.background = '#2c7a3e';
            btnLeft.onclick = function() {
                if (isVocabNow) removeVocab(word);
                addLearned(word);
                overlay.remove();
                清除高亮();
                高亮页面();
                console.log(`✅ 加入隐藏“${word}”`);
            };
        }
        btnLeft.style.cssText = `
            flex:1; padding:10px 16px; border:none; border-radius:8px;
            color:white; font-size:15px; cursor:pointer;
            transition:0.2s; background:${btnLeft.style.background || '#2c7a3e'};
        `;
        btnLeft.onmouseover = () => btnLeft.style.opacity = '0.85';
        btnLeft.onmouseout = () => btnLeft.style.opacity = '1';
        btnGroup.appendChild(btnLeft);

        const btnRight = document.createElement('button');
        if (isVocabNow) {
            btnRight.textContent = '移出生词本 → 普通';
            btnRight.style.background = '#555';
            btnRight.onclick = function() {
                removeVocab(word);
                overlay.remove();
                清除高亮();
                高亮页面();
                console.log(`✅ 移出生词本“${word}”`);
            };
        } else {
            btnRight.textContent = '⭐ 加入生词本';
            btnRight.style.background = '#b8860b';
            btnRight.onclick = function() {
                if (isLearnedNow) removeLearned(word);
                addVocab(word);
                overlay.remove();
                清除高亮();
                高亮页面();
                console.log(`✅ 加入生词本“${word}”`);
            };
        }
        btnRight.style.cssText = `
            flex:1; padding:10px 16px; border:none; border-radius:8px;
            color:white; font-size:15px; cursor:pointer;
            transition:0.2s; background:${btnRight.style.background || '#b8860b'};
        `;
        btnRight.onmouseover = () => btnRight.style.opacity = '0.85';
        btnRight.onmouseout = () => btnRight.style.opacity = '1';
        btnGroup.appendChild(btnRight);

        card.appendChild(btnGroup);
        overlay.appendChild(card);
        document.body.appendChild(overlay);

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) overlay.remove();
        });
    }

    // ============================================================
    // 10. 双击事件处理
    // ============================================================
    document.addEventListener('dblclick', function(e) {
        const selection = window.getSelection();
        const selected = selection.toString().trim();
        if (!selected) return;
        const match = selected.match(/[a-zA-Z']+/);
        if (!match) return;
        const rawWord = match[0];
        const clean = rawWord.toLowerCase().trim();

        const rank = COCA_MAP.get(clean);
        const rankDisplay = rank || null;

        let state = '';
        if (isVocab(clean)) state = '生词';
        else if (isLearned(clean)) state = '隐藏';
        else if (rank && rank > START_RANK) {
            let inRange = false;
            for (let rule of COLOR_SETTING) {
                if (rank <= rule.limit) { inRange = true; break; }
            }
            state = inRange ? '普通高亮' : '未高亮';
        } else {
            state = '未高亮';
        }

        showWordDialog(rawWord, rankDisplay, state);
    });

    // ============================================================
    // 11. 启动脚本
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            高亮页面();
            addFloatingButton();
        });
    } else {
        高亮页面();
        addFloatingButton();
    }

    console.log('📌 COCA 高亮 + 单词状态管理器 v2.7 已启动！');
    console.log('   ⚙️ 点击右下角齿轮按钮打开管理面板');
    console.log('   💡 双击任意英文单词 → 查看排名并管理状态');
    console.log('   ⭐ 生词本单词强制高亮（颜色可自定义）');
    console.log('   📝 管理面板支持手动输入单词（批量添加）');
    console.log('   🌙 夜间模式切换（背景色 ↔ 下划线）');
    console.log('   📺 显示模式切换（全部 / 仅生词本 / 关闭高亮）');
    console.log('   🗑️ 分别清空生词本和隐藏列表');

})();
