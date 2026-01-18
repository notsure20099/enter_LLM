import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Message {
  role: string
  content: string
}

// 获取百度文心一言的access token
async function getWenxinAccessToken(apiKey: string, secretKey: string) {
  const response = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`
  )
  const data = await response.json()
  return data.access_token
}

// 调用豆包API
async function callDoubao(messages: Message[], apiKey: string) {
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'doubao-pro-32k',
      messages: messages,
      stream: true,
    }),
  })
  return response
}

// 调用DeepSeek API
async function callDeepSeek(messages: Message[], apiKey: string) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      stream: true,
    }),
  })
  return response
}

// 调用文心一言API
async function callWenxin(messages: Message[], apiKey: string, secretKey: string) {
  const accessToken = await getWenxinAccessToken(apiKey, secretKey)
  
  const response = await fetch(
    `https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions?access_token=${accessToken}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages,
        stream: true,
      }),
    }
  )
  return response
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, model, conversationId } = await req.json()

    const doubaoKey = Deno.env.get('DOUBAO_API_KEY')
    const deepseekKey = Deno.env.get('DEEPSEEK_API_KEY')
    const wenxinKey = Deno.env.get('WENXIN_API_KEY')
    const wenxinSecret = Deno.env.get('WENXIN_SECRET_KEY')

    if (!doubaoKey || !deepseekKey || !wenxinKey || !wenxinSecret) {
      throw new Error('API keys not configured')
    }

    let response: Response

    switch (model) {
      case 'doubao':
        response = await callDoubao(messages, doubaoKey)
        break
      case 'deepseek':
        response = await callDeepSeek(messages, deepseekKey)
        break
      case 'wenxin':
        response = await callWenxin(messages, wenxinKey, wenxinSecret)
        break
      default:
        throw new Error('Invalid model')
    }

    // 返回流式响应
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})