'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { MessageCircle, Plus, Send, Menu, X, FileText, Trash2, Download, BookOpen } from 'lucide-react'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: string
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: string
}

interface KnowledgeDocument {
  id: string
  name: string
  content: string
  uploadedAt: string
  size: number
}

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<KnowledgeDocument[]>([])
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [uploadContent, setUploadContent] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load conversations and knowledge documents from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('conversations')
    if (saved) {
      const parsed = JSON.parse(saved)
      setConversations(parsed)
      if (parsed.length > 0) {
        const firstConvId = parsed[0].id
        setCurrentConversationId(firstConvId)
        setMessages(parsed[0].messages)
      }
    }

    const savedDocs = localStorage.getItem('knowledgeDocuments')
    if (savedDocs) {
      setKnowledgeDocuments(JSON.parse(savedDocs))
    }
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      const scrollElement = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        scrollElement.scrollTop = scrollElement.scrollHeight
      }
    }, 0)
  }, [messages])

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem('conversations', JSON.stringify(conversations))
    }
  }, [conversations])

  // Save knowledge documents to localStorage whenever they change
  useEffect(() => {
    if (knowledgeDocuments.length > 0) {
      localStorage.setItem('knowledgeDocuments', JSON.stringify(knowledgeDocuments))
    }
  }, [knowledgeDocuments])

  const createNewConversation = () => {
    const newConvId = Date.now().toString()
    const newConversation: Conversation = {
      id: newConvId,
      title: 'New Conversation',
      messages: [
        {
          id: '1',
          content: 'Hi! How can I help you today?',
          role: 'assistant',
          timestamp: new Date().toLocaleString(),
        },
      ],
      createdAt: new Date().toISOString(),
    }

    setConversations([newConversation, ...conversations])
    setCurrentConversationId(newConvId)
    setMessages(newConversation.messages)
    setInput('')
  }

  const switchConversation = (convId: string) => {
    const conversation = conversations.find((c) => c.id === convId)
    if (conversation) {
      setCurrentConversationId(convId)
      setMessages(conversation.messages)
    }
  }

  const formatTimestamp = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadName.trim() || !uploadContent.trim()) return

    const newDoc: KnowledgeDocument = {
      id: Date.now().toString(),
      name: uploadName,
      content: uploadContent,
      uploadedAt: new Date().toISOString(),
      size: new Blob([uploadContent]).size,
    }

    setKnowledgeDocuments([newDoc, ...knowledgeDocuments])
    setUploadName('')
    setUploadContent('')
    setShowUploadDialog(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      setUploadName(file.name)
      setUploadContent(content)
    }
    reader.readAsText(file)
  }

  const deleteDocument = (docId: string) => {
    setKnowledgeDocuments(knowledgeDocuments.filter((doc) => doc.id !== docId))
  }

  const downloadDocument = (doc: KnowledgeDocument) => {
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(doc.content))
    element.setAttribute('download', doc.name)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading || !currentConversationId) return

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: formatTimestamp(new Date()),
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      // Update conversation title if it's the first user message
      const conversationIndex = conversations.findIndex((c) => c.id === currentConversationId)
      if (conversationIndex !== -1 && conversations[conversationIndex].messages.length === 1) {
        const newTitle = input.substring(0, 50)
        const updatedConversations = [...conversations]
        updatedConversations[conversationIndex].title = newTitle
        setConversations(updatedConversations)
      }

      // Build conversation history for context
      const conversationHistory = updatedMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }))

      // Build knowledge context if documents exist
      let knowledgeContext = ''
      if (knowledgeDocuments.length > 0) {
        knowledgeContext = `\n\nRelevant Knowledge Base:\n${knowledgeDocuments
          .map((doc) => `Document: ${doc.name}\n${doc.content}`)
          .join('\n---\n')}`
      }

      // Call the AI agent API with knowledge base context
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input + knowledgeContext,
          agent_id: '693bfaa59188cfbc911c685e',
          user_id: 'user-chat-' + currentConversationId,
          session_id: 'session-' + currentConversationId,
        }),
      })

      const data = await response.json()

      // Extract the assistant response with fallbacks
      let assistantContent = 'I encountered an error processing your request. Please try again.'

      if (data.success && data.response) {
        // Multiple fallback strategies for different response formats
        assistantContent =
          data.response?.result ||
          data.response?.response ||
          data.response?.text ||
          (typeof data.response === 'string' ? data.response : null) ||
          data.raw_response ||
          'No response generated'
      } else if (data.raw_response) {
        // Fallback to raw response if parsing failed
        assistantContent = data.raw_response
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: assistantContent,
        role: 'assistant',
        timestamp: formatTimestamp(new Date()),
      }

      const finalMessages = [...updatedMessages, assistantMessage]
      setMessages(finalMessages)

      // Update conversation with new messages
      const updatedConversations = conversations.map((conv) =>
        conv.id === currentConversationId ? { ...conv, messages: finalMessages } : conv
      )
      setConversations(updatedConversations)
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        role: 'assistant',
        timestamp: formatTimestamp(new Date()),
      }
      const finalMessages = [...updatedMessages, errorMessage]
      setMessages(finalMessages)

      const updatedConversations = conversations.map((conv) =>
        conv.id === currentConversationId ? { ...conv, messages: finalMessages } : conv
      )
      setConversations(updatedConversations)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
  }

  const currentConversation = conversations.find((c) => c.id === currentConversationId)

  return (
    <div className="flex h-screen bg-white text-gray-900">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } border-r border-gray-200 bg-gray-50 flex flex-col transition-all duration-300 overflow-hidden`}
      >
        <div className="p-4 border-b border-gray-200 space-y-2">
          <Button
            onClick={createNewConversation}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2"
          >
            <Plus size={18} />
            New Chat
          </Button>
          <Button
            onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 flex items-center gap-2"
          >
            <BookOpen size={18} />
            Knowledge Base
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => switchConversation(conv.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  currentConversationId === conv.id
                    ? 'bg-blue-100 text-blue-900'
                    : 'hover:bg-gray-200 text-gray-700'
                }`}
              >
                <div className="font-medium text-sm truncate">{conv.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(conv.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>

        {/* Knowledge Base Panel */}
        {showKnowledgeBase && (
          <div className="border-t border-gray-200 bg-white p-4 max-h-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Knowledge Documents</h3>
              <Button
                onClick={() => setShowUploadDialog(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2"
              >
                <Plus size={14} />
              </Button>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-2 pr-4">
                {knowledgeDocuments.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-8">No documents yet</p>
                ) : (
                  knowledgeDocuments.map((doc) => (
                    <div key={doc.id} className="bg-gray-50 border border-gray-200 rounded p-3 text-xs group hover:bg-gray-100 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <FileText size={14} className="text-gray-500 flex-shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 truncate">{doc.name}</div>
                            <div className="text-gray-500">{formatFileSize(doc.size)}</div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => downloadDocument(doc)}
                          className="flex-1 flex items-center justify-center gap-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 py-1 rounded text-xs"
                        >
                          <Download size={12} />
                          Download
                        </button>
                        <button
                          onClick={() => deleteDocument(doc.id)}
                          className="flex-1 flex items-center justify-center gap-1 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 py-1 rounded text-xs"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 bg-white p-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Knowledge Chat Assistant</h1>
              <p className="text-xs text-gray-500">Always here to help</p>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="p-6 space-y-6 max-w-4xl mx-auto w-full">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-lg lg:max-w-2xl ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white rounded-3xl rounded-tr-lg'
                      : 'bg-gray-100 text-gray-900 rounded-3xl rounded-tl-lg'
                  } px-6 py-3 group relative`}
                >
                  <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
                  <div
                    className={`text-xs mt-2 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp}
                  </div>

                  {message.role === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(message.content)}
                      className="absolute -top-8 right-0 opacity-0 group-hover:opacity-100 text-xs bg-gray-700 text-white px-2 py-1 rounded transition-opacity"
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 rounded-3xl rounded-tl-lg px-6 py-4">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-gray-200 bg-white p-6">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={loading}
                className="flex-1 border border-gray-300 bg-white text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500"
              />
              <Button
                type="submit"
                disabled={loading || !input.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6"
              >
                <Send size={18} />
              </Button>
            </form>
            <p className="text-xs text-gray-500 mt-3 text-center">
              Press Enter to send or click Send button
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
