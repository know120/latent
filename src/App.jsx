import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const PROVIDERS = {
  google: {
    name: 'Google Gemini',
    help: 'Find your API key in <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>.',
    label: 'Google API Key',
    models: [
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
    ]
  },
  openai: {
    name: 'OpenAI',
    help: 'Find your API key in your <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Dashboard</a>.',
    label: 'OpenAI API Key',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini' },
      { id: 'o1-preview', name: 'o1 Preview' },
      { id: 'o1-mini', name: 'o1 mini' }
    ]
  }
};

const SUGGESTIONS = [
  'Explain quantum computing in simple terms',
  'Write a Python script to sort a CSV file',
  'What are the best practices for React performance?',
  'Summarize the plot of Inception',
];

function CodeBlock({ className, children }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <pre className={className}>
      <button className="copy-code-btn" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <code>{code}</code>
    </pre>
  );
}

function App() {
  const [error, setError] = useState(null);
  const [config, setConfig] = useState(null);
  const [conversations, setConversations] = useState([
    { id: '1', title: 'Welcome Chat', messages: [
      { role: 'user', text: 'Hello, I need help with some questions.', time: Date.now() - 60000 },
      { role: 'model', text: 'Welcome to Latent Chat! I\'m your AI assistant. How can I help you today?', time: Date.now() - 30000 }
    ]}
  ]);
  const [activeConvId, setActiveConvId] = useState('1');
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [setupProvider, setSetupProvider] = useState('google');
  const [setupApiKey, setSetupApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0];
  const messages = activeConv ? activeConv.messages : [];

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && showSettings) {
        setShowSettings(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showSettings]);

  async function initApp() {
    try {
      const currentConfig = await invoke('get_config');
      setConfig(currentConfig);
      setSetupProvider(currentConfig.activeProvider);
      const activePConfig = currentConfig.providers[currentConfig.activeProvider];
      setSetupApiKey(activePConfig.apiKey || '');
      if (!activePConfig.apiKey) {
        setShowSettings(true);
      }
    } catch (e) {
      setError(typeof e === 'string' ? e : e.message || String(e));
    }
  }

  function updateConversation(convId, newMessages) {
    setConversations(prev => prev.map(c =>
      c.id === convId ? { ...c, messages: newMessages } : c
    ));
  }

  async function handleSend() {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', text: userMsg, time: Date.now() }];
    updateConversation(activeConvId, newMessages);
    setIsThinking(true);

    try {
      const chatHistory = newMessages.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }]
      }));
      const aiResponse = await invoke('send_to_ai', { userMessage: userMsg, chatHistory });
      const finalMessages = [...newMessages, { role: 'model', text: aiResponse, time: Date.now() }];
      updateConversation(activeConvId, finalMessages);
    } catch (e) {
      const errMsg = typeof e === 'string' ? e : e.message || String(e);
      const finalMessages = [...newMessages, { role: 'model', text: `Error: ${errMsg}`, time: Date.now() }];
      updateConversation(activeConvId, finalMessages);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  }

  function handleNewChat() {
    const id = String(Date.now());
    setConversations(prev => [{ id, title: 'New Chat', messages: [] }, ...prev]);
    setActiveConvId(id);
  }

  function handleDeleteConv(id) {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (id === activeConvId) {
      setActiveConvId(conversations.filter(c => c.id !== id)[0]?.id || '1');
    }
  }

  function handleSuggestion(text) {
    setInput(text);
    setTimeout(() => handleSend(), 100);
  }

  function handleCopyMessage(text) {
    navigator.clipboard.writeText(text);
  }

  async function handleProviderChange(providerId) {
    if (!config) return;
    const newConfig = { ...config, activeProvider: providerId };
    setConfig(newConfig);
    const pConfig = newConfig.providers[providerId];
    setSetupProvider(providerId);
    setSetupApiKey(pConfig.apiKey || '');
    if (!pConfig.apiKey) {
      setShowSettings(true);
    } else {
      await invoke('save_config', { config: newConfig });
    }
  }

  async function handleModelChange(modelId) {
    if (!config) return;
    const newConfig = {
      ...config,
      providers: {
        ...config.providers,
        [config.activeProvider]: {
          ...config.providers[config.activeProvider],
          selectedModel: modelId,
        },
      },
    };
    setConfig(newConfig);
    await invoke('save_config', { config: newConfig });
  }

  async function handleSaveApiKey() {
    if (!setupApiKey.trim()) return;
    try {
      const newConfig = {
        ...config,
        activeProvider: setupProvider,
        providers: {
          ...config.providers,
          [setupProvider]: {
            ...config.providers[setupProvider],
            apiKey: setupApiKey.trim(),
          },
        },
      };
      await invoke('save_config', { config: newConfig });
      setConfig(newConfig);
      setShowSettings(false);
    } catch (e) {
      alert(`Error: ${e}`);
    }
  }

  function handleInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (error) return <div style={{ padding: 20, color: '#f87171' }}>Error: {error}</div>;
  if (!config) return <div className="empty-state"><p>Loading...</p></div>;

  const activePConfig = config.providers[config.activeProvider];

  return (
    <div className="app-container">
      <div className="bg-orbs">
        <div className="bg-orb" />
        <div className="bg-orb" />
        <div className="bg-orb" />
      </div>

      {/* ── Sidebar ── */}
      <div className={`sidebar${sidebarOpen ? '' : ' collapsed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <img src="logo.svg" alt="Latent" className="sidebar-logo-img" />
            <h1>Latent</h1>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>

        <button className="new-chat-btn" onClick={handleNewChat}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Chat</span>
        </button>

        <div className="conversation-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === activeConvId ? 'active' : ''}`}
              onClick={() => setActiveConvId(conv.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>{conv.title}</span>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="sidebar-footer-btn" onClick={() => setShowSettings(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            <span>Settings</span>
          </button>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div className="main-area">
        {/* Header */}
        <div className="main-header">
          <select
            className="header-select"
            value={config.activeProvider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            <option value="google">Google Gemini</option>
            <option value="openai">OpenAI</option>
          </select>
          <select
            className="header-select"
            value={activePConfig.selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            {PROVIDERS[config.activeProvider].models.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <span className="header-status">
            {isThinking ? 'Generating...' : (activePConfig.apiKey ? 'Connected' : 'No API key')}
          </span>
        </div>

        {/* Chat */}
        <div className="chat-container">
          <div className="chat-area">
            {messages.length === 0 ? (
              <div className="empty-state">
                <img src="logo.svg" alt="Latent" className="empty-state-logo" />
                <h2>How can I help you?</h2>
                <p>Ask me anything — I'm your AI-powered assistant.</p>
                <div className="suggestion-chips">
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} className="suggestion-chip" onClick={() => handleSuggestion(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <div key={i} className={`message ${m.role === 'user' ? 'user-message' : 'ai-message'}`}>
                    {m.role === 'model' ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          pre: ({ node, ...props }) => <CodeBlock {...props} />,
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    ) : (
                      m.text.split('\n').map((line, idx) => (
                        <React.Fragment key={idx}>
                          {line}
                          {idx < m.text.split('\n').length - 1 && <br />}
                        </React.Fragment>
                      ))
                    )}
                    <div className="message-footer">
                      {m.time && <div className="message-timestamp">{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>}
                      <div className="message-actions">
                        <button className="message-action-btn" onClick={() => handleCopyMessage(m.text)} title="Copy">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="typing-indicator">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                )}
              </>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Type your message..."
              disabled={isThinking}
              rows={1}
            />
            <div className="input-actions">
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={isThinking || !input.trim()}
                title="Send message"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <>
          <div className="settings-overlay" onClick={() => setShowSettings(false)} />
          <div className="settings-panel">
            <div className="settings-header">
              <h2>Settings</h2>
              <button className="settings-close-btn" onClick={() => setShowSettings(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="settings-body">
              <div className="settings-section">
                <label>AI Provider</label>
                <select value={setupProvider} onChange={(e) => setSetupProvider(e.target.value)}>
                  <option value="google">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="settings-section">
                <label>{PROVIDERS[setupProvider].label}</label>
                <div className="api-input-wrapper">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={setupApiKey}
                    onChange={(e) => setSetupApiKey(e.target.value)}
                    placeholder="Enter your API key..."
                  />
                  <button
                    className="toggle-visibility"
                    onClick={() => setShowApiKey(!showApiKey)}
                    title="Toggle visibility"
                  >
                    {showApiKey ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button className="save-btn" onClick={handleSaveApiKey}>Save Configuration</button>
              <div className="api-help" dangerouslySetInnerHTML={{ __html: PROVIDERS[setupProvider].help }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
