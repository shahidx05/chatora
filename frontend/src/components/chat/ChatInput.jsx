import { useState, useRef, useEffect } from 'react'
import { IoSend, IoAttach, IoClose, IoDocumentText, IoArrowUndo } from 'react-icons/io5'
import { useChat } from '../../context/ChatContext'
import {
  uploadAttachment, validateFile, formatSize, ACCEPT_ATTR,
} from '../../services/upload.service'

const ChatInput = ({ conversationId, receiverId }) => {
  const { sendMessage, handleTyping, replyTo, setReplyTo } = useChat()
  const [message, setMessage] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  // free the blob URL when the preview changes or the component unmounts
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  // clear reply when conversation changes
  useEffect(() => { setReplyTo(null) }, [conversationId])

  const clearFile = () => {
    setFile(null)
    setPreview(null)
    setProgress(0)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const selectFile = (f) => {
    if (!f) return
    const problem = validateFile(f)
    if (problem) { setError(problem); return }
    setError('')
    setFile(f)
    setPreview(f.type.startsWith('image/') ? URL.createObjectURL(f) : null)
  }

  const handleChange = (e) => {
    setMessage(e.target.value)
    handleTyping(receiverId, conversationId)
  }

  // paste a screenshot straight into the input
  const handlePaste = (e) => {
    const pasted = e.clipboardData?.files?.[0]
    if (pasted && conversationId) { e.preventDefault(); selectFile(pasted) }
  }

  const handleSend = async () => {
    if (busy) return
    if (!file && message.trim() === '') return
    setError('')

    try {
      let attachment = null
      if (file) {
        setBusy(true)
        attachment = await uploadAttachment(file, conversationId, setProgress)
      }
      const res = await sendMessage(message, conversationId, receiverId, attachment, replyTo?.messageId || null)
      if (!res?.ok) {
        setError(res?.error || 'Failed to send')
        return
      }
      setMessage('')
      clearFile()
      setReplyTo(null)
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed, please try again')
    } finally {
      setBusy(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend()
  }

  // a brand-new 1:1 chat has no conversationId until the first text message is sent
  const canAttach = Boolean(conversationId) && !busy

  return (
    <div className="border-t bg-white p-4">
      {/* Reply bar */}
      {replyTo && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <IoArrowUndo size={16} className="text-blue-500 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-blue-700 truncate">
              Replying to {replyTo.senderName}
            </p>
            <p className="text-xs text-gray-500 truncate italic">{replyTo.preview}</p>
          </div>
          <button
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className="p-1 text-gray-400 hover:text-gray-700 flex-shrink-0"
          >
            <IoClose size={16} />
          </button>
        </div>
      )}

      {file && (
        <div className="mb-3 flex items-center gap-3 rounded-xl border bg-gray-50 p-2">
          {preview ? (
            <img src={preview} alt="" className="h-14 w-14 rounded-lg object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <IoDocumentText size={26} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
            {busy && (
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
          {!busy && (
            <button onClick={clearFile} aria-label="Remove attachment" className="p-1 text-gray-500 hover:text-gray-800">
              <IoClose size={20} />
            </button>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => selectFile(e.target.files?.[0])}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!canAttach}
          title={conversationId ? 'Attach a file' : 'Send a text message first to enable attachments'}
          aria-label="Attach a file"
          className="flex h-12 w-12 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 disabled:opacity-40"
        >
          <IoAttach size={24} />
        </button>

        <input
          type="text"
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={file ? 'Add a caption...' : replyTo ? `Reply to ${replyTo.senderName}...` : 'Type a message...'}
          className="flex-1 rounded-full border px-5 py-3 outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={busy}
          aria-label="Send"
          className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition disabled:opacity-60"
        >
          <IoSend size={20} />
        </button>
      </div>
    </div>
  )
}

export default ChatInput
