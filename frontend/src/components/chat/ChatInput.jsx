import { useState } from 'react'
import { IoSend } from 'react-icons/io5'
import { useChat } from '../../context/ChatContext'

const ChatInput = ({ conversationId, receiverId }) => {
  const { sendMessage, handleTyping } = useChat()
  const [message, setMessage] = useState('')

  const handleChange = (e) => {
    setMessage(e.target.value)
    handleTyping(receiverId)
  }

  const handleSend = () => {
    if (message.trim() === '') return
    sendMessage(message, conversationId, receiverId)
    setMessage('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend()
  }

  return (
    <div className="border-t bg-white p-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 rounded-full border px-5 py-3 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition"
        >
          <IoSend size={20} />
        </button>
      </div>
    </div>
  )
}

export default ChatInput