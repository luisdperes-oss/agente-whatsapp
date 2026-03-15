const express = require("express")
const fetch = require("node-fetch")
const OpenAI = require("openai")
require("dotenv").config()

const app = express()
app.use(express.json())

const VERIFY_TOKEN = "Asriel1108**"

/* -----------------------------
MEMÓRIA DE CONVERSA
----------------------------- */

const memoria = {}

/* -----------------------------
OPENAI
----------------------------- */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/* -----------------------------
FUNÇÃO PESQUISA
----------------------------- */

async function pesquisar(pergunta){

const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(pergunta)}&format=json&lang=pt-br`

const response = await fetch(url)
const data = await response.json()

if(data.Abstract){
return data.Abstract
}

if(data.RelatedTopics?.[0]?.Text){
return data.RelatedTopics[0].Text
}

return "Não encontrei resposta para essa pesquisa."
}

/* -----------------------------
VERIFICAÇÃO WEBHOOK
----------------------------- */

app.get("/webhook",(req,res)=>{

const mode = req.query["hub.mode"]
const token = req.query["hub.verify_token"]
const challenge = req.query["hub.challenge"]

if(mode==="subscribe" && token===VERIFY_TOKEN){

console.log("Webhook verificado")
res.status(200).send(challenge)

}else{

console.log("Falha verificação webhook")
res.sendStatus(403)

}

})

/* -----------------------------
RECEBIMENTO MENSAGEM
----------------------------- */

app.post("/webhook", async (req,res)=>{

console.log("Evento recebido")

try{

const messageData = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

if(!messageData){
return res.sendStatus(200)
}

const message = messageData.text?.body
const from = messageData.from
const phone_id = req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id

console.log("Mensagem:",message)
console.log("Numero:",from)
console.log("PhoneID:",phone_id)

if(!message){
return res.sendStatus(200)
}

let resposta = null

/* -----------------------------
COMANDOS
----------------------------- */

if(message === "/menu"){

resposta = `
🤖 *Agente Luis*

Comandos disponíveis:

/menu
/ajuda
/pesquisa pergunta
`

}

else if(message === "/ajuda"){

resposta = `
Sou o *Agente Luis*

Posso responder perguntas,
fazer pesquisas e ajudar em tarefas.

Digite /menu
`

}

else if(message.startsWith("/pesquisa")){

const pergunta = message.replace("/pesquisa","").trim()

if(!pergunta){

resposta = "Digite algo depois de /pesquisa"

}else{

const resultado = await pesquisar(pergunta)

resposta = `🔎 Pesquisa

${resultado}`

}

}

/* -----------------------------
IA COM MEMÓRIA
----------------------------- */

if(!resposta){

if(!memoria[from]){
memoria[from] = []
}

memoria[from].push({
role:"user",
content:message
})

const ai = await openai.chat.completions.create({
model:"gpt-4.1-mini",
messages:[
{
role:"system",
content:"Você é o Agente Luis, assistente pessoal inteligente no WhatsApp."
},
...memoria[from]
]
})

resposta = ai.choices[0].message.content

memoria[from].push({
role:"assistant",
content:resposta
})

}

console.log("Resposta:",resposta)

/* -----------------------------
ENVIA WHATSAPP
----------------------------- */

const respostaMeta = await fetch(
`https://graph.facebook.com/v19.0/${phone_id}/messages`,
{
method:"POST",
headers:{
"Content-Type":"application/json",
Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`
},
body:JSON.stringify({
messaging_product:"whatsapp",
recipient_type:"individual",
to:from,
type:"text",
text:{
preview_url:false,
body:resposta
}
})
}
)

const resultadoMeta = await respostaMeta.json()

console.log("Resposta META:",resultadoMeta)

}catch(err){

console.log("Erro servidor:",err)

}

res.sendStatus(200)

})

/* -----------------------------
SERVIDOR
----------------------------- */

const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
console.log("Servidor rodando porta",PORT)
})