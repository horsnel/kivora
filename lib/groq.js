import Groq from 'groq-sdk'

const apiKey = process.env.GROQ_API_KEY || ''
export const groq = apiKey ? new Groq({ apiKey }) : null
export const MODEL = 'llama-3.3-70b-versatile'
export const MODEL_FAST = 'llama-3.1-8b-instant'
