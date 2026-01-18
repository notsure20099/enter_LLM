import { useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, MessageSquare } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ModelChatProps {
  model: 'doubao' | 'deepseek' | 'wenxin'
  modelName: string
  modelVersion?: string
  messages: Message[]
  isLoading: boolean
  streamingContent: string
}

export function ModelChat({ modelName, modelVersion, messages, isLoading, streamingContent }: ModelChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // 优化自动滚动逻辑：确保在ScrollArea内平滑滚动到底部
  useEffect(() => {
    if (messagesEndRef.current) {
      // 强制触发重绘后滚动，避免内容未渲染完成导致滚动失效
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'end' // 确保滚动到锚点底部
        })
      }, 0)
    }
  }, [messages, streamingContent])

  const isEmpty = messages.length === 0 && !isLoading && !streamingContent

  return (
    <Card className="flex flex-col h-full md:h-[70vh] border-border bg-card/50 backdrop-blur-sm">
      <div className="px-4 md:px-6 py-3 md:py-4 border-b border-border bg-primary/5">
        <h2 className="text-lg md:text-xl font-semibold text-foreground">{modelName}</h2>
        {modelVersion && (
          <p className="text-xs text-muted-foreground mt-1">{modelVersion}</p>
        )}
      </div>
      
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <div className="p-3 md:p-6">
            {isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground min-h-[200px] md:min-h-[300px]">
                <MessageSquare className="w-12 h-12 md:w-16 md:h-16 mb-4 opacity-20" />
                <p className="text-xs md:text-sm">等待提问...</p>
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[90%] md:max-w-[85%] rounded-xl md:rounded-2xl px-3 py-2 md:px-4 md:py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground shadow-lg'
                          : 'bg-secondary text-secondary-foreground'
                      }`}
                    >
                      <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                ))}
                
                {streamingContent && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="max-w-[90%] md:max-w-[85%] rounded-xl md:rounded-2xl px-3 py-2 md:px-4 md:py-3 bg-secondary text-secondary-foreground">
                      <p className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">{streamingContent}</p>
                    </div>
                  </div>
                )}
                
                {isLoading && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="rounded-xl md:rounded-2xl px-3 py-2 md:px-4 md:py-3 bg-secondary">
                      <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} className="h-0 w-0 mt-1" />
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </Card>
  )
}