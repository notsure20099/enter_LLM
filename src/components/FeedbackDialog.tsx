import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export function FeedbackDialog() {
  const [open, setOpen] = useState(false)
  const [modelName, setModelName] = useState('')
  const [modelVersion, setModelVersion] = useState('')
  const [feedbackContent, setFeedbackContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!modelName.trim() || !feedbackContent.trim()) {
      toast({
        title: '提示',
        description: '请填写模型名称和反馈内容',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      const { error } = await supabase.from('model_feedback').insert({
        model_name: modelName.trim(),
        model_version: modelVersion.trim() || null,
        feedback_content: feedbackContent.trim(),
      })

      if (error) throw error

      toast({
        title: '反馈成功',
        description: '感谢您的反馈！我们会考虑添加您建议的模型。',
      })

      // 重置表单
      setModelName('')
      setModelVersion('')
      setFeedbackContent('')
      setOpen(false)
    } catch (error) {
      console.error('Feedback error:', error)
      toast({
        title: '提交失败',
        description: '反馈提交失败，请稍后重试。',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" size="icon">
          <MessageCircle className="w-4 h-4" />
          <span className="sr-only md:not-sr-only md:inline">模型反馈</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="text-lg md:text-xl">建议新模型</DialogTitle>
            <DialogDescription className="text-xs md:text-sm">
              告诉我们您希望添加哪个AI模型，我们会考虑集成到平台中。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="model-name" className="text-sm">
                模型名称 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="model-name"
                placeholder="例如：ChatGPT, Claude, Gemini..."
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                disabled={isSubmitting}
                className="text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="model-version" className="text-sm">模型版本（可选）</Label>
              <Input
                id="model-version"
                placeholder="例如：GPT-4, Claude 3.5 Sonnet..."
                value={modelVersion}
                onChange={(e) => setModelVersion(e.target.value)}
                disabled={isSubmitting}
                className="text-sm"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feedback" className="text-sm">
                反馈内容 <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="feedback"
                placeholder="请描述您为什么希望使用这个模型，或者它的优势..."
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
                className="min-h-[80px] md:min-h-[100px] text-sm"
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting ? '提交中...' : '提交反馈'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
