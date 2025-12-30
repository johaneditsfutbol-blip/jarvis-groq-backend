const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const Groq = require('groq-sdk');
const { exec } = require('child_process'); // <--- Usaremos esto para llamar a Python
const { v4: uuidv4 } = require('uuid');

// Configuración
const port = process.env.PORT || 8080;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const wss = new WebSocket.Server({ port });

console.log(`🚀 Jarvis (Python Hybrid) escuchando en puerto ${port}`);

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
                model: "whisper-large-v3",
                response_format: "json",
                language: "es",
            });
            
            const userText = transcription.text;
            console.log(`👤 Tú: ${userText}`);

            if (!userText || userText.trim().length === 0) return;

            // --- FASE 2: CEREBRO (Llama 3 en Groq) ---
            const completion = await groq.chat.completions.create({
                messages: [
                    { 
                        role: "system", 
                        content: "Eres J.A.R.V.I.S. Responde en español. Sé extremadamente conciso, útil y con un toque de sarcasmo elegante. No uses emojis. Máximo 2 oraciones." 
                    },
                    { role: "user", content: userText }
                ],
                model: "llama-3.3-70b-versatile",
                temperature: 0.6,
            });

            const jarvisReply = completion.choices[0].message.content;
            console.log(`🤖 Jarvis: ${jarvisReply}`);

            // --- FASE 3: VOZ (Python Bridge) ---
            // Escapamos las comillas dobles para que no rompa el comando de terminal
            const safeText = jarvisReply.replace(/"/g, '\\"');
            
            // Ejecutamos el comando edge-tts de Python directamente
            const command = `edge-tts --text "${safeText}" --write-media "${outputPath}" --voice es-AR-TomasNeural`;

            exec(command, (error, stdout, stderr) => {
                if (error) {
                    console.error(`❌ Error TTS: ${error.message}`);
                    return;
                }

                // --- FASE 4: ENVIAR RESPUESTA ---
                try {
                    const audioBuffer = fs.readFileSync(outputPath);
                    ws.send(audioBuffer);
                    console.log('📤 Audio enviado');

                    // Limpieza
                    fs.unlinkSync(inputPath);
                    fs.unlinkSync(outputPath);
                } catch (e) {
                    console.error("Error enviando archivo:", e);
                }
            });

        } catch (error) {
            console.error('❌ Error General:', error);
        }
    });
});
