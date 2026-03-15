const express = require("express")
const fetch = require("node-fetch")
const OpenAI = require("openai")
const { MongoClient } = require("mongodb")
require("dotenv").config()

const app = express()
app.use(express.json())

const VERIFY_TOKEN = "Asriel1108**"

/* -----------------------------
MONGODB
----------------------------- */

const client = new MongoClient(process.env.MONGO_URI)

let db

async function conectarDB(){
try{
await client.connect()
db = client.db("agente")
console.log("MongoDB conectado")
}catch(err){
console.log("Erro ao conectar MongoDB:",err)
}
}

conectarDB()

/* -----------------------------
OPENAI
----------------------------- */

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
})

/* -----------------------------
PESQUISA
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
VERIFICAR WEBHOOK
----------------------------- */

app.get("/webhook",(req,res)=>{

const mode = req.query["hub.mode"]
const token = req.query["hub.verify_token"]
const challenge = req.query["hub.challenge"]

if(mode==="subscribe" && token===VERIFY_TOKEN){
console.log("Webhook verificado")
res.status(200).send(challenge)
}else{
res.sendStatus(403)
}

})

/* -----------------------------
RECEBER MENSAGEM
----------------------------- */

app.post("/webhook", async (req,res)=>{

try{

const messageData = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]

if(!messageData){
return res.sendStatus(200)
}

const message = messageData.text?.body?.trim()
const from = messageData.from
const phone_id = req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id

if(!message){
return res.sendStatus(200)
}

let resposta = null

/* -----------------------------
SALVAR NOME
Aceita:
meu nome é
meu nome e
----------------------------- */

const regexNome = /meu nome [eé]\s+(.*)/i
const match = message.match(regexNome)

if(match){

const nome = match[1].trim()

await db.collection("usuarios").updateOne(
{ telefone: from },
{ $set: { nome: nome } },
{ upsert: true }
)

resposta = `Prazer ${nome}! Vou lembrar do seu nome.`

}

/* -----------------------------
PERGUNTAR NOME
Aceita:
qual é meu nome
qual e meu nome
----------------------------- */

else if(/qual\s+[eé]\s+meu\s+nome/i.test(message)){

const usuario = await db.collection("usuarios").findOne({ telefone: from })

if(usuario?.nome){

resposta = `Seu nome é ${usuario.nome}.`

}else{

resposta = "Você ainda não me disse seu nome."

}

}

/* -----------------------------
COMANDOS
----------------------------- */

else if(message === "/menu"){

resposta = `
🤖 *Agente Luis*

Comandos disponíveis

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
IA
----------------------------- */

if(!resposta){

const ai = await openai.chat.completions.create({
model:"gpt-4.1-mini",
messages:[
{
role:"system",
content:"Você é o Agente Luis, assistente pessoal inteligente no WhatsApp."
},
{
role:"user",
content:message
}
]
})

resposta = ai.choices[0].message.content

}

/* -----------------------------
ENVIAR WHATSAPP
----------------------------- */

await fetch(
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