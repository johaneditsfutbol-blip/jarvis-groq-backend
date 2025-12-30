const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('edge-tts');
const { v4: uuidv4 } = require('uuid');

// Configuración
const port = process.env.PORT || 8080;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const wss = new WebSocket.Server({ port });

console.log(`🚀 Jarvis (Groq Edition) escuchando en puerto ${port}`);

wss.on('connection', (ws) => {
    console.log('⚡ Cliente conectado');

    ws.on('message', async (message) => {
        const requestId = uuidv4();
        const inputPath = path.resolve(__dirname, `input_${requestId}.m4a`);
        const outputPath = path.resolve(__dirname, `output_${requestId}.mp3`);

        console.log(`🎤 Recibiendo audio [${requestId}]...`);
        
        // 1. Guardar el audio entrante
        fs.writeFileSync(inputPath, message);

        try {
            // --- FASE 1: OÍDO (Groq Whisper) ---
            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(inputPath),
                model: "whisper-large-v3", // Modelo V3 (El mejor open source actual)
                response_format: "json",
                language: "es", // Forzar español mejora la precisión
            });
            
            const userText = transcription.text;
            console.log(`👤 Tú: ${userText}`);

            if (!userText || userText.trim().length === 0) return;

            // --- FASE 2: CEREBRO (Llama 3.1 en Groq) ---
            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: "Eres J.A.R.V.I.S. Responde en español. Sé extremadamente conciso, útil y con un toque de sarcasmo elegante. No uses emojis. Máximo 2 oraciones." 
                    },
                    { role: "user", content: userText }
                ],
                model: "llama-3.3-70b-versatile", // Modelo muy inteligente y rápido
                temperature: 0.6,
            });

            const jarvisReply = completion.choices[0].message.content;
            console.log(`🤖 Jarvis: ${jarvisReply}`);

            // --- FASE 3: VOZ (Edge TTS) ---
            // Voces recomendadas: 
            // 'es-AR-TomasNeural' (Hombre Argentino, muy natural)
            // 'es-MX-JorgeNeural' (Hombre Mexicano)
            // 'es-ES-AlvaroNeural' (Hombre Español)
            const tts = new MsEdgeTTS();
            await tts.setMetadata("es-AR-TomasNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48BIT_MONO_MP3);
            await tts.toFile(outputPath, jarvisReply);

            // --- FASE 4: ENVIAR RESPUESTA ---
            const audioBuffer = fs.readFileSync(outputPath);
            ws.send(audioBuffer);
            console.log('📤 Audio enviado');

            // Limpieza de archivos
            try { fs.unlinkSync(inputPath); fs.unlinkSync(outputPath); } catch(e){}

        } catch (error) {
            console.error('❌ Error en el proceso:', error);
            // Opcional: Enviar un audio de error pregrabado
        }
    });
});