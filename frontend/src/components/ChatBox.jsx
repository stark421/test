import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

function ChatBox() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const { data } = await axios.post('/api/ai/chat', { question: userMessage });
      
      if (data.success) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.data.answer,
          sql: data.data.sql,
          desc: data.data.desc
        }]);
      } else {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: '抱歉，处理问题时出错：' + data.error,
          isError: true
        }]);
      }
    } catch (error) {
      console.error('请求失败：', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '网络请求失败，请检查连接后重试',
        isError: true
      }]);
    } finally {
      setLoading(false);
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
            <div className="message-content">
              {msg.content.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            {msg.sql && (
              <div className="message-meta">
                <span className="sql-hint">查询类型：{msg.desc}</span>
              </div>
            )}
          </div>
        ))}

        {loading && (
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
