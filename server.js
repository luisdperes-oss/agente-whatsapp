const express = require("express")
const fetch = require("node-fetch")
const OpenAI = require("openai")
require("dotenv").config()

const app = express()
app.use(express.json())

const openai = new OpenAI({
apiKey: process.env.OPENAI_API_KEY
})

const VERIFY_TOKEN = "Asriel1108**"

app.get("/webhook",(req,res)=>{

const mode = req.query["hub.mode"]
const token = req.query["hub.verify_token"]
const challenge = req.query["hub.challenge"]

if(mode==="subscribe" && token===VERIFY_TOKEN){
console.log("Webhook verificado!")
res.status(200).send(challenge)
}else{
res.sendStatus(403)
}

})

app.post("/webhook", async (req,res)=>{

console.log("Evento recebido:")
console.log(JSON.stringify(req.body,null,2))

try{

const message =
req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body

const from =
req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from

const phone_id =
req.body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id

if(message){

console.log("Mensagem recebida:",message)

const ai = await openai.chat.completions.create({
model:"gpt-4.1-mini",
messages:[
{
role:"system",
content:"Você é um assistente pessoal chamado Agente Luis e responde pelo WhatsApp."
},
{
role:"user",
content:message
}
]
})

const resposta = ai.choices[0].message.content

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
to:from,
type:"text",
text:{body:resposta}
})
}
)

}

}catch(err){
console.log("Erro:",err)
}

res.sendStatus(200)

})

app.listen(3000,()=>{
console.log("Servidor rodando na porta 3000")
})