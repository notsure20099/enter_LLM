import { useState, useCallback, useEffect } from 'react'
import { ModelChat } from '@/components/ModelChat'
import { FeedbackDialog } from '@/components/FeedbackDialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, RotateCcw, Settings2, Menu } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ModelState {
  messages: Message[]
  isLoading: boolean
  streamingContent: string
}

interface AIModel {
  id: string
  provider: string
  model_name: string
  model_version: string
  is_default: boolean
}

export default function Index() {
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const { toast } = useToast()

  // 模型配置状态
  const [availableModels, setAvailableModels] = useState<AIModel[]>([])
  const [selectedModels, setSelectedModels] = useState({
    doubao: '',
    deepseek: '',
    wenxin: ''
  })
  const [modelVersions, setModelVersions] = useState({
    doubao: 'Doubao-pro-32k',
    deepseek: 'deepseek-chat',
    wenxin: 'ERNIE-Bot-4'
  })

  const [doubaoState, setDoubaoState] = useState<ModelState>({
    messages: [],
    isLoading: false,
    streamingContent: '',
  })

  const [deepseekState, setDeepseekState] = useState<ModelState>({
    messages: [],
    isLoading: false,
    streamingContent: '',
  })

  const [wenxinState, setWenxinState] = useState<ModelState>({
    messages: [],
    isLoading: false,
    streamingContent: '',
  })

  // 加载可用模型列表
  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    const { data, error } = await supabase
      .from('ai_models')
      .select('*')
      .order('is_default', { ascending: false })

    if (error) {
      console.error('Error loading models:', error)
      return
    }

    setAvailableModels(data || [])
    
    // 设置默认选中的模型
    const doubaoDefault = data?.find(m => m.provider === 'doubao' && m.is_default)
    const deepseekDefault = data?.find(m => m.provider === 'deepseek' && m.is_default)
    const wenxinDefault = data?.find(m => m.provider === 'wenxin' && m.is_default)

    if (doubaoDefault) {
      setSelectedModels(prev => ({ ...prev, doubao: doubaoDefault.id }))
      setModelVersions(prev => ({ ...prev, doubao: doubaoDefault.model_version }))
    }
    if (deepseekDefault) {
      setSelectedModels(prev => ({ ...prev, deepseek: deepseekDefault.id }))
      setModelVersions(prev => ({ ...prev, deepseek: deepseekDefault.model_version }))
    }
    if (wenxinDefault) {
      setSelectedModels(prev => ({ ...prev, wenxin: wenxinDefault.id }))
      setModelVersions(prev => ({ ...prev, wenxin: wenxinDefault.model_version }))
    }
  }

  const handleModelChange = (provider: 'doubao' | 'deepseek' | 'wenxin', modelId: string) => {
    const model = availableModels.find(m => m.id === modelId)
    if (model) {
      setSelectedModels(prev => ({ ...prev, [provider]: modelId }))
      setModelVersions(prev => ({ ...prev, [provider]: model.model_version }))
      toast({
        title: '模型已切换',
        description: `${model.model_name} - ${model.model_version}`,
      })
    }
  }

  const processStream = useCallback(async (
    response: Response,
    model: 'doubao' | 'deepseek' | 'wenxin',
    setState: React.Dispatch<React.SetStateAction<ModelState>>
  ) => {
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    if (!reader) return

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const json = JSON.parse(data)
              const content = json.choices?.[0]?.delta?.content || json.result || ''
              
              if (content) {
                fullContent += content
                setState(prev => ({
                  ...prev,
                  streamingContent: fullContent,
                }))
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }

      // 保存助手消息到数据库
      if (conversationId && fullContent) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullContent,
          model: model,
        })
      }

      setState(prev => ({
        ...prev,
        messages: [...prev.messages, { role: 'assistant', content: fullContent }],
        isLoading: false,
        streamingContent: '',
      }))
    } catch (error) {
      console.error('Stream error:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        streamingContent: '',
      }))
    }
  }, [conversationId])

  const sendMessage = useCallback(async () => {
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')

    // 创建新会话（如果不存在）
    let currentConversationId = conversationId
    if (!currentConversationId) {
      const { data, error } = await supabase
        .from('conversations')
        .insert({})
        .select()
        .single()

      if (error) {
        toast({
          title: '错误',
          description: '创建会话失败',
          variant: 'destructive',
        })
        return
      }

      currentConversationId = data.id
      setConversationId(currentConversationId)
    }

    // 保存用户消息到数据库
    await supabase.from('messages').insert({
      conversation_id: currentConversationId,
      role: 'user',
      content: userMessage,
    })

    // 更新三个模型的状态
    const newUserMessage: Message = { role: 'user', content: userMessage }

    setDoubaoState(prev => ({
      ...prev,
      messages: [...prev.messages, newUserMessage],
      isLoading: true,
    }))

    setDeepseekState(prev => ({
      ...prev,
      messages: [...prev.messages, newUserMessage],
      isLoading: true,
    }))

    setWenxinState(prev => ({
      ...prev,
      messages: [...prev.messages, newUserMessage],
      isLoading: true,
    }))

    // 并行调用三个模型
    const callModel = async (
      model: 'doubao' | 'deepseek' | 'wenxin',
      messages: Message[],
      setState: React.Dispatch<React.SetStateAction<ModelState>>
    ) => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        const response = await fetch(
          `https://dbbvoayecnmruogmrafi.supabase.co/functions/v1/chat-with-models`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRiYnZvYXllY25tcnVvZ21yYWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1Mjk2NzgsImV4cCI6MjA4NDEwNTY3OH0.qpgqAdqOfUHkdJiPMQvsgNjbWWMspSB16AKWDgxtVso'}`,
            },
            body: JSON.stringify({
              messages: messages,
              model: model,
              conversationId: currentConversationId,
            }),
          }
        )

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        await processStream(response, model, setState)
      } catch (error) {
        console.error(`${model} error:`, error)
        setState(prev => ({
          ...prev,
          isLoading: false,
          messages: [
            ...prev.messages,
            { role: 'assistant', content: '抱歉，发生了错误，请稍后重试。' },
          ],
        }))
      }
    }

    await Promise.all([
      callModel('doubao', [...doubaoState.messages, newUserMessage], setDoubaoState),
      callModel('deepseek', [...deepseekState.messages, newUserMessage], setDeepseekState),
      callModel('wenxin', [...wenxinState.messages, newUserMessage], setWenxinState),
    ])
  }, [input, conversationId, doubaoState.messages, deepseekState.messages, wenxinState.messages, toast, processStream])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearConversation = () => {
    setDoubaoState({ messages: [], isLoading: false, streamingContent: '' })
    setDeepseekState({ messages: [], isLoading: false, streamingContent: '' })
    setWenxinState({ messages: [], isLoading: false, streamingContent: '' })
    setConversationId(null)
    toast({
      title: '对话已清除',
      description: '所有模型的对话历史已清空',
    })
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background">
      {/* 标题栏 - 移动端优化 */}
      <div className="px-4 md:px-8 py-3 md:py-6 border-b border-border bg-card/30 backdrop-blur-sm flex justify-between items-center">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-3xl font-bold text-foreground truncate">AI 模型对比平台</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1 hidden sm:block">同时对比豆包、DeepSeek、文心一言三个模型</p>
        </div>
        
        {/* 桌面端按钮组 */}
        <div className="hidden md:flex gap-3">
          <Button
            variant="outline"
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="gap-2"
          >
            <Settings2 className="w-4 h-4" />
            {showModelSelector ? '隐藏设置' : '模型设置'}
          </Button>
          <FeedbackDialog />
          <Button
            variant="outline"
            onClick={clearConversation}
            disabled={doubaoState.isLoading || deepseekState.isLoading || wenxinState.isLoading}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            清除对话
          </Button>
        </div>
        
        {/* 移动端菜单 */}
        <div className="flex md:hidden gap-2">
          <FeedbackDialog />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setShowModelSelector(!showModelSelector)}>
                <Settings2 className="w-4 h-4 mr-2" />
                {showModelSelector ? '隐藏设置' : '模型设置'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={clearConversation}>
                <RotateCcw className="w-4 h-4 mr-2" />
                清除对话
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 模型选择器 - 移动端优化 */}
      {showModelSelector && (
        <div className="px-4 md:px-8 py-4 border-b border-border bg-secondary/30 backdrop-blur-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">豆包模型版本</label>
              <Select
                value={selectedModels.doubao}
                onValueChange={(value) => handleModelChange('doubao', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择版本" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels
                    .filter(m => m.provider === 'doubao')
                    .map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.model_version}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">DeepSeek模型版本</label>
              <Select
                value={selectedModels.deepseek}
                onValueChange={(value) => handleModelChange('deepseek', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择版本" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels
                    .filter(m => m.provider === 'deepseek')
                    .map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.model_version}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">文心一言模型版本</label>
              <Select
                value={selectedModels.wenxin}
                onValueChange={(value) => handleModelChange('wenxin', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择版本" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels
                    .filter(m => m.provider === 'wenxin')
                    .map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.model_version}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* 三个模型显示区域 - 响应式布局 */}
      {/* 桌面端：三列并排显示 */}
      <div className="hidden md:grid flex-1 md:grid-cols-3 gap-6 p-6 overflow-hidden">
        <ModelChat
          model="doubao"
          modelName="豆包"
          modelVersion={modelVersions.doubao}
          messages={doubaoState.messages}
          isLoading={doubaoState.isLoading}
          streamingContent={doubaoState.streamingContent}
        />
        <ModelChat
          model="deepseek"
          modelName="DeepSeek"
          modelVersion={modelVersions.deepseek}
          messages={deepseekState.messages}
          isLoading={deepseekState.isLoading}
          streamingContent={deepseekState.streamingContent}
        />
        <ModelChat
          model="wenxin"
          modelName="文心一言"
          modelVersion={modelVersions.wenxin}
          messages={wenxinState.messages}
          isLoading={wenxinState.isLoading}
          streamingContent={wenxinState.streamingContent}
        />
      </div>

      {/* 移动端：Tab切换显示 */}
      <div className="flex-1 md:hidden overflow-hidden">
        <Tabs defaultValue="doubao" className="h-full flex flex-col">
          <TabsList className="w-full grid grid-cols-3 rounded-none border-b">
            <TabsTrigger value="doubao" className="text-xs sm:text-sm">豆包</TabsTrigger>
            <TabsTrigger value="deepseek" className="text-xs sm:text-sm">DeepSeek</TabsTrigger>
            <TabsTrigger value="wenxin" className="text-xs sm:text-sm">文心一言</TabsTrigger>
          </TabsList>
          <TabsContent value="doubao" className="flex-1 p-4 mt-0">
            <ModelChat
              model="doubao"
              modelName="豆包"
              modelVersion={modelVersions.doubao}
              messages={doubaoState.messages}
              isLoading={doubaoState.isLoading}
              streamingContent={doubaoState.streamingContent}
            />
          </TabsContent>
          <TabsContent value="deepseek" className="flex-1 p-4 mt-0">
            <ModelChat
              model="deepseek"
              modelName="DeepSeek"
              modelVersion={modelVersions.deepseek}
              messages={deepseekState.messages}
              isLoading={deepseekState.isLoading}
              streamingContent={deepseekState.streamingContent}
            />
          </TabsContent>
          <TabsContent value="wenxin" className="flex-1 p-4 mt-0">
            <ModelChat
              model="wenxin"
              modelName="文心一言"
              modelVersion={modelVersions.wenxin}
              messages={wenxinState.messages}
              isLoading={wenxinState.isLoading}
              streamingContent={wenxinState.streamingContent}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* 输入区域 - 移动端优化 */}
      <div className="px-4 md:px-8 py-4 md:py-6 border-t border-border bg-card/30 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex gap-2 md:gap-4 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="输入您的问题..."
            className="min-h-[50px] md:min-h-[60px] max-h-[150px] md:max-h-[200px] resize-none bg-secondary/50 border-border focus:border-primary text-sm md:text-base"
            disabled={doubaoState.isLoading || deepseekState.isLoading || wenxinState.isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || doubaoState.isLoading || deepseekState.isLoading || wenxinState.isLoading}
            size="lg"
            className="h-[50px] md:h-[60px] px-4 md:px-8 shrink-0"
          >
            <Send className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
