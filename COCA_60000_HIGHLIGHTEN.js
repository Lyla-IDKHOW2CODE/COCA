// ==UserScript==
// @name         COCA_60000_HIGHLIGHTEN (Optimized)
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Highlight English words by COCA frequency (optimized)
// @author       Lyla (optimized by assistant)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ========== COCA 词库（此处保留原 6 万词数组，为节省篇幅仅示意，实际请保留完整数组） ==========
    // 注意：实际使用时，请将下方数组替换为原脚本中的完整 COCA 数据
    const COCA = [
        "the", "be", "to", "of", "and", "a", "in", "that", "have", "I",
        // ... 此处省略 59990 个词，实际复制时请从原脚本完整粘贴
        "zygote", "zymurgy"
    ];

    // 构建排名 Map: word -> rank (1-indexed)
    const rankMap = new Map();
    COCA.forEach((word, index) => {
        rankMap.set(word.toLowerCase(), index + 1);
    });
    // 高亮范围：10000 ~ 35000
    const HIGH_MIN = 10000;
    const HIGH_MAX = 35000;

    // ========== 配置与状态 ==========
    const STORAGE_KEY_WORDS = 'coca_words';     // { word: 'hidden' | 'starred' }
    const STORAGE_KEY_MODE = 'coca_mode';       // 'all' | 'starred' | 'off'
    const STORAGE_KEY_DARK = 'coca_dark';

    let wordStatus = GM_getValue(STORAGE_KEY_WORDS, {});
    let currentMode = GM_getValue(STORAGE_KEY_MODE, 'all');
    let darkMode = GM_getValue(STORAGE_KEY_DARK, false);

    // ========== 工具函数 ==========
    function saveStatus() {
        try {
            GM_setValue(STORAGE_KEY_WORDS, wordStatus);
        } catch (e) {
            alert('⚠️ 存储空间不足！请导出备份后清空生词本或隐藏列表。');
        }
    }

    function getWordStatus(word) {
        const w = word.toLowerCase();
        return wordStatus[w] || null; // 'hidden' or 'starred'
    }

    function setWordStatus(word, status) {
        const w = word.toLowerCase();
        if (status === null) {
            delete wordStatus[w];
        } else {
            wordStatus[w] = status;
        }
        saveStatus();
    }

    // ========== 高亮核心（防嵌套 + 防 XSS + 高性能） ==========
    function highlightPage() {
        // 1. 清除所有旧高亮（恢复原始文本）
        document.querySelectorAll('.coca-highlight').forEach(el => {
            const parent = el.parentNode;
            const text = el.getAttribute('data-original') || el.textContent;
            parent.replaceChild(document.createTextNode(text), el);
            parent.normalize(); // 合并相邻文本节点
        });

        if (currentMode === 'off') return;

        // 2. 遍历文本节点进行高亮
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    // 跳过已处理或脚本/样式内的文本
                    if (node.parentElement?.closest?.('script, style, .coca-highlight')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        // 3. 批量处理每个文本节点
        for (const textNode of textNodes) {
            const text = textNode.textContent;
            if (!text.trim()) continue;

            // 使用自定义边界匹配单词（支持 don't, I'm 等）
            const regex = /(?<![a-zA-Z])[a-zA-Z']+(?![a-zA-Z])/g;
            let match;
            const parts = [];
            let lastIndex = 0;

            // 收集所有匹配项及其位置
            const matches = [];
            while ((match = regex.exec(text)) !== null) {
                matches.push({
                    word: match[0],
                    index: match.index,
                    endIndex: regex.lastIndex
                });
            }

            if (matches.length === 0) continue;

            // 构建包含高亮span的文档片段
            const fragment = document.createDocumentFragment();
            let currentPos = 0;

            for (const m of matches) {
                // 添加匹配前的普通文本
                if (m.index > currentPos) {
                    fragment.appendChild(document.createTextNode(text.substring(currentPos, m.index)));
                }

                const word = m.word;
                const lowerWord = word.toLowerCase();
                const rank = rankMap.get(lowerWord);

                // 判断是否该高亮
                let shouldHighlight = false;
                if (currentMode === 'all') {
                    if (rank && rank >= HIGH_MIN && rank <= HIGH_MAX) {
                        const status = getWordStatus(lowerWord);
                        if (status !== 'hidden') shouldHighlight = true;
                    }
                } else if (currentMode === 'starred') {
                    if (getWordStatus(lowerWord) === 'starred') shouldHighlight = true;
                }

                if (shouldHighlight) {
                    const span = document.createElement('span');
                    span.className = 'coca-highlight';
                    span.setAttribute('data-original', word);
                    // 根据排名设定颜色（原逻辑保留）
                    let color = '#FFD700'; // 默认
                    if (rank) {
                        if (rank <= 15000) color = '#FF6B6B';
                        else if (rank <= 20000) color = '#FFA94D';
                        else if (rank <= 25000) color = '#FFD93D';
                        else if (rank <= 30000) color = '#6BCB77';
                        else color = '#4D96FF';
                    }
                    span.style.backgroundColor = color;
                    span.style.cursor = 'pointer';
                    span.textContent = word; // 安全
                    fragment.appendChild(span);
                } else {
                    fragment.appendChild(document.createTextNode(word));
                }

                currentPos = m.endIndex;
            }

            // 添加剩余文本
            if (currentPos < text.length) {
                fragment.appendChild(document.createTextNode(text.substring(currentPos)));
            }

            // 替换原文本节点
            textNode.parentNode.replaceChild(fragment, textNode);
        }
    }

    // ========== MutationObserver（带防循环标记） ==========
    let observer = null;

    function startObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver((mutations) => {
            let needsUpdate = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        // 如果新增节点包含已高亮标记，则忽略
                        if (node.nodeType === 1 && node.querySelector?.('.coca-highlight')) {
                            return;
                        }
                        if (node.nodeType === 3 && node.parentElement?.closest?.('.coca-highlight')) {
                            return;
                        }
                        needsUpdate = true;
                        break;
                    }
                }
                if (needsUpdate) break;
            }
            if (needsUpdate) {
                // 防抖，避免频繁重绘
                clearTimeout(window._cocaDebounce);
                window._cocaDebounce = setTimeout(highlightPage, 300);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // ========== 双击查词（安全弹窗） ==========
    function showWordDialog(word) {
        const lower = word.toLowerCase();
        const rank = rankMap.get(lower);
        const status = getWordStatus(lower);

        // 创建模态框（不使用 innerHTML）
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top:0; left:0; width:100%; height:100%;
            background: rgba(0,0,0,0.5); z-index:999999;
            display: flex; justify-content: center; align-items: center;
        `;
        const box = document.createElement('div');
        box.style.cssText = `
            background: #fff; padding: 20px 30px; border-radius: 8px;
            max-width: 400px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            font-family: sans-serif; color: #333;
        `;
        overlay.appendChild(box);

        // 标题
        const title = document.createElement('h3');
        title.textContent = `📖 ${word}`;
        box.appendChild(title);

        // 排名信息
        const rankInfo = document.createElement('p');
        rankInfo.textContent = rank ? `COCA 排名：${rank}` : '未在词库中';
        box.appendChild(rankInfo);

        // 当前状态
        const statusInfo = document.createElement('p');
        statusInfo.textContent = status === 'starred' ? '⭐ 已在生词本' :
                                 status === 'hidden' ? '🚫 已隐藏' : '未标记';
        box.appendChild(statusInfo);

        // 按钮组
        const btnGroup = document.createElement('div');
        btnGroup.style.cssText = 'display:flex; gap:10px; flex-wrap:wrap; margin-top:15px;';

        const addStarBtn = document.createElement('button');
        addStarBtn.textContent = '⭐ 加入生词本';
        addStarBtn.onclick = () => {
            setWordStatus(lower, 'starred');
            showWordDialog(word); // 刷新弹窗
            highlightPage();
        };

        const removeStarBtn = document.createElement('button');
        removeStarBtn.textContent = '❌ 移出生词本';
        removeStarBtn.onclick = () => {
            if (status === 'starred') setWordStatus(lower, null);
            showWordDialog(word);
            highlightPage();
        };

        const hideBtn = document.createElement('button');
        hideBtn.textContent = '🚫 隐藏此词';
        hideBtn.onclick = () => {
            setWordStatus(lower, 'hidden');
            showWordDialog(word);
            highlightPage();
        };

        const unhideBtn = document.createElement('button');
        unhideBtn.textContent = '👁️ 取消隐藏';
        unhideBtn.onclick = () => {
            if (status === 'hidden') setWordStatus(lower, null);
            showWordDialog(word);
            highlightPage();
        };

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '关闭';
        closeBtn.onclick = () => document.body.removeChild(overlay);

        // 根据状态显示对应按钮
        if (status === 'starred') {
            btnGroup.appendChild(removeStarBtn);
        } else {
            btnGroup.appendChild(addStarBtn);
        }
        if (status === 'hidden') {
            btnGroup.appendChild(unhideBtn);
        } else {
            btnGroup.appendChild(hideBtn);
        }
        btnGroup.appendChild(closeBtn);

        box.appendChild(btnGroup);
        document.body.appendChild(overlay);

        // 点击外部关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) document.body.removeChild(overlay);
        });
    }

    document.addEventListener('dblclick', (e) => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text && /^[a-zA-Z']+$/.test(text)) {
            e.preventDefault();
            showWordDialog(text);
        }
    });

    // ========== 管理面板（右侧齿轮） ==========
    function buildPanel() {
        // 移除旧面板
        const oldPanel = document.getElementById('coca-panel');
        if (oldPanel) oldPanel.remove();

        const panel = document.createElement('div');
        panel.id = 'coca-panel';
        panel.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 99999;
            background: #fff; border-radius: 12px; padding: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            max-width: 300px; max-height: 80vh; overflow-y: auto;
            font-family: sans-serif; font-size: 14px; color: #333;
            display: none;
        `;
        // 内容使用安全方式构建
        const title = document.createElement('h4');
        title.textContent = '📚 COCA 管理器';
        panel.appendChild(title);

        // 模式切换
        const modeDiv = document.createElement('div');
        modeDiv.style.marginBottom = '10px';
        const modeLabel = document.createElement('span');
        modeLabel.textContent = '高亮模式：';
        modeDiv.appendChild(modeLabel);
        const modeSelect = document.createElement('select');
        ['all', 'starred', 'off'].forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m === 'all' ? '全部高亮' : m === 'starred' ? '仅生词本' : '关闭';
            if (m === currentMode) opt.selected = true;
            modeSelect.appendChild(opt);
        });
        modeSelect.onchange = () => {
            currentMode = modeSelect.value;
            GM_setValue(STORAGE_KEY_MODE, currentMode);
            highlightPage();
        };
        modeDiv.appendChild(modeSelect);
        panel.appendChild(modeDiv);

        // 夜间模式
        const darkDiv = document.createElement('div');
        darkDiv.style.marginBottom = '10px';
        const darkLabel = document.createElement('span');
        darkLabel.textContent = '夜间模式：';
        darkDiv.appendChild(darkLabel);
        const darkCheck = document.createElement('input');
        darkCheck.type = 'checkbox';
        darkCheck.checked = darkMode;
        darkCheck.onchange = () => {
            darkMode = darkCheck.checked;
            GM_setValue(STORAGE_KEY_DARK, darkMode);
            document.body.style.backgroundColor = darkMode ? '#1e1e1e' : '';
            document.body.style.color = darkMode ? '#ddd' : '';
            // 重新高亮以调整颜色（可在highlight中判断）
            highlightPage();
        };
        darkDiv.appendChild(darkCheck);
        panel.appendChild(darkDiv);

        // 统计信息
        const stats = document.createElement('p');
        const starredCount = Object.values(wordStatus).filter(v => v === 'starred').length;
        const hiddenCount = Object.values(wordStatus).filter(v => v === 'hidden').length;
        stats.textContent = `⭐ ${starredCount} 个生词  |  🚫 ${hiddenCount} 个隐藏`;
        panel.appendChild(stats);

        // 导入导出
        const ioDiv = document.createElement('div');
        ioDiv.style.display = 'flex';
        ioDiv.style.gap = '5px';
        ioDiv.style.marginBottom = '10px';

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '导出备份';
        exportBtn.onclick = () => {
            const data = JSON.stringify(wordStatus);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `coca_backup_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        };
        ioDiv.appendChild(exportBtn);

        const importBtn = document.createElement('button');
        importBtn.textContent = '导入备份';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    wordStatus = data;
                    saveStatus();
                    highlightPage();
                    alert('导入成功！');
                    buildPanel(); // 刷新面板
                } catch (err) {
                    alert('文件格式错误');
                }
            };
            reader.readAsText(file);
        };
        importBtn.onclick = () => fileInput.click();
        ioDiv.appendChild(importBtn);
        panel.appendChild(ioDiv);

        // 清空按钮
        const clearDiv = document.createElement('div');
        clearDiv.style.display = 'flex';
        clearDiv.style.gap = '5px';

        const clearStarred = document.createElement('button');
        clearStarred.textContent = '清空生词本';
        clearStarred.onclick = () => {
            if (confirm('确定清空所有生词？')) {
                for (const w in wordStatus) {
                    if (wordStatus[w] === 'starred') delete wordStatus[w];
                }
                saveStatus();
                highlightPage();
                buildPanel();
            }
        };
        clearDiv.appendChild(clearStarred);

        const clearHidden = document.createElement('button');
        clearHidden.textContent = '清空隐藏列表';
        clearHidden.onclick = () => {
            if (confirm('确定清空所有隐藏词？')) {
                for (const w in wordStatus) {
                    if (wordStatus[w] === 'hidden') delete wordStatus[w];
                }
                saveStatus();
                highlightPage();
                buildPanel();
            }
        };
        clearDiv.appendChild(clearHidden);
        panel.appendChild(clearDiv);

        // 关闭按钮
        const closePanelBtn = document.createElement('button');
        closePanelBtn.textContent = '关闭面板';
        closePanelBtn.style.marginTop = '10px';
        closePanelBtn.onclick = () => { panel.style.display = 'none'; };
        panel.appendChild(closePanelBtn);

        document.body.appendChild(panel);

        // 齿轮图标（切换显示面板）
        const gear = document.createElement('div');
        gear.id = 'coca-gear';
        gear.textContent = '⚙️';
        gear.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 99998;
            font-size: 28px; cursor: pointer; background: #fff; border-radius: 50%;
            width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        gear.onclick = () => {
            const p = document.getElementById('coca-panel');
            if (p) {
                p.style.display = p.style.display === 'none' ? 'block' : 'none';
                // 刷新统计
                const starredCount2 = Object.values(wordStatus).filter(v => v === 'starred').length;
                const hiddenCount2 = Object.values(wordStatus).filter(v => v === 'hidden').length;
                const statsP = p.querySelector('p');
                if (statsP) statsP.textContent = `⭐ ${starredCount2} 个生词  |  🚫 ${hiddenCount2} 个隐藏`;
            }
        };
        document.body.appendChild(gear);
    }

    // ========== 初始化 ==========
    function init() {
        // 应用夜间模式
        if (darkMode) {
            document.body.style.backgroundColor = '#1e1e1e';
            document.body.style.color = '#ddd';
        }
        // 构建界面
        buildPanel();
        // 首次高亮
        highlightPage();
        // 启动观察
        startObserver();
    }

    // 等待 DOM 加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ========== 重写 GM_addStyle 样式（可选） ==========
    GM_addStyle(`
        .coca-highlight {
            border-radius: 2px;
            padding: 0 2px;
            transition: background 0.2s;
        }
        .coca-highlight:hover {
            opacity: 0.8;
        }
    `);

})();
