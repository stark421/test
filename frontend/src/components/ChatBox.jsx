import { useState, useRef, useEffect, useCallback } from 'react';

function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 清理未完成的请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 构建对话历史（用于上下文传递）
  const buildConversationHistory = useCallback(() => {
    // 只取最近的5轮对话（10条消息）
    const recentMessages = messages.slice(-10);
    return recentMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.role === 'user' ? msg.content : (msg.sql ? `[查询: ${msg.desc}] ${msg.content}` : msg.content)
    }));
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的AbortController
    abortControllerRef.current = new AbortController();

    // 添加一个空的assistant消息，用于流式更新
    const assistantMessageIndex = messages.length + 1; // +1 因为已经添加了user消息
    setMessages(prev => [...prev, { 
      role: 'assistant', 
      content: '', 
      sql: null, 
      desc: null,
      isStreaming: true 
    }]);

    try {
      const conversationHistory = buildConversationHistory();
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          conversationHistory: conversationHistory
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentSql = null;
      let currentDesc = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // 处理SSE数据
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留未完成的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'status':
                  // 收到状态更新
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex]?.role === 'assistant') {
                      newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        status: data.status,
                        statusMessage: data.message
                      };
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'sql':
                  // 收到SQL信息
                  currentSql = data.sql;
                  currentDesc = data.desc;
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex]?.role === 'assistant') {
                      newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        sql: currentSql,
                        desc: currentDesc
                      };
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'content':
                  // 收到内容片段，追加到消息中
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex]?.role === 'assistant') {
                      newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        content: (newMessages[lastIndex].content || '') + data.content,
                        status: null, // 收到内容后清除状态
                        statusMessage: null
                      };
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'done':
                  // 流式输出完成
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex]?.role === 'assistant') {
                      newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        isStreaming: false,
                        status: null,
                        statusMessage: null,
                        sql: data.sql !== undefined ? data.sql : currentSql,
                        desc: data.desc !== undefined ? data.desc : currentDesc
                      };
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'error':
                  // 错误信息
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex]?.role === 'assistant') {
                      newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        content: data.content,
                        isError: true,
                        isStreaming: false,
                        status: null,
                        statusMessage: null
                      };
                    }
                    return newMessages;
                  });
                  break;
              }
            } catch (parseError) {
              console.error('解析SSE数据失败:', parseError, line);
            }
          }
        }
      }
    } catch (error) {
      // 忽略取消的请求
      if (error.name === 'AbortError') {
        console.log('请求已取消');
        // 移除空的assistant消息
        setMessages(prev => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (newMessages[lastIndex]?.role === 'assistant' && newMessages[lastIndex]?.isStreaming) {
            newMessages.pop();
          }
          return newMessages;
        });
        return;
      }
      
      console.error('请求失败：', error);
      
      // 区分不同类型的错误
      let errorMessage = '网络请求失败，请检查连接后重试';
      if (error.message?.includes('HTTP error')) {
        const status = parseInt(error.message.match(/\d+/)?.[0]);
        if (status === 429) {
          errorMessage = '请求过于频繁，请稍后重试';
        } else if (status === 500) {
          errorMessage = '服务器内部错误，请稍后重试';
        } else if (status === 503) {
          errorMessage = '服务暂时不可用，请稍后重试';
        }
      }
      
      // 更新assistant消息为错误信息
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (newMessages[lastIndex]?.role === 'assistant') {
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            content: errorMessage,
            isError: true,
            isStreaming: false
          };
        }
        return newMessages;
      });
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const suggestedQuestions = [
    '哪个品类的门店营业额最高？',
    '牛肉poke六月卖了多少钱？',
    '客单价最近是涨了还是跌了？',
    '各门店营业额排名？'
  ];

  const handleSuggestedClick = (question) => {
    setInput(question);
  };

  return (
    <div className="chatbox">
      <div className="chatbox-header">
        <h3>AI 数据问答</h3>
        <p>用自然语言查询经营数据</p>
      </div>

      <div className="chatbox-messages">
        {messages.length === 0 && (
          <div className="chatbox-welcome">
            <p>您好！我是数据分析师，可以帮您查询经营数据。</p>
            <p>试试问我这些问题：</p>
            <div className="suggested-questions">
              {suggestedQuestions.map((q, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSuggestedClick(q)}
                  className="suggested-btn"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <div className={`message-content ${msg.isError ? 'is-error' : ''}`}>
              {msg.content ? (
                msg.content.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))
              ) : msg.isStreaming && msg.statusMessage ? (
                <div className="thinking-status">
                  <span className="thinking-icon">🤔</span>
                  <span className="thinking-text">{msg.statusMessage}</span>
                </div>
              ) : msg.isStreaming ? (
                <span className="streaming-cursor">▊</span>
              ) : null}
            </div>
            {msg.sql && !msg.isStreaming && (
              <div className="message-meta">
                <span className="sql-hint">查询类型：{msg.desc}</span>
              </div>
            )}
          </div>
        ))}

        {loading && !messages.some(m => m.isStreaming) && (
          <div className="message assistant">
            <div className="message-content loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form className="chatbox-input" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入您的问题..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          发送
        </button>
      </form>
    </div>
  );
}

export default ChatBox;
