import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Application state
let ydoc = null;
let provider = null;
let awareness = null;
let yText = null;
let yBlocks = null;
let userId = null;
let userColor = null;
let selectedBlockId = null;
let remoteCursors = new Map();

// DOM elements
let appContainer = null;
let editorContainer = null;
let toolbar = null;
let statusBar = null;
let presenceContainer = null;

// Toolbar buttons
const toolbarButtons = {
    bold: null,
    italic: null,
    underline: null,
    heading1: null,
    heading2: null,
    heading3: null,
    bulletList: null,
    numberList: null,
    code: null,
    quote: null,
    link: null,
};

export function initApp() {
    // Create app container
    appContainer = document.getElementById('app');
    if (!appContainer) {
        appContainer = document.createElement('div');
        appContainer.id = 'app';
        document.body.appendChild(appContainer);
    }

    // Initialize Y.js document
    ydoc = new Y.Doc();
    
    // Get shared types
    yText = ydoc.getText('content');
    yBlocks = ydoc.getArray('blocks');
    
    // Generate user identity
    userId = 'user-' + Math.random().toString(36).substr(2, 9);
    userColor = `hsl(${Math.random() * 360}, 70%, 60%)`;
    
    // Connect to WebSocket server
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = window.location.hostname || 'localhost';
    const wsPort = new URLSearchParams(window.location.search).get('wsPort') || '1234';
    const wsUrl = `${wsProtocol}://${wsHost}:${wsPort}`;
    const roomName = 'doc-' + (new URLSearchParams(window.location.search).get('id') || 'default');
    
    provider = new WebsocketProvider(wsUrl, roomName, ydoc);
    awareness = provider.awareness;
    
    // Set user awareness
    awareness.setLocalStateField('user', {
        id: userId,
        color: userColor,
        name: `User ${Math.floor(Math.random() * 1000)}`
    });
    
    // Render UI
    renderUI();
    
    // Setup event listeners
    setupEventListeners();
    
    // Observe Y.js changes
    observeChanges();
    
    // Setup presence tracking
    setupPresence();
    
    // Initialize with default block if empty
    if (yBlocks.length === 0) {
        addBlock('paragraph', '');
    }
    
    console.log('🚀 Collaborative Text Editor initialized');
    console.log('📡 Room:', roomName);
    console.log('👤 User ID:', userId);
}

function renderUI() {
    appContainer.innerHTML = `
        <div class="editor-app">
            <!-- Header -->
            <header class="editor-header">
                <div class="header-left">
                    <div class="logo">📝 Docs</div>
                    <div class="doc-title" contenteditable="true" id="docTitle">Untitled Document</div>
                </div>
                <div class="header-right">
                    <div class="presence-indicators" id="presenceIndicators"></div>
                    <div class="status-indicator" id="statusIndicator">
                        <span class="status-dot" id="statusDot"></span>
                        <span id="statusText">Connecting...</span>
                    </div>
                </div>
            </header>
            
            <!-- Toolbar -->
            <div class="toolbar" id="toolbar">
                <div class="toolbar-group">
                    <button class="toolbar-btn" data-format="bold" title="Bold (Ctrl+B)">
                        <strong>B</strong>
                    </button>
                    <button class="toolbar-btn" data-format="italic" title="Italic (Ctrl+I)">
                        <em>I</em>
                    </button>
                    <button class="toolbar-btn" data-format="underline" title="Underline (Ctrl+U)">
                        <u>U</u>
                    </button>
                </div>
                <div class="toolbar-divider"></div>
                <div class="toolbar-group">
                    <button class="toolbar-btn" data-block="heading1" title="Heading 1">
                        H1
                    </button>
                    <button class="toolbar-btn" data-block="heading2" title="Heading 2">
                        H2
                    </button>
                    <button class="toolbar-btn" data-block="heading3" title="Heading 3">
                        H3
                    </button>
                </div>
                <div class="toolbar-divider"></div>
                <div class="toolbar-group">
                    <button class="toolbar-btn" data-block="bulletList" title="Bullet List">
                        •
                    </button>
                    <button class="toolbar-btn" data-block="numberList" title="Numbered List">
                        1.
                    </button>
                    <button class="toolbar-btn" data-block="code" title="Code Block">
                        &lt;/&gt;
                    </button>
                    <button class="toolbar-btn" data-block="quote" title="Quote">
                        "
                    </button>
                </div>
                <div class="toolbar-divider"></div>
                <div class="toolbar-group">
                    <button class="toolbar-btn" data-action="link" title="Insert Link">
                        🔗
                    </button>
                    <button class="toolbar-btn" data-action="undo" title="Undo (Ctrl+Z)">
                        ↶
                    </button>
                    <button class="toolbar-btn" data-action="redo" title="Redo (Ctrl+Y)">
                        ↷
                    </button>
                </div>
            </div>
            
            <!-- Editor -->
            <div class="editor-container" id="editorContainer">
                <div class="editor-content" id="editorContent"></div>
                <div class="remote-cursors" id="remoteCursors"></div>
            </div>
            
            <!-- Status Bar -->
            <footer class="status-bar" id="statusBar">
                <div class="status-left">
                    <span id="wordCount">0 words</span>
                    <span class="status-separator">•</span>
                    <span id="charCount">0 characters</span>
                </div>
                <div class="status-right">
                    <span id="versionInfo">v1.0.0</span>
                </div>
            </footer>
        </div>
    `;
    
    // Cache DOM references
    editorContainer = document.getElementById('editorContainer');
    toolbar = document.getElementById('toolbar');
    statusBar = document.getElementById('statusBar');
    presenceContainer = document.getElementById('presenceIndicators');
    
    // Cache toolbar buttons
    Object.keys(toolbarButtons).forEach(key => {
        toolbarButtons[key] = toolbar.querySelector(`[data-format="${key}"], [data-block="${key}"]`);
    });
    
    // Render blocks
    renderBlocks();
}

function renderBlocks() {
    const editorContent = document.getElementById('editorContent');
    if (!editorContent) return;
    
    // Preserve focus and selection
    const activeElement = document.activeElement;
    const activeBlockId = activeElement?.dataset?.blockId;
    const selection = window.getSelection();
    let cursorPosition = 0;
    if (activeElement && activeElement.contentEditable === 'true' && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        cursorPosition = range.startOffset;
    }
    
    editorContent.innerHTML = '';
    
    yBlocks.forEach((block, index) => {
        const blockEl = createBlockElement(block, index);
        editorContent.appendChild(blockEl);
    });
    
    // Restore focus if we had a focused block
    if (activeBlockId) {
        const restoredBlock = document.querySelector(`[data-block-id="${activeBlockId}"] .block-content`);
        if (restoredBlock) {
            restoredBlock.focus();
            // Try to restore cursor position
            try {
                const range = document.createRange();
                const selection = window.getSelection();
                if (restoredBlock.firstChild) {
                    const maxPos = Math.min(cursorPosition, restoredBlock.firstChild.length || 0);
                    range.setStart(restoredBlock.firstChild, maxPos);
                    range.setEnd(restoredBlock.firstChild, maxPos);
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            } catch (e) {
                // Ignore cursor restoration errors
            }
        }
    }
}

function createBlockElement(block, index) {
    const blockEl = document.createElement('div');
    blockEl.className = `editor-block block-${block.type}`;
    blockEl.dataset.blockId = block.id;
    blockEl.dataset.index = index;
    
    // Add block type indicator
    const indicator = document.createElement('div');
    indicator.className = 'block-indicator';
    indicator.textContent = getBlockIcon(block.type);
    blockEl.appendChild(indicator);
    
    // Add content area
    const content = document.createElement('div');
    content.className = 'block-content';
    content.contentEditable = true;
    content.dataset.blockId = block.id;
    
    // Set content based on block type
    if (block.type === 'heading1' || block.type === 'heading2' || block.type === 'heading3') {
        content.classList.add(`heading-${block.type.replace('heading', '')}`);
    } else if (block.type === 'code') {
        content.classList.add('code-block');
    } else if (block.type === 'quote') {
        content.classList.add('quote-block');
    } else if (block.type === 'bulletList' || block.type === 'numberList') {
        content.classList.add('list-block');
        if (block.type === 'numberList') {
            content.style.listStyleType = 'decimal';
        }
    }
    
    content.textContent = block.content || '';
    
    // Add event listeners
    content.addEventListener('input', (e) => updateBlockContent(block.id, e.target.textContent));
    content.addEventListener('keydown', (e) => handleBlockKeydown(e, block, index));
    content.addEventListener('focus', () => selectBlock(block.id));
    content.addEventListener('blur', (e) => {
        // Update block content on blur (final sync)
        updateBlockContent(block.id, e.target.textContent);
    });
    
    blockEl.appendChild(content);
    
    return blockEl;
}

function getBlockIcon(type) {
    const icons = {
        paragraph: '¶',
        heading1: 'H1',
        heading2: 'H2',
        heading3: 'H3',
        bulletList: '•',
        numberList: '1.',
        code: '</>',
        quote: '"',
    };
    return icons[type] || '¶';
}

function updateBlockContent(blockId, content) {
    ydoc.transact(() => {
        const blocksArray = yBlocks.toArray();
        const index = blocksArray.findIndex(b => b.id === blockId);
        if (index !== -1) {
            const block = blocksArray[index];
            yBlocks.delete(index, 1);
            yBlocks.insert(index, [{ ...block, content }]);
        }
    });
}

function handleBlockKeydown(e, block, index) {
    // Handle Enter key - create new block
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const content = e.target.textContent;
        const cursorPos = getCaretPosition(e.target);
        
        let newBlockId = null;
        if (cursorPos < content.length) {
            const before = content.substring(0, cursorPos);
            const after = content.substring(cursorPos);
            
            // Update current block
            updateBlockContent(block.id, before);
            
            // Create new block with remaining content
            const newBlock = addBlock(block.type, after, index + 1);
            newBlockId = newBlock?.id;
        } else {
            // Create new empty block
            const newBlock = addBlock('paragraph', '', index + 1);
            newBlockId = newBlock?.id;
        }
        
        // Focus new block after render
        if (newBlockId) {
            setTimeout(() => {
                const newBlockEl = document.querySelector(`[data-block-id="${newBlockId}"] .block-content`);
                if (newBlockEl) {
                    newBlockEl.focus();
                }
            }, 50);
        }
    }
    
    // Handle Backspace at start - merge with previous block
    if (e.key === 'Backspace' && getCaretPosition(e.target) === 0 && index > 0) {
        e.preventDefault();
        const blocksArray = yBlocks.toArray();
        const prevBlock = blocksArray[index - 1];
        const currentContent = e.target.textContent;
        
        // Merge content
        updateBlockContent(prevBlock.id, prevBlock.content + currentContent);
        
        // Delete current block
        ydoc.transact(() => {
            yBlocks.delete(index, 1);
        });
        
        // Focus previous block
        const prevContentLen = prevBlock.content ? prevBlock.content.length : 0;
        setTimeout(() => {
            const prevBlockEl = document.querySelector(`[data-block-id="${prevBlock.id}"] .block-content`);
            if (prevBlockEl) {
                prevBlockEl.focus();
                setCaretPosition(prevBlockEl, prevContentLen);
            }
        }, 50);
    }
    
    // Handle formatting shortcuts
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') {
            e.preventDefault();
            document.execCommand('bold', false, null);
        } else if (e.key === 'i') {
            e.preventDefault();
            document.execCommand('italic', false, null);
        } else if (e.key === 'u') {
            e.preventDefault();
            document.execCommand('underline', false, null);
        }
    }
}

function getCaretPosition(element) {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    return preCaretRange.toString().length;
}

function setCaretPosition(element, position) {
    const range = document.createRange();
    const selection = window.getSelection();
    
    if (element.firstChild) {
        range.setStart(element.firstChild, Math.min(position, element.firstChild.length || 0));
        range.setEnd(element.firstChild, Math.min(position, element.firstChild.length || 0));
    } else {
        range.setStart(element, 0);
        range.setEnd(element, 0);
    }
    
    selection.removeAllRanges();
    selection.addRange(range);
}

function addBlock(type, content, index = null) {
    const block = {
        id: 'block-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        type,
        content,
        createdAt: Date.now(),
        createdBy: userId,
    };
    
    ydoc.transact(() => {
        if (index !== null && index <= yBlocks.length) {
            yBlocks.insert(index, [block]);
        } else {
            yBlocks.push([block]);
        }
    });
    
    return block;
}

function selectBlock(blockId) {
    selectedBlockId = blockId;
    document.querySelectorAll('.editor-block').forEach(block => {
        block.classList.remove('selected');
    });
    const blockEl = document.querySelector(`[data-block-id="${blockId}"]`);
    if (blockEl) {
        blockEl.classList.add('selected');
    }
}

function setupEventListeners() {
    // Toolbar buttons
    toolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.toolbar-btn');
        if (!btn) return;
        
        const format = btn.dataset.format;
        const block = btn.dataset.block;
        const action = btn.dataset.action;
        
        if (format) {
            document.execCommand(format, false, null);
            updateToolbarState();
        } else if (block) {
            if (selectedBlockId) {
                changeBlockType(selectedBlockId, block);
            } else {
                // Create new block with this type
                addBlock(block, '');
            }
        } else if (action === 'link') {
            insertLink();
        } else if (action === 'undo') {
            // Undo functionality would go here
            console.log('Undo');
        } else if (action === 'redo') {
            // Redo functionality would go here
            console.log('Redo');
        }
    });
    
    // Update toolbar state on selection change
    document.addEventListener('selectionchange', updateToolbarState);
    
    // Provider status
    provider.on('status', (event) => {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (event.status === 'connected') {
            statusDot.classList.remove('disconnected');
            statusText.textContent = 'Connected';
        } else {
            statusDot.classList.add('disconnected');
            statusText.textContent = 'Disconnected';
        }
    });
    
    // Update word/character count
    const updateCounts = () => {
        const text = Array.from(yBlocks.toArray())
            .map(b => b.content || '')
            .join(' ');
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        
        document.getElementById('wordCount').textContent = `${words} words`;
        document.getElementById('charCount').textContent = `${chars} characters`;
    };
    
    // Update counts on changes
    yBlocks.observe(updateCounts);
    updateCounts();
}

function updateToolbarState() {
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    const formatState = {
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
    };
    
    Object.keys(formatState).forEach(format => {
        const btn = toolbarButtons[format];
        if (btn) {
            btn.classList.toggle('active', formatState[format]);
        }
    });
}

function changeBlockType(blockId, newType) {
    ydoc.transact(() => {
        const blocksArray = yBlocks.toArray();
        const index = blocksArray.findIndex(b => b.id === blockId);
        if (index !== -1) {
            const block = blocksArray[index];
            yBlocks.delete(index, 1);
            yBlocks.insert(index, [{ ...block, type: newType }]);
        }
    });
}

function insertLink() {
    const url = prompt('Enter URL:');
    if (url) {
        document.execCommand('createLink', false, url);
    }
}

function observeChanges() {
    let isRendering = false;
    yBlocks.observe((event) => {
        // Prevent infinite loops by checking if we're already rendering
        if (!isRendering) {
            isRendering = true;
            // Use requestAnimationFrame to batch updates
            requestAnimationFrame(() => {
                renderBlocks();
                isRendering = false;
            });
        }
    });
}

function setupPresence() {
    awareness.on('change', () => {
        const states = Array.from(awareness.getStates().values());
        const users = states.filter(state => state.user).map(state => state.user);
        
        // Update presence indicators
        presenceContainer.innerHTML = users.slice(0, 5).map(user => `
            <div class="presence-avatar" style="background-color: ${user.color};" title="${user.name}">
                ${user.name.charAt(0).toUpperCase()}
            </div>
        `).join('');
        
        // Update remote cursors
        const activeIds = new Set();
        states.forEach(state => {
            if (state.user && state.user.id !== userId && state.cursor) {
                updateRemoteCursor(state.user, state.cursor);
                activeIds.add(state.user.id);
            }
        });
        
        remoteCursors.forEach((cursorEl, id) => {
            if (!activeIds.has(id)) {
                cursorEl.remove();
                remoteCursors.delete(id);
            }
        });
    });
    
    // Track local cursor
    document.addEventListener('mousemove', (e) => {
        const editorContent = document.getElementById('editorContent');
        if (editorContent && editorContent.contains(e.target)) {
            const rect = editorContent.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            awareness.setLocalStateField('cursor', { x, y });
        }
    });
}

function updateRemoteCursor(user, cursor) {
    let cursorEl = remoteCursors.get(user.id);
    const cursorsContainer = document.getElementById('remoteCursors');
    
    if (!cursorEl) {
        cursorEl = document.createElement('div');
        cursorEl.className = 'remote-cursor';
        cursorEl.style.color = user.color;
        cursorEl.innerHTML = `
            <div class="cursor-pointer"></div>
            <div class="curs