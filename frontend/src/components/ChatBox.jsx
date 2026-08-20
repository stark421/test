import { useState, useRef, useEffect, useCallback } from 'react';

function ChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const chatboxRef = useRef(null);
  
  // 拖拽相关ref
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const lastMouseTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const positionRef = useRef({ x: window.innerWidth - 80, y: window.innerHeight - 80 });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 清理未完成的请求和动画
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 打开窗口时调整位置，避免超出屏幕
  useEffect(() => {
    if (isOpen) {
      adjustPositionForChatbox();
    }
  }, [isOpen]);

  // 调整位置使问答框完全显示在屏幕内
  const adjustPositionForChatbox = useCallback(() => {
    const chatboxWidth = 380;
    const chatboxHeight = 520;
    const buttonSize = 56;
    
    let x = positionRef.current.x;
    let y = positionRef.current.y;
    
    // 按钮在右侧，问答框在左侧展开
    // 所以问答框左边缘 = x - chatboxWidth - 12
    let chatboxLeft = x - chatboxWidth - 12;
    let chatboxTop = y - chatboxHeight + buttonSize;
    
    // 调整水平位置
    if (chatboxLeft < 8) {
      chatboxLeft = 8;
      x = chatboxLeft + chatboxWidth + 12;
    }
    
    // 调整垂直位置
    if (chatboxTop < 8) {
      chatboxTop = 8;
      y = chatboxTop + chatboxHeight - buttonSize;
    }
    if (chatboxTop + chatboxHeight > window.innerHeight - 8) {
      chatboxTop = window.innerHeight - chatboxHeight - 8;
      y = chatboxTop + chatboxHeight - buttonSize;
    }
    
    setPosition({ x, y });
    positionRef.current = { x, y };
  }, []);

  // 惯性动画（只在窗口关闭时生效）
  const startInertiaAnimation = useCallback(() => {
    // 如果窗口打开，不启动惯性动画，直接调整位置
    if (isOpen) {
      adjustPositionForChatbox();
      return;
    }
    
    let vx = velocityRef.current.x;
    let vy = velocityRef.current.y;
    let posX = positionRef.current.x;
    let posY = positionRef.current.y;
    
    const friction = 0.95; // 摩擦系数
    const minVelocity = 0.5; // 最小速度阈值
    
    const animate = () => {
      // 应用摩擦力
      vx *= friction;
      vy *= friction;
      
      // 更新位置
      posX += vx;
      posY += vy;
      
      // 限制在窗口范围内
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 60;
      
      posX = Math.max(0, Math.min(posX, maxX));
      posY = Math.max(0, Math.min(posY, maxY));
      
      // 碰到边界反弹
      if (posX <= 0 || posX >= maxX) {
        vx = -vx * 0.5;
      }
      if (posY <= 0 || posY >= maxY) {
        vy = -vy * 0.5;
      }
      
      // 更新位置状态
      setPosition({ x: posX, y: posY });
      positionRef.current = { x: posX, y: posY };
      
      // 如果速度还够大，继续动画
      if (Math.abs(vx) > minVelocity || Math.abs(vy) > minVelocity) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };
    
    // 只有速度足够大才启动动画
    if (Math.abs(vx) > minVelocity || Math.abs(vy) > minVelocity) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [isOpen, adjustPositionForChatbox]);

  // 拖拽功能
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const now = Date.now();
      const dt = now - lastMouseTimeRef.current;
      
      // 计算速度（像素/毫秒）
      if (dt > 0) {
        velocityRef.current = {
          x: (e.clientX - lastMousePosRef.current.x) / dt * 16, // 转换为每帧速度
          y: (e.clientY - lastMousePosRef.current.y) / dt * 16
        };
      }
      
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      lastMouseTimeRef.current = now;
      
      // 检查是否移动超过阈值，标记为已拖拽
      const moveX = Math.abs(e.clientX - dragStartPosRef.current.x);
      const moveY = Math.abs(e.clientY - dragStartPosRef.current.y);
      if (moveX > 5 || moveY > 5) {
        setHasDragged(true);
      }
      
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      
      // 限制在窗口范围内
      const maxX = window.innerWidth - 60;
      const maxY = window.innerHeight - 60;
      
      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));
      
      setPosition({ x: clampedX, y: clampedY });
      positionRef.current = { x: clampedX, y: clampedY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      // 启动惯性动画
      startInertiaAnimation();
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startInertiaAnimation]);

  const handleMouseDown = (e) => {
    // 输入框和按钮不触发拖拽
    if (e.target.closest('.chatbox-input') || e.target.closest('.suggested-btn') || e.target.closest('button[type="submit"]')) {
      return;
    }
    
    // 停止正在进行的惯性动画
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    const rect = chatboxRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    dragStartPosRef.current = {
      x: e.clientX,
      y: e.clientY
    };
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    lastMouseTimeRef.current = Date.now();
    velocityRef.current = { x: 0, y: 0 };
    
    setHasDragged(false);
    setIsDragging(true);
  };

  const handleClick = (e) => {
    // 如果发生了拖拽，不触发toggleChat
    if (hasDragged) {
      e.preventDefault();
      return;
    }
    toggleChat();
  };

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
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'status':
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
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastIndex = newMessages.length - 1;
                    if (newMessages[lastIndex]?.role === 'assistant') {
                      newMessages[lastIndex] = {
                        ...newMessages[lastIndex],
                        content: (newMessages[lastIndex].content || '') + data.content,
                        status: null,
                        statusMessage: null
                      };
                    }
                    return newMessages;
                  });
                  break;
                  
                case 'done':
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
      if (error.name === 'AbortError') {
        console.log('请求已取消');
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

  const toggleChat = () => {
    setIsOpen(prev => !prev);
  };

  const containerStyle = {
    position: 'fixed',
    left: position.x + 'px',
    top: position.y + 'px',
    zIndex: 1000,
    cursor: isDragging ? 'grabbing' : 'grab'
  };

  return (
    <div 
      className="chat-float-container" 
      ref={chatboxRef}
      style={containerStyle}
      onMouseDown={handleMouseDown}
    >
      {/* 悬浮按钮 */}
      <button 
        className={`chat-float-button ${isOpen ? 'active' : ''}`} 
        onClick={(e) => {
          e.stopPropagation();
          handleClick(e);
        }}
        title="AI 数据问答"
      >
        {isOpen ? (
          <span className="chat-float-close">×</span>
        ) : (
          <span className="chat-float-icon">AI</span>
        )}
      </button>

      {/* 问答框 */}
      {isOpen && (
        <div className="chatbox chatbox-float">
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
      )}
    </div>
  );
}

export default ChatBox;
